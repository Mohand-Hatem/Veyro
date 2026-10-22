import 'dotenv/config';
import 'reflect-metadata';
import { describe, it, before, after } from 'node:test';
import * as assert from 'node:assert/strict';
import { NestFactory } from '@nestjs/core';
import { ValidationPipe, INestApplication } from '@nestjs/common';
import cookieParser from 'cookie-parser';
import { TaskStatus } from '@prisma/client';
import { AppModule } from '../src/app.module';
import { TransformInterceptor } from '../src/common/interceptors/transform.interceptor';
import { AllExceptionsFilter } from '../src/common/filters/http-exception.filter';
import { PrismaService } from '../src/prisma/prisma.service';
import { buildFixture, Fixture } from './helpers/fixture';

/**
 * CS-04: what the project board needs from the API.
 *  - project detail: exact per-status counts (deleted tasks excluded) + viewer rights
 *  - soft-deleted tasks: listable and openable by admins and the author only, with the 30-day purge date
 *  - task detail: server-computed viewer capabilities
 */
describe('CS-04: board contract (counts, viewer rights, restore window)', () => {
  let app: INestApplication;
  let base: string;
  let prisma: PrismaService;
  let fx: Fixture;
  const cookies: Record<string, string> = {};
  const T: Record<string, string> = {};
  const DAY = 86400000;

  const login = async (label: string) => {
    const res = await fetch(`${base}/auth/login`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email: `${label}.${fx.run}@veyro-test.io`, password: 'Password123!' }),
    });
    assert.strictEqual(res.status, 200, `login ${label}`);
    return res.headers.getSetCookie().map((c) => c.split(';')[0]).join('; ');
  };
  const call = async (who: string, method: string, path: string, body?: object) => {
    const res = await fetch(`${base}${path}`, { method, headers: { cookie: cookies[who], 'content-type': 'application/json' }, body: body ? JSON.stringify(body) : undefined });
    return { status: res.status, json: (await res.json().catch(() => ({}))) as any };
  };
  const mk = (title: string, data: object) => prisma.task.create({ data: { projectId: fx.projectA1, title: `${title} ${fx.run}`, authorId: fx.users.owner, ...data } as any });

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
    // memberB joins project A1 so there are two ordinary members: one task author and one bystander.
    await prisma.projectMember.create({ data: { projectId: fx.projectA1, userId: fx.users.memberB } });
    const now = new Date();
    T.todo = (await mk('todo', { authorId: fx.users.memberA, status: TaskStatus.TODO })).id;
    T.doing = (await mk('doing', { status: TaskStatus.IN_PROGRESS })).id;
    T.done = (await mk('done', { status: TaskStatus.DONE, completedAt: now })).id;
    T.cancelled = (await mk('cancelled', { status: TaskStatus.CANCELLED })).id;
    T.delByMemberA = (await mk('deleted by A', { authorId: fx.users.memberA, status: TaskStatus.TODO, deletedAt: new Date(now.getTime() - 3 * DAY) })).id;
    T.delByOwner = (await mk('deleted by owner', { status: TaskStatus.IN_REVIEW, deletedAt: new Date(now.getTime() - 10 * DAY) })).id;
  });

  after(async () => {
    try {
      await fx.cleanup();
    } finally {
      await app.close();
    }
  });

  describe('GET /projects/:id', () => {
    it('returns exact per-status counts without soft-deleted tasks, and the viewer', async () => {
      const r = await call('admin2', 'GET', `/projects/${fx.projectA1}`);
      assert.strictEqual(r.status, 200);
      assert.deepEqual(r.json.data.taskCounts, { todo: 1, inProgress: 1, inReview: 0, done: 1, cancelled: 1 });
      assert.strictEqual(r.json.data._count.tasks, 4, 'the total ignores deleted tasks');
      assert.deepEqual(r.json.data.viewer, { userId: fx.users.admin2, isAdmin: true, projectRole: 'ADMIN', isWorkspaceOverride: true, canCreateTask: true, canManageMembers: true });
      assert.ok(Array.isArray(r.json.data.members));
    });

    it('tells a member they are not an admin, and keeps hiding the project from outsiders', async () => {
      const m = await call('membera', 'GET', `/projects/${fx.projectA1}`);
      assert.deepEqual(m.json.data.viewer, { userId: fx.users.memberA, isAdmin: false, projectRole: 'MEMBER', isWorkspaceOverride: false, canCreateTask: false, canManageMembers: false });
      assert.strictEqual((await call('outsider', 'GET', `/projects/${fx.projectA1}`)).status, 404);
      const unassigned = await prisma.workspaceMember.findMany({ where: { workspaceId: fx.workspaceA, userId: fx.users.memberB } });
      assert.strictEqual(unassigned.length, 1);
    });

    it('workspace project list also ignores deleted tasks in its counters', async () => {
      const r = await call('owner', 'GET', `/workspaces/${fx.workspaceA}/projects`);
      const a1 = r.json.data.find((p: any) => p.id === fx.projectA1);
      assert.strictEqual(a1._count.tasks, 4);
    });
  });

  describe('GET /projects/:id/tasks?deleted=true', () => {
    it('keeps the default list free of deleted tasks, including deleted=false', async () => {
      const plain = await call('owner', 'GET', `/projects/${fx.projectA1}/tasks?limit=100`);
      assert.strictEqual(plain.json.data.meta.total, 4);
      assert.ok(!plain.json.data.tasks.some((t: any) => t.deletedAt));
      const explicitFalse = await call('owner', 'GET', `/projects/${fx.projectA1}/tasks?deleted=false`);
      assert.strictEqual(explicitFalse.json.data.meta.total, 4, '"false" must not be coerced to true');
    });

    it('lists every deleted task for an admin with its purge date 30 days after deletion', async () => {
      const r = await call('admin2', 'GET', `/projects/${fx.projectA1}/tasks?deleted=true`);
      assert.strictEqual(r.status, 200);
      assert.strictEqual(r.json.data.meta.total, 2);
      for (const t of r.json.data.tasks) {
        assert.strictEqual(new Date(t.purgeAt).getTime() - new Date(t.deletedAt).getTime(), 30 * DAY);
      }
      assert.strictEqual(r.json.data.tasks[0].id, T.delByMemberA, 'most recently deleted first');
    });

    it('shows deleted tasks to project admins only: members get an empty list, outsiders 404 (CS-05)', async () => {
      for (const who of ['membera', 'memberb']) {
        const r = await call(who, 'GET', `/projects/${fx.projectA1}/tasks?deleted=true`);
        assert.strictEqual(r.status, 200);
        assert.strictEqual(r.json.data.meta.total, 0, `${who} sees nothing`);
      }
      assert.strictEqual((await call('outsider', 'GET', `/projects/${fx.projectA1}/tasks?deleted=true`)).status, 404);
    });

    it('rejects a malformed flag', async () => {
      assert.strictEqual((await call('owner', 'GET', `/projects/${fx.projectA1}/tasks?deleted=maybe`)).status, 400);
    });
  });

  describe('GET /tasks/:id', () => {
    it('opens a deleted task for an admin with the restore window and rights', async () => {
      const admin = await call('admin2', 'GET', `/tasks/${T.delByOwner}`);
      assert.strictEqual(admin.status, 200);
      assert.ok(admin.json.data.deletedAt && admin.json.data.purgeAt);
      assert.strictEqual(admin.json.data.viewer.canRestore, true);
      assert.strictEqual(admin.json.data.viewer.canDelete, false);
      assert.deepEqual(admin.json.data.viewer.allowedStatuses, []);
    });

    it('keeps deleted tasks invisible to members, even to their own author (404, no enumeration)', async () => {
      assert.strictEqual((await call('membera', 'GET', `/tasks/${T.delByMemberA}`)).status, 404);
      assert.strictEqual((await call('memberb', 'GET', `/tasks/${T.delByMemberA}`)).status, 404);
      assert.strictEqual((await call('outsider', 'GET', `/tasks/${T.delByOwner}`)).status, 404);
    });

    it('does not widen any write path to deleted tasks', async () => {
      assert.strictEqual((await call('owner', 'PATCH', `/tasks/${T.delByOwner}`, { title: 'nope nope' })).status, 404);
      assert.strictEqual((await call('owner', 'POST', `/tasks/${T.delByOwner}/comments`, { content: 'hello' })).status, 404);
      assert.strictEqual((await call('owner', 'GET', `/tasks/${T.delByOwner}/comments`)).status, 404);
    });

    it('computes viewer rights on live tasks (admin / assigned member / bystander, terminal / open)', async () => {
      const mk = (userId: string, isAdmin: boolean, isAuthor: boolean, isAssignee: boolean, extra: object) => ({ userId, isProjectAdmin: isAdmin, isTaskAuthor: isAuthor, isAssignee, canEdit: isAdmin, canAssign: isAdmin, canReopen: false, canDelete: isAdmin, canRestore: false, allowedStatuses: [], ...extra });
      // memberA authored T.todo but is a plain member: no edit, no delete, no moves (not assigned).
      const author = await call('membera', 'GET', `/tasks/${T.todo}`);
      assert.deepEqual(author.json.data.viewer, mk(fx.users.memberA, false, true, false, {}));
      // admin: every allowed step, including cancel.
      const adminTodo = await call('admin2', 'GET', `/tasks/${T.todo}`);
      assert.deepEqual(adminTodo.json.data.viewer.allowedStatuses.sort(), ['CANCELLED', 'IN_PROGRESS']);
      // assigned member: normal steps without cancel.
      await prisma.task.update({ where: { id: T.doing }, data: { assigneeId: fx.users.memberB } });
      const assigned = await call('memberb', 'GET', `/tasks/${T.doing}`);
      assert.deepEqual(assigned.json.data.viewer.allowedStatuses.sort(), ['IN_REVIEW', 'TODO']);
      assert.strictEqual(assigned.json.data.viewer.canEdit, false);
      // terminal tasks: only admins reopen.
      const bystanderDone = await call('memberb', 'GET', `/tasks/${T.done}`);
      assert.strictEqual(bystanderDone.json.data.viewer.canReopen, false);
      const adminDone = await call('admin2', 'GET', `/tasks/${T.done}`);
      assert.strictEqual(adminDone.json.data.viewer.canReopen, true);
      assert.strictEqual((await call('admin2', 'GET', `/tasks/${T.cancelled}`)).json.data.viewer.canReopen, true);
      assert.strictEqual((await call('admin2', 'GET', `/tasks/${T.doing}`)).json.data.viewer.canReopen, false);
      assert.strictEqual(adminDone.json.data.purgeAt, null);
    });

    it('restores a task from the detail view flow and it becomes a normal task again', async () => {
      assert.strictEqual((await call('membera', 'POST', `/tasks/${T.delByMemberA}/restore`)).status, 403, 'an author who is a plain member cannot restore');
      const r = await call('admin2', 'POST', `/tasks/${T.delByMemberA}/restore`);
      assert.strictEqual(r.status, 200);
      const after = await call('memberb', 'GET', `/tasks/${T.delByMemberA}`);
      assert.strictEqual(after.status, 200);
      assert.strictEqual(after.json.data.purgeAt, null);
      assert.strictEqual(after.json.data.viewer.canRestore, false);
      const counts = (await call('owner', 'GET', `/projects/${fx.projectA1}`)).json.data.taskCounts;
      assert.strictEqual(counts.todo, 2, 'the restored task is counted again');
    });
  });
});
