import 'dotenv/config';
import 'reflect-metadata';
import { describe, it, before, after } from 'node:test';
import * as assert from 'node:assert/strict';
import { NestFactory } from '@nestjs/core';
import { ValidationPipe, INestApplication } from '@nestjs/common';
import cookieParser from 'cookie-parser';
import { ProjectRole, TaskStatus } from '@prisma/client';
import { AppModule } from '../src/app.module';
import { TransformInterceptor } from '../src/common/interceptors/transform.interceptor';
import { AllExceptionsFilter } from '../src/common/filters/http-exception.filter';
import { PrismaService } from '../src/prisma/prisma.service';
import { buildFixture, Fixture } from './helpers/fixture';

/**
 * CS-05 / ADR-012: project-level roles.
 *  Project admin (project role ADMIN, or workspace admin / account owner): create, edit, assign, cancel, delete, restore, reopen,
 *  manage project members. Member: move status of tasks assigned to them (never cancel), comment, read.
 */
describe('CS-05: project roles and task permissions', () => {
  let app: INestApplication;
  let base: string;
  let prisma: PrismaService;
  let fx: Fixture;
  const cookies: Record<string, string> = {};
  const P = () => `/projects/${fx.projectA1}`;
  const code = (r: { json: any }) => r.json?.error?.code ?? r.json?.code ?? r.json?.data?.code;
  const role = async (userId: string) => (await prisma.projectMember.findUnique({ where: { projectId_userId: { projectId: fx.projectA1, userId } } }))?.role;
  const setRole = (userId: string, r: ProjectRole) => prisma.projectMember.update({ where: { projectId_userId: { projectId: fx.projectA1, userId } }, data: { role: r } });
  const audits = (action: string) => prisma.auditLog.findMany({ where: { projectId: fx.projectA1, action } });

  const login = async (label: string) => {
    const res = await fetch(`${base}/auth/login`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email: `${label}.${fx.run}@veyro-test.io`, password: 'Password123!' }) });
    assert.strictEqual(res.status, 200, `login ${label}`);
    return res.headers.getSetCookie().map((c) => c.split(';')[0]).join('; ');
  };
  const call = async (who: string, method: string, path: string, body?: object) => {
    const res = await fetch(`${base}${path}`, { method, headers: { cookie: cookies[who], 'content-type': 'application/json' }, body: body ? JSON.stringify(body) : undefined });
    return { status: res.status, json: (await res.json().catch(() => ({}))) as any };
  };
  const mkTask = (title: string, data: object = {}) => prisma.task.create({ data: { projectId: fx.projectA1, title: `${title} ${fx.run}`, authorId: fx.users.owner, ...data } as any });

  before(async () => {
    app = await NestFactory.create(AppModule, { logger: false });
    app.use(cookieParser());
    app.setGlobalPrefix('api/v1');
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true, forbidNonWhitelisted: true, transformOptions: { enableImplicitConversion: true } }));
    app.useGlobalInterceptors(new TransformInterceptor());
    app.useGlobalFilters(new AllExceptionsFilter());
    await app.listen(0);
    base = `${await app.getUrl()}/api/v1`.replace('[::1]', 'localhost');
    prisma = app.get(PrismaService);
    fx = await buildFixture(prisma);
    for (const l of ['owner', 'admin2', 'membera', 'memberb', 'outsider']) cookies[l] = await login(l);
  });

  after(async () => {
    try {
      await fx.cleanup();
    } finally {
      await app.close();
    }
  });

  describe('project creation and members', () => {
    it('makes the creator the protected owner and a project admin', async () => {
      const r = await call('admin2', 'POST', `/workspaces/${fx.workspaceA}/projects`, { name: `Roles ${fx.run}` });
      assert.strictEqual(r.status, 201);
      const created = await prisma.project.findUniqueOrThrow({ where: { id: r.json.data.id } });
      assert.strictEqual(created.createdById, fx.users.admin2);
      const m = await prisma.projectMember.findUniqueOrThrow({ where: { projectId_userId: { projectId: created.id, userId: fx.users.admin2 } } });
      assert.strictEqual(m.role, ProjectRole.ADMIN);
    });

    it('lists members with their role', async () => {
      const r = await call('membera', 'GET', `${P()}/members`);
      assert.strictEqual(r.status, 200);
      const byUser = Object.fromEntries(r.json.data.map((m: any) => [m.userId, m.role]));
      assert.strictEqual(byUser[fx.users.owner], 'ADMIN');
      assert.strictEqual(byUser[fx.users.memberA], 'MEMBER');
    });

    it('lets a project admin add members (default MEMBER, or ADMIN) and promote or demote them', async () => {
      const add = await call('owner', 'POST', `${P()}/members`, { userId: fx.users.memberB });
      assert.strictEqual(add.status, 201);
      assert.strictEqual(await role(fx.users.memberB), ProjectRole.MEMBER);
      const up = await call('owner', 'PATCH', `${P()}/members/${fx.users.memberA}`, { role: 'ADMIN' });
      assert.strictEqual(up.status, 200);
      assert.strictEqual(up.json.data.role, 'ADMIN');
      assert.strictEqual((await audits('PROJECT_MEMBER_ROLE_CHANGED')).length, 1);
      const same = await call('owner', 'PATCH', `${P()}/members/${fx.users.memberA}`, { role: 'ADMIN' });
      assert.strictEqual(same.status, 200);
      assert.strictEqual((await audits('PROJECT_MEMBER_ROLE_CHANGED')).length, 1, 'idempotent, no extra audit');
    });

    it('gives a promoted plain workspace member the project admin powers', async () => {
      // memberA is only a WORKSPACE member, but ADMIN in this project.
      const t = await call('membera', 'POST', `${P()}/tasks`, { title: 'Made by a project admin', category: 'FEATURE', assigneeId: fx.users.memberB });
      assert.strictEqual(t.status, 201);
      const id = t.json.data.id;
      assert.strictEqual((await call('membera', 'PATCH', `/tasks/${id}`, { title: 'Renamed by project admin', priority: 'HIGH' })).status, 200);
      assert.strictEqual((await call('membera', 'DELETE', `/tasks/${id}`)).status, 204);
      assert.strictEqual((await call('membera', 'GET', `${P()}/tasks?deleted=true`)).json.data.meta.total >= 1, true);
      assert.strictEqual((await call('membera', 'POST', `/tasks/${id}/restore`)).status, 200);
      const detail = await call('membera', 'GET', `/tasks/${id}`);
      assert.strictEqual(detail.json.data.viewer.isProjectAdmin, true);
      const info = await call('membera', 'GET', P());
      assert.deepEqual([info.json.data.viewer.projectRole, info.json.data.viewer.isWorkspaceOverride, info.json.data.viewer.canCreateTask], ['ADMIN', false, true]);
      const addAdmin = await call('membera', 'PATCH', `${P()}/members/${fx.users.memberB}`, { role: 'ADMIN' });
      assert.strictEqual(addAdmin.status, 200);
      await setRole(fx.users.memberB, ProjectRole.MEMBER);
    });

    it('protects the creator from other project admins but not from workspace admins', async () => {
      // memberA is a project admin; the creator is `owner`.
      const demote = await call('membera', 'PATCH', `${P()}/members/${fx.users.owner}`, { role: 'MEMBER' });
      assert.strictEqual(demote.status, 403);
      assert.strictEqual(code(demote), 'PROJECT_OWNER_PROTECTED');
      const remove = await call('membera', 'DELETE', `${P()}/members/${fx.users.owner}`);
      assert.strictEqual(remove.status, 403);
      assert.strictEqual(code(remove), 'PROJECT_OWNER_PROTECTED');
      assert.strictEqual(await role(fx.users.owner), ProjectRole.ADMIN);
      // a workspace admin (override) can step in, and we put it back.
      assert.strictEqual((await call('admin2', 'PATCH', `${P()}/members/${fx.users.owner}`, { role: 'MEMBER' })).status, 200);
      assert.strictEqual((await call('admin2', 'PATCH', `${P()}/members/${fx.users.owner}`, { role: 'ADMIN' })).status, 200);
    });

    it('stops project admins from changing their own role or removing themselves', async () => {
      const self = await call('membera', 'PATCH', `${P()}/members/${fx.users.memberA}`, { role: 'MEMBER' });
      assert.strictEqual(self.status, 422);
      assert.strictEqual(code(self), 'CANNOT_CHANGE_OWN_ROLE');
      const leave = await call('membera', 'DELETE', `${P()}/members/${fx.users.memberA}`);
      assert.strictEqual(leave.status, 422);
      assert.strictEqual(code(leave), 'CANNOT_REMOVE_SELF');
    });

    it('keeps members, non-members and bad input out', async () => {
      await setRole(fx.users.memberA, ProjectRole.MEMBER);
      for (const [m, path, body] of [['PATCH', `${P()}/members/${fx.users.memberB}`, { role: 'ADMIN' }], ['POST', `${P()}/members`, { userId: fx.users.admin2 }], ['DELETE', `${P()}/members/${fx.users.memberB}`, undefined]] as const) {
        const r = await call('membera', m, path, body as any);
        assert.strictEqual(r.status, 403, `${m} ${path}`);
        assert.strictEqual(code(r), 'PERMISSION_DENIED');
      }
      assert.strictEqual((await call('outsider', 'PATCH', `${P()}/members/${fx.users.memberB}`, { role: 'ADMIN' })).status, 404);
      assert.strictEqual((await call('owner', 'PATCH', `${P()}/members/${fx.users.admin2}`, { role: 'ADMIN' })).status, 404, 'not a project member');
      assert.strictEqual((await call('owner', 'PATCH', `${P()}/members/${fx.users.memberB}`, { role: 'OWNER' })).status, 400);
    });
  });

  describe('what a plain member can and cannot do with tasks', () => {
    let assigned: string, other: string, done: string;
    before(async () => {
      assigned = (await mkTask('assigned to B', { status: TaskStatus.TODO, assigneeId: fx.users.memberB })).id;
      other = (await mkTask('not assigned to B', { status: TaskStatus.TODO })).id;
      done = (await mkTask('already done', { status: TaskStatus.DONE, completedAt: new Date(), assigneeId: fx.users.memberB })).id;
    });

    it('cannot create tasks', async () => {
      const r = await call('memberb', 'POST', `${P()}/tasks`, { title: 'Member tries' });
      assert.strictEqual(r.status, 403);
      assert.strictEqual(code(r), 'PERMISSION_DENIED');
    });

    it('cannot edit information or assign (title, description, priority, category, due date, assignee)', async () => {
      for (const body of [{ title: 'Nope nope' }, { description: 'x' }, { priority: 'LOW' }, { category: 'BUG' }, { dueDate: '2030-01-01' }, { assigneeId: fx.users.memberB }, { assigneeId: null }, { status: 'IN_PROGRESS', title: 'sneaky' }]) {
        const r = await call('memberb', 'PATCH', `/tasks/${assigned}`, body);
        assert.strictEqual(r.status, 403, JSON.stringify(body));
        assert.strictEqual(code(r), 'PERMISSION_DENIED');
      }
      assert.strictEqual((await prisma.task.findUniqueOrThrow({ where: { id: assigned } })).status, TaskStatus.TODO, 'nothing changed');
    });

    it('moves only tasks assigned to them, forward and back, never to Cancelled', async () => {
      assert.strictEqual((await call('memberb', 'PATCH', `/tasks/${other}`, { status: 'IN_PROGRESS' })).status, 403);
      assert.strictEqual((await call('memberb', 'PATCH', `/tasks/${assigned}`, { status: 'IN_PROGRESS' })).status, 200);
      assert.strictEqual((await call('memberb', 'PATCH', `/tasks/${assigned}`, { status: 'TODO' })).status, 200);
      assert.strictEqual((await call('memberb', 'PATCH', `/tasks/${assigned}`, { status: 'CANCELLED' })).status, 403, 'only admins cancel');
      assert.strictEqual((await call('memberb', 'PATCH', `/tasks/${assigned}`, { status: 'DONE' })).status, 400, 'workflow still applies');
      await call('memberb', 'PATCH', `/tasks/${assigned}`, { status: 'IN_PROGRESS' });
      await call('memberb', 'PATCH', `/tasks/${assigned}`, { status: 'IN_REVIEW' });
      const fin = await call('memberb', 'PATCH', `/tasks/${assigned}`, { status: 'DONE' });
      assert.strictEqual(fin.status, 200);
      assert.ok(fin.json.data.completedAt, 'completedAt is stamped');
    });

    it('can comment on any project task but cannot delete, restore or reopen', async () => {
      assert.strictEqual((await call('memberb', 'POST', `/tasks/${other}/comments`, { content: 'My opinion on this one' })).status, 201);
      const del = await call('memberb', 'DELETE', `/tasks/${other}`);
      assert.strictEqual(del.status, 403);
      assert.strictEqual(code(del), 'PERMISSION_DENIED');
      const reopen = await call('memberb', 'POST', `/tasks/${done}/reopen`, { targetStatus: 'IN_PROGRESS', reason: 'I disagree with this' });
      assert.strictEqual(reopen.status, 403);
      assert.strictEqual((await call('admin2', 'POST', `/tasks/${done}/reopen`, { targetStatus: 'IN_PROGRESS', reason: 'Admin reopens it' })).status, 200);
      await prisma.task.update({ where: { id: other }, data: { deletedAt: new Date() } });
      assert.strictEqual((await call('memberb', 'POST', `/tasks/${other}/restore`)).status, 403);
      await prisma.task.update({ where: { id: other }, data: { deletedAt: null } });
    });

    it('sees what they may do, computed by the server', async () => {
      const r = await call('memberb', 'GET', `/tasks/${done}`);
      assert.strictEqual(r.json.data.viewer.isAssignee, true);
      assert.deepEqual(r.json.data.viewer.allowedStatuses.sort(), ['IN_REVIEW', 'TODO']);
      assert.strictEqual(r.json.data.viewer.canEdit, false);
      assert.strictEqual((await call('memberb', 'GET', `${P()}`)).json.data.viewer.canCreateTask, false);
    });
  });

  describe('task category', () => {
    let id: string;
    it('is optional, validated, editable by admins and clearable', async () => {
      const bad = await call('owner', 'POST', `${P()}/tasks`, { title: 'Bad category', category: 'MAGIC' });
      assert.strictEqual(bad.status, 400);
      const ok = await call('owner', 'POST', `${P()}/tasks`, { title: 'With category', category: 'BUG' });
      assert.strictEqual(ok.status, 201);
      id = ok.json.data.id;
      assert.strictEqual(ok.json.data.category, 'BUG');
      assert.strictEqual((await call('owner', 'POST', `${P()}/tasks`, { title: 'No category' })).json.data.category, null);
      assert.strictEqual((await call('owner', 'PATCH', `/tasks/${id}`, { category: 'DOCS' })).json.data.category, 'DOCS');
      assert.strictEqual((await call('membera', 'GET', `/tasks/${id}`)).json.data.category, 'DOCS');
      assert.strictEqual((await call('owner', 'PATCH', `/tasks/${id}`, { category: null })).json.data.category, null);
    });
    it('filters the task list by category', async () => {
      await call('owner', 'PATCH', `/tasks/${id}`, { category: 'DESIGN' });
      const r = await call('owner', 'GET', `${P()}/tasks?category=DESIGN&limit=100`);
      assert.deepEqual(r.json.data.tasks.map((t: any) => t.id), [id]);
      assert.strictEqual((await call('owner', 'GET', `${P()}/tasks?category=NOPE`)).status, 400);
    });
  });
});
