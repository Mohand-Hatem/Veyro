import 'dotenv/config';
import 'reflect-metadata';
import { describe, it, before, after } from 'node:test';
import * as assert from 'node:assert/strict';
import * as bcrypt from 'bcrypt';
import { NestFactory } from '@nestjs/core';
import { ValidationPipe, INestApplication } from '@nestjs/common';
import cookieParser from 'cookie-parser';
import { AppModule } from '../src/app.module';
import { NotificationsService } from '../src/modules/notifications/notifications.service';
import { TransformInterceptor } from '../src/common/interceptors/transform.interceptor';
import { AllExceptionsFilter } from '../src/common/filters/http-exception.filter';
import { PrismaService } from '../src/prisma/prisma.service';
import { buildFixture, Fixture } from './helpers/fixture';

/** Step 5.9 Phase C: in-app notifications, through the real endpoints (events are caused by real requests, never inserted by hand). */
describe('5.9c: notifications (real app, real guards)', () => {
  let app: INestApplication;
  let base: string;
  let prisma: PrismaService;
  let service: NotificationsService;
  let fx: Fixture;
  let invitee: string;
  const cookies: Record<string, string> = {};
  const who = ['owner', 'admin2', 'membera', 'memberb', 'outsider', 'invitee'];

  const login = async (label: string) => {
    const res = await fetch(`${base}/auth/login`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email: `${label}.${fx.run}@veyro-test.io`, password: 'Password123!' }) });
    assert.strictEqual(res.status, 200, `login ${label}`);
    return res.headers.getSetCookie().map((c) => c.split(';')[0]).join('; ');
  };
  const call = async (as: string | null, method: string, path: string, body?: object) => {
    const res = await fetch(`${base}${path}`, { method, headers: { ...(as ? { cookie: cookies[as] } : {}), 'content-type': 'application/json' }, body: body ? JSON.stringify(body) : undefined });
    return { status: res.status, json: (await res.json().catch(() => ({}))) as any };
  };
  const inbox = async (as: string, query = '') => (await call(as, 'GET', `/notifications${query}`)).json.data as { items: any[]; nextCursor: string | null };
  const unread = async (as: string) => (await call(as, 'GET', '/notifications/unread-count')).json.data.unreadCount as number;
  const ofType = async (as: string, type: string) => (await inbox(as, '?limit=50')).items.filter((i) => i.type === type);
  const newTask = async (as: string, extra: object = {}) => {
    const r = await call(as, 'POST', `/projects/${fx.projectA1}/tasks`, { title: `Task ${Math.random().toString(36).slice(2, 7)}`, priority: 'MEDIUM', ...extra });
    assert.strictEqual(r.status, 201, JSON.stringify(r.json));
    return r.json.data;
  };

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
    service = app.get(NotificationsService);
    fx = await buildFixture(prisma);
    invitee = (await prisma.user.create({ data: { email: `invitee.${fx.run}@veyro-test.io`, name: `invitee ${fx.run}`, passwordHash: await bcrypt.hash('Password123!', 4), isEmailVerified: true } })).id;
    for (const l of who) cookies[l] = await login(l);
  });

  after(async () => {
    try {
      await fx.cleanup();
      await prisma.userSession.deleteMany({ where: { userId: invitee } });
      await prisma.user.deleteMany({ where: { id: invitee } });
    } finally {
      await app.close();
    }
  });

  describe('who hears about what', () => {
    it('tells the assignee when a task is created for them, with what the sentence needs', async () => {
      const task = await newTask('owner', { assigneeId: fx.users.memberA });
      const [n] = await ofType('membera', 'TASK_ASSIGNED');
      assert.strictEqual(n.taskId, task.id);
      assert.strictEqual(n.readAt, null);
      assert.deepEqual([n.actor.id, n.workspaceId, n.projectId], [fx.users.owner, fx.workspaceA, fx.projectA1]);
      assert.deepEqual([n.data.taskTitle, n.data.projectKey, n.data.workspaceSlug, n.data.actorName], [task.title, 'ALP', `ws-a-${fx.run}`, `owner ${fx.run}`]);
      assert.strictEqual(await unread('membera'), 1);
      assert.strictEqual((await inbox('owner')).items.length, 0, 'the creator is not told about their own action');
    });

    it('never tells someone about their own action (assigning yourself)', async () => {
      await newTask('owner', { assigneeId: fx.users.owner });
      assert.strictEqual((await inbox('owner')).items.length, 0);
    });

    it('tells a project member when they are added to a project, and nobody for a member who was already in', async () => {
      assert.strictEqual((await call('owner', 'POST', `/projects/${fx.projectA1}/members`, { userId: fx.users.admin2 })).status, 201);
      const [n] = await ofType('admin2', 'ADDED_TO_PROJECT');
      assert.deepEqual([n.projectId, n.data.projectKey, n.data.workspaceSlug, n.actor.id], [fx.projectA1, 'ALP', `ws-a-${fx.run}`, fx.users.owner]);
      const before = (await inbox('admin2')).items.length;
      await call('owner', 'POST', `/projects/${fx.projectA1}/members`, { userId: fx.users.admin2 }); // already a member
      assert.strictEqual((await inbox('admin2')).items.length, before);
    });

    it('tells only a NEW assignee when a task is reassigned, not when other fields change', async () => {
      const task = await newTask('owner');
      const count = async () => (await ofType('admin2', 'TASK_ASSIGNED')).length;
      assert.strictEqual(await count(), 0);
      assert.strictEqual((await call('owner', 'PATCH', `/tasks/${task.id}`, { assigneeId: fx.users.admin2 })).status, 200);
      assert.strictEqual(await count(), 1);
      await call('owner', 'PATCH', `/tasks/${task.id}`, { title: 'Renamed' });
      await call('owner', 'PATCH', `/tasks/${task.id}`, { assigneeId: fx.users.admin2 }); // the same person again
      assert.strictEqual(await count(), 1);
    });

    it('tells the assignee and the creator about a comment, once each, and never the commenter', async () => {
      const task = await newTask('owner', { assigneeId: fx.users.memberA });
      const before = { owner: (await ofType('owner', 'TASK_COMMENTED')).length, a: (await ofType('membera', 'TASK_COMMENTED')).length };
      assert.strictEqual((await call('membera', 'POST', `/tasks/${task.id}/comments`, { content: 'On it' })).status, 201);
      assert.strictEqual((await ofType('owner', 'TASK_COMMENTED')).length, before.owner + 1, 'the creator hears about it');
      assert.strictEqual((await ofType('membera', 'TASK_COMMENTED')).length, before.a, 'the commenter does not');
      assert.strictEqual((await call('owner', 'POST', `/tasks/${task.id}/comments`, { content: 'Thanks' })).status, 201);
      assert.strictEqual((await ofType('membera', 'TASK_COMMENTED')).length, before.a + 1, 'the assignee hears about it');
    });

    it('sends one notification, not two, when the assignee and the creator are the same person', async () => {
      const task = await newTask('admin2', { assigneeId: fx.users.admin2 }); // admin2 is a project member by now
      const before = (await ofType('admin2', 'TASK_COMMENTED')).length;
      assert.strictEqual((await call('membera', 'POST', `/tasks/${task.id}/comments`, { content: 'Hello' })).status, 201);
      assert.strictEqual((await ofType('admin2', 'TASK_COMMENTED')).length, before + 1);
    });

    it('tells a person when their workspace role changes, and not when it does not', async () => {
      const row = await prisma.workspaceMember.findFirstOrThrow({ where: { workspaceId: fx.workspaceA, userId: fx.users.memberB } });
      assert.strictEqual((await call('owner', 'PATCH', `/workspaces/${fx.workspaceA}/members/${row.id}`, { role: 'ADMIN' })).status, 200);
      const [n] = await ofType('memberb', 'ROLE_CHANGED');
      assert.deepEqual([n.data.role, n.data.workspaceSlug, n.actor.id], ['ADMIN', `ws-a-${fx.run}`, fx.users.owner]);
      await call('owner', 'PATCH', `/workspaces/${fx.workspaceA}/members/${row.id}`, { role: 'ADMIN' }); // no change
      assert.strictEqual((await ofType('memberb', 'ROLE_CHANGED')).length, 1);
    });

    it('tells the inviter when an invitation is accepted, and not the person who accepted it', async () => {
      const inv = await call('owner', 'POST', `/workspaces/${fx.workspaceA}/invitations`, { email: `invitee.${fx.run}@veyro-test.io`, role: 'MEMBER' });
      assert.strictEqual(inv.status, 201, JSON.stringify(inv.json));
      const token = inv.json.data.rawToken ?? new URL(inv.json.data.inviteLink).searchParams.get('token');
      assert.strictEqual((await call('invitee', 'POST', '/invitations/accept', { token })).status, 200);
      const [n] = await ofType('owner', 'INVITATION_ACCEPTED');
      assert.deepEqual([n.actor.id, n.data.workspaceSlug, n.data.workspaceName], [invitee, `ws-a-${fx.run}`, `WS A ${fx.run}`]);
      assert.strictEqual((await inbox('invitee')).items.length, 0);
    });

    it('creates nothing when the event itself is refused', async () => {
      const before = await unread('memberb');
      const bad = await call('owner', 'POST', `/projects/${fx.projectA1}/tasks`, { title: 'Nope', priority: 'MEDIUM', assigneeId: fx.users.memberB }); // memberB is not in the project
      assert.strictEqual(bad.status, 400);
      assert.strictEqual(await unread('memberb'), before);
    });

    it('creates nothing when the transaction that holds it rolls back', async () => {
      const before = await prisma.notification.count({ where: { recipientId: fx.users.memberA } });
      await assert.rejects(
        prisma.$transaction(async (tx) => {
          await service.notify(tx, { type: 'TASK_ASSIGNED', recipientId: fx.users.memberA, actorId: fx.users.owner, workspaceId: fx.workspaceA, data: { taskTitle: 'x' } });
          throw new Error('the event failed after the notification was written');
        }),
      );
      assert.strictEqual(await prisma.notification.count({ where: { recipientId: fx.users.memberA } }), before);
    });

    it('does not notify someone who is not in the workspace', async () => {
      const before = await prisma.notification.count({ where: { recipientId: fx.users.outsider } });
      await prisma.$transaction((tx) => service.notify(tx, { type: 'ROLE_CHANGED', recipientId: fx.users.outsider, actorId: fx.users.owner, workspaceId: fx.workspaceA, data: { role: 'ADMIN' } }));
      assert.strictEqual(await prisma.notification.count({ where: { recipientId: fx.users.outsider } }), before);
    });
  });

  describe('reading', () => {
    it('lists newest first, in pages, with a cursor that never repeats or skips a row', async () => {
      const all = (await inbox('membera', '?limit=50')).items;
      assert.ok(all.length >= 3, 'memberA has several notifications by now');
      assert.deepEqual(all.map((i) => i.createdAt), [...all.map((i) => i.createdAt)].sort().reverse());
      const seen: string[] = [];
      let cursor: string | null = null;
      for (let i = 0; i < 20; i++) {
        const page = await inbox('membera', `?limit=2${cursor ? `&cursor=${encodeURIComponent(cursor)}` : ''}`);
        assert.ok(page.items.length <= 2);
        seen.push(...page.items.map((x) => x.id));
        cursor = page.nextCursor;
        if (!cursor) break;
      }
      assert.deepEqual(seen, all.map((i) => i.id));
    });

    it('rejects a malformed cursor and out-of-range limits', async () => {
      for (const q of ['?cursor=nope', '?limit=0', '?limit=51', '?limit=abc']) assert.strictEqual((await call('membera', 'GET', `/notifications${q}`)).status, 400, q);
    });

    it('marks one read (twice is fine) and the unread count follows', async () => {
      const first = (await inbox('membera')).items.find((i) => !i.readAt);
      const before = await unread('membera');
      const r = await call('membera', 'POST', `/notifications/${first.id}/read`);
      assert.deepEqual([r.status, r.json.data.unreadCount], [200, before - 1]);
      assert.ok((await inbox('membera', '?limit=50')).items.find((i) => i.id === first.id).readAt);
      assert.strictEqual((await call('membera', 'POST', `/notifications/${first.id}/read`)).json.data.unreadCount, before - 1);
    });

    it('treats another person\'s notification and an unknown id the same: 404, and the row stays unread', async () => {
      const mine = (await ofType('owner', 'TASK_COMMENTED'))[0];
      assert.ok(mine && !mine.readAt);
      const stranger = await call('membera', 'POST', `/notifications/${mine.id}/read`);
      assert.deepEqual([stranger.status, stranger.json.error?.code], [404, 'RESOURCE_NOT_FOUND']);
      assert.strictEqual((await call('membera', 'POST', '/notifications/does-not-exist/read')).status, 404);
      assert.strictEqual((await ofType('owner', 'TASK_COMMENTED')).find((i) => i.id === mine.id).readAt, null);
    });

    it('marks everything read at once, only for the caller', async () => {
      const ownerBefore = await unread('owner');
      assert.ok(ownerBefore > 0);
      const r = await call('membera', 'POST', '/notifications/read-all');
      assert.deepEqual([r.status, r.json.data.unreadCount], [200, 0]);
      assert.strictEqual(await unread('membera'), 0);
      assert.strictEqual(await unread('owner'), ownerBefore, 'someone else\'s inbox is untouched');
    });

    it('shows a person only their own: another tenant sees nothing of this workspace', async () => {
      assert.strictEqual((await inbox('outsider')).items.length, 0);
      assert.strictEqual(await unread('outsider'), 0);
    });

    it('needs a signed-in person on every route', async () => {
      for (const [m, p] of [['GET', '/notifications'], ['GET', '/notifications/unread-count'], ['POST', '/notifications/read-all'], ['POST', '/notifications/x/read']]) {
        assert.strictEqual((await call(null, m, p)).status, 401, `${m} ${p}`);
      }
    });

    it('hides everything from a workspace the person has left', async () => {
      assert.ok((await inbox('memberb')).items.length > 0 && (await unread('memberb')) > 0);
      await prisma.projectMember.deleteMany({ where: { userId: fx.users.memberB } });
      await prisma.workspaceMember.deleteMany({ where: { workspaceId: fx.workspaceA, userId: fx.users.memberB } });
      assert.strictEqual((await inbox('memberb')).items.length, 0);
      assert.strictEqual(await unread('memberb'), 0);
    });
  });
});
