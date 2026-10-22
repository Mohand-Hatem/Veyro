import 'dotenv/config';
import 'reflect-metadata';
import { describe, it, before, after } from 'node:test';
import * as assert from 'node:assert/strict';
import { NestFactory } from '@nestjs/core';
import { ValidationPipe, INestApplication } from '@nestjs/common';
import cookieParser from 'cookie-parser';
import { ProjectRole, SubscriptionPlanTier, TaskStatus } from '@prisma/client';
import { AppModule } from '../src/app.module';
import { TransformInterceptor } from '../src/common/interceptors/transform.interceptor';
import { AllExceptionsFilter } from '../src/common/filters/http-exception.filter';
import { PrismaService } from '../src/prisma/prisma.service';
import { buildFixture, Fixture } from './helpers/fixture';

/**
 * CS-08 / ADR-015: project catalog (filters, per-row capabilities, trash), the workspace-level archive / delete / restore
 * rules from the permission matrix, and the cross-project "my tasks" list.
 */
describe('CS-08: projects page contract and my tasks', () => {
  let app: INestApplication;
  let base: string;
  let prisma: PrismaService;
  let fx: Fixture;
  const cookies: Record<string, string> = {};
  const code = (r: { json: any }) => r.json?.error?.code ?? r.json?.code ?? r.json?.data?.code;
  const DAY = 86_400_000;

  const login = async (label: string) => {
    const res = await fetch(`${base}/auth/login`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email: `${label}.${fx.run}@veyro-test.io`, password: 'Password123!' }) });
    assert.strictEqual(res.status, 200, `login ${label}`);
    return res.headers.getSetCookie().map((c) => c.split(';')[0]).join('; ');
  };
  const call = async (who: string, method: string, path: string, body?: object) => {
    const res = await fetch(`${base}${path}`, { method, headers: { cookie: cookies[who], 'content-type': 'application/json' }, body: body ? JSON.stringify(body) : undefined });
    return { status: res.status, json: (await res.json().catch(() => ({}))) as any };
  };
  const list = (who: string, qs = '') => call(who, 'GET', `/workspaces/${fx.workspaceA}/projects${qs}`);
  const keysOf = (r: { json: any }) => (r.json.data as any[]).map((p) => p.key).sort();

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
    // memberA becomes a project admin of Alpha (CS-05): may edit details, but holds no workspace-level power
    await prisma.projectMember.update({ where: { projectId_userId: { projectId: fx.projectA1, userId: fx.users.memberA } }, data: { role: ProjectRole.ADMIN } });
    await prisma.task.create({ data: { projectId: fx.projectA1, title: 'Seed A1', authorId: fx.users.owner, status: TaskStatus.TODO } });
    await prisma.task.create({ data: { projectId: fx.projectA1, title: 'Seed A1 done', authorId: fx.users.owner, status: TaskStatus.DONE } });
  });

  after(async () => {
    try {
      await fx.cleanup();
    } finally {
      await app.close();
    }
  });

  describe('project catalog', () => {
    it('returns creator, per-status task counts and viewer capabilities, and hides unassigned projects from members', async () => {
      const r = await list('admin2');
      assert.strictEqual(r.status, 200);
      assert.deepEqual(keysOf(r), ['ALP', 'BET']);
      const alpha = r.json.data.find((p: any) => p.key === 'ALP');
      assert.ok(alpha.createdBy.name && alpha._count.members >= 2);
      assert.deepEqual([alpha.taskCounts.todo, alpha.taskCounts.done], [1, 1]);
      // CS-12: the avatar stack (at most 4 people, oldest assignment first) comes with the list.
      assert.ok(alpha.members.length >= 2 && alpha.members.length <= 4);
      assert.deepEqual(Object.keys(alpha.members[0]).sort(), ['avatarUrl', 'name', 'userId']);
      assert.deepEqual(alpha.viewer, { projectRole: 'ADMIN', canEdit: true, canArchive: true, canDelete: true, canRestore: false });

      const member = await list('memberb');
      assert.deepEqual(member.json.data, [], 'an unassigned member sees no projects');
      const projectAdmin = await list('membera');
      assert.deepEqual(keysOf(projectAdmin), ['ALP']);
      assert.deepEqual(projectAdmin.json.data[0].viewer, { projectRole: 'ADMIN', canEdit: true, canArchive: false, canDelete: false, canRestore: false }, 'a project admin edits but cannot archive or delete');
    });

    it('filters by name or key (case-insensitive) and by lifecycle status', async () => {
      assert.deepEqual(keysOf(await list('owner', '?q=alp')), ['ALP']);
      assert.deepEqual(keysOf(await list('owner', '?q=BETA')), ['BET']);
      assert.deepEqual(keysOf(await list('owner', '?q=zzz')), []);
      assert.strictEqual((await list('owner', '?status=NOPE')).status, 400);
      assert.strictEqual((await call('admin2', 'PATCH', `/projects/${fx.projectA2}`, { lifecycleStatus: 'ARCHIVED' })).status, 200);
      assert.deepEqual(keysOf(await list('owner', '?status=ARCHIVED')), ['BET']);
      assert.deepEqual(keysOf(await list('owner', '?status=ACTIVE')), ['ALP']);
      assert.strictEqual((await call('admin2', 'PATCH', `/projects/${fx.projectA2}`, { lifecycleStatus: 'ACTIVE' })).status, 200);
    });
  });

  describe('archive, delete and restore are workspace-level powers (BR matrix)', () => {
    it('lets a project admin rename but not archive, unarchive or delete', async () => {
      const rename = await call('membera', 'PATCH', `/projects/${fx.projectA1}`, { name: `Alpha renamed ${fx.run}` });
      assert.strictEqual(rename.status, 200);
      const archive = await call('membera', 'PATCH', `/projects/${fx.projectA1}`, { lifecycleStatus: 'ARCHIVED' });
      assert.strictEqual(archive.status, 403);
      assert.strictEqual(code(archive), 'PERMISSION_DENIED');
      const del = await call('membera', 'DELETE', `/projects/${fx.projectA1}`);
      assert.strictEqual(del.status, 403);
      assert.strictEqual(code(del), 'PERMISSION_DENIED');
      assert.strictEqual((await prisma.project.findUniqueOrThrow({ where: { id: fx.projectA1 } })).deletedAt, null);
      // sending the current status again is not an archive request
      assert.strictEqual((await call('membera', 'PATCH', `/projects/${fx.projectA1}`, { lifecycleStatus: 'ACTIVE' })).status, 200);
    });

    it('lets a workspace admin delete a project, lists it in the trash for admins only, and hides it everywhere else', async () => {
      assert.strictEqual((await call('admin2', 'DELETE', `/projects/${fx.projectA2}`)).status, 204);
      assert.deepEqual(keysOf(await list('owner')), ['ALP']);
      const trash = await list('admin2', '?deleted=true');
      assert.deepEqual(keysOf(trash), ['BET']);
      assert.deepEqual(trash.json.data[0].viewer, { projectRole: 'ADMIN', canEdit: false, canArchive: false, canDelete: false, canRestore: true });
      const denied = await list('membera', '?deleted=true');
      assert.strictEqual(denied.status, 403);
      assert.strictEqual(code(denied), 'PERMISSION_DENIED');
      assert.deepEqual(keysOf(await list('owner', '?deleted=false')), ['ALP'], 'the string "false" must not mean true');
      assert.strictEqual((await call('owner', 'GET', `/projects/${fx.projectA2}`)).status, 404, 'a deleted project is not reachable');
    });

    it('answers 404 to anyone who may not restore, and to a project that is not deleted', async () => {
      for (const who of ['membera', 'memberb', 'outsider']) assert.strictEqual((await call(who, 'POST', `/projects/${fx.projectA2}/restore`)).status, 404, who);
      assert.strictEqual((await call('admin2', 'POST', `/projects/${fx.projectA1}/restore`)).status, 404);
    });

    it('blocks restore at plan capacity (409) and succeeds once there is room, with an audit record', async () => {
      await prisma.accountSubscription.update({ where: { accountId: fx.accountA }, data: { tier: SubscriptionPlanTier.FREE } });
      const extra = await Promise.all(['GAM', 'DEL'].map((key) => prisma.project.create({ data: { workspaceId: fx.workspaceA, name: `${key} ${fx.run}`, key, createdById: fx.users.owner } })));
      // live = ALP + GAM + DEL = 3 = Free cap
      const full = await call('admin2', 'POST', `/projects/${fx.projectA2}/restore`);
      assert.strictEqual(full.status, 409);
      assert.strictEqual(code(full), 'PROJECT_CAPACITY_EXCEEDED');
      assert.notEqual((await prisma.project.findUniqueOrThrow({ where: { id: fx.projectA2 } })).deletedAt, null);

      // a billing read-only project can still be deleted: the owner needs this to free capacity after a downgrade
      await prisma.project.update({ where: { id: extra[1].id }, data: { isBillingReadOnly: true } });
      assert.strictEqual((await call('owner', 'DELETE', `/projects/${extra[1].id}`)).status, 204);

      const ok = await call('admin2', 'POST', `/projects/${fx.projectA2}/restore`);
      assert.strictEqual(ok.status, 200);
      assert.strictEqual(ok.json.data.deletedAt, null);
      assert.ok(await prisma.auditLog.findFirst({ where: { projectId: fx.projectA2, action: 'PROJECT_RESTORED', actorUserId: fx.users.admin2 } }));
      assert.deepEqual(keysOf(await list('owner')), ['ALP', 'BET', 'GAM']);
    });
  });

  describe('my tasks', () => {
    const wsPath = (qs = '') => `/workspaces/${fx.workspaceA}/my-tasks${qs}`;
    before(async () => {
      const sod = new Date(); sod.setUTCHours(0, 0, 0, 0);
      const mk = (title: string, extra: object, projectId = fx.projectA1, assigneeId = fx.users.memberA) =>
        prisma.task.create({ data: { projectId, title, authorId: fx.users.owner, assigneeId, ...extra } });
      await mk('Overdue', { dueDate: new Date(sod.getTime() - DAY), priority: 'HIGH' });
      await mk('Due today', { dueDate: new Date(sod.getTime() + 12 * 3600_000), status: TaskStatus.IN_PROGRESS });
      await mk('Upcoming', { dueDate: new Date(sod.getTime() + 3 * DAY), status: TaskStatus.IN_REVIEW });
      await mk('No date', {});
      await mk('Finished', { status: TaskStatus.DONE, completedAt: new Date() });
      await mk('Cancelled', { status: TaskStatus.CANCELLED });
      await mk('Deleted', { deletedAt: new Date(), dueDate: new Date(sod.getTime() - DAY) });
      await mk('Someone else', {}, fx.projectA1, fx.users.memberB);
      await mk('Not my project', { dueDate: new Date(sod.getTime() + DAY) }, fx.projectA2, fx.users.memberA); // memberA is not a member of Beta
      await mk('Admin task in Beta', { dueDate: new Date(sod.getTime() + DAY) }, fx.projectA2, fx.users.admin2);
    });

    it('lists only my open, live tasks in due order with their project, and counts every bucket', async () => {
      const r = await call('membera', 'GET', wsPath());
      assert.strictEqual(r.status, 200);
      assert.deepEqual(r.json.data.tasks.map((t: any) => t.title), ['Overdue', 'Due today', 'Upcoming', 'No date']);
      assert.deepEqual(r.json.data.counts, { open: 4, overdue: 1, today: 1, upcoming: 1, noDate: 1, done: 1, projects: 1 });
      const t = r.json.data.tasks[0];
      assert.deepEqual([t.project.key, t.project.lifecycleStatus, t.project.isBillingReadOnly], ['ALP', 'ACTIVE', false]);
      assert.deepEqual(r.json.data.meta, { total: 4, page: 1, limit: 20, totalPages: 1 });
    });

    it('filters by bucket and view, keeps the counts stable, and pages', async () => {
      const od = await call('membera', 'GET', wsPath('?bucket=overdue'));
      assert.deepEqual(od.json.data.tasks.map((t: any) => t.title), ['Overdue']);
      assert.strictEqual(od.json.data.counts.open, 4, 'counts ignore the bucket filter');
      assert.deepEqual((await call('membera', 'GET', wsPath('?bucket=nodate'))).json.data.tasks.map((t: any) => t.title), ['No date']);
      const done = await call('membera', 'GET', wsPath('?view=done'));
      assert.deepEqual(done.json.data.tasks.map((t: any) => t.title), ['Finished']);
      const p1 = await call('membera', 'GET', wsPath('?limit=3&page=1'));
      const p2 = await call('membera', 'GET', wsPath('?limit=3&page=2'));
      assert.deepEqual([p1.json.data.tasks.length, p2.json.data.tasks.length, p1.json.data.meta.totalPages], [3, 1, 2]);
      assert.strictEqual((await call('membera', 'GET', wsPath('?bucket=someday'))).status, 400);
      assert.strictEqual((await call('membera', 'GET', wsPath('?limit=500'))).status, 400);
    });

    it('respects project visibility: members never see tasks of projects they are not in, admins see their own everywhere', async () => {
      const mine = await call('membera', 'GET', wsPath());
      assert.ok(!mine.json.data.tasks.some((t: any) => t.title === 'Not my project'));
      const admin = await call('admin2', 'GET', wsPath());
      assert.deepEqual(admin.json.data.tasks.map((t: any) => t.title), ['Admin task in Beta']);
      assert.strictEqual(admin.json.data.tasks[0].project.key, 'BET');
      assert.deepEqual((await call('admin2', 'GET', wsPath(`?projectId=${fx.projectA1}`))).json.data.tasks, [], 'the projectId filter narrows, it never widens');
      assert.deepEqual((await call('memberb', 'GET', wsPath())).json.data.tasks.map((t: any) => t.title), [], 'tasks of projects I am not in stay hidden');
    });

    it('is closed to people outside the workspace', async () => {
      const r = await call('outsider', 'GET', wsPath());
      assert.ok([403, 404].includes(r.status), `status ${r.status}`);
    });
  });
});
