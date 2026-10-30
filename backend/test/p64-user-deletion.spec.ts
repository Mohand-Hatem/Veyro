import 'dotenv/config';
import 'reflect-metadata';
import { describe, it, before, after } from 'node:test';
import * as assert from 'node:assert/strict';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';
import { NestFactory } from '@nestjs/core';
import { ValidationPipe, INestApplication } from '@nestjs/common';
import cookieParser from 'cookie-parser';
import { AppModule } from '../src/app.module';
import { TransformInterceptor } from '../src/common/interceptors/transform.interceptor';
import { AllExceptionsFilter } from '../src/common/filters/http-exception.filter';
import { PrismaService } from '../src/prisma/prisma.service';
import { buildFixture, Fixture } from './helpers/fixture';

const PASSWORD = 'Password123!';

/** Step G2: a person deletes their own account. Everything goes through the real endpoint; the database is only read to prove what was kept and what was removed. */
describe('G2: delete my account (real app, real guards)', () => {
  let app: INestApplication;
  let base: string;
  let prisma: PrismaService;
  let fx: Fixture;
  let paid: string;
  const cookies: Record<string, string> = {};
  const emailOf = (label: string) => `${label}.${fx.run}@veyro-test.io`;

  const login = async (label: string) => {
    const res = await fetch(`${base}/auth/login`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email: emailOf(label), password: PASSWORD }) });
    assert.strictEqual(res.status, 200, `login ${label}`);
    return res.headers.getSetCookie().map((c) => c.split(';')[0]).join('; ');
  };
  const call = async (as: string | null, method: string, path: string, body?: object) => {
    const res = await fetch(`${base}${path}`, { method, headers: { ...(as ? { cookie: cookies[as] } : {}), 'content-type': 'application/json' }, body: body ? JSON.stringify(body) : undefined });
    return { status: res.status, json: (await res.json().catch(() => ({}))) as any, res };
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
    fx = await buildFixture(prisma);
    paid = (await prisma.user.create({ data: { email: emailOf('paid'), name: `paid ${fx.run}`, passwordHash: await bcrypt.hash(PASSWORD, 4), isEmailVerified: true } })).id;
    await prisma.userAiSubscription.create({ data: { userId: paid, tier: 'PRO', dailyQuota: 15 } });
    for (const l of ['owner', 'admin2', 'membera', 'memberb', 'paid']) cookies[l] = await login(l);
  });

  after(async () => {
    try {
      await fx.cleanup();
      await prisma.userAiSubscription.deleteMany({ where: { userId: paid } });
      await prisma.userSession.deleteMany({ where: { userId: paid } });
      await prisma.user.deleteMany({ where: { id: paid } });
    } finally {
      await app.close();
    }
  });

  describe('what is refused', () => {
    it('needs a password, and a wrong one changes nothing', async () => {
      assert.strictEqual((await call('admin2', 'DELETE', '/users/me', {})).status, 400);
      const wrong = await call('admin2', 'DELETE', '/users/me', { password: 'Not-my-password1' });
      assert.strictEqual(wrong.status, 401);
      assert.strictEqual(wrong.json.error?.code ?? wrong.json.code, 'INVALID_CURRENT_PASSWORD');
      const row = await prisma.user.findUniqueOrThrow({ where: { id: fx.users.admin2 } });
      assert.strictEqual(row.deletedAt, null);
      assert.strictEqual(row.email, emailOf('admin2'));
      assert.strictEqual((await call('admin2', 'GET', '/auth/me')).status, 200, 'still signed in');
    });

    it('refuses the owner of an account (rule 4 of docs/03): delete the account first', async () => {
      const r = await call('owner', 'DELETE', '/users/me', { password: PASSWORD });
      assert.strictEqual(r.status, 409);
      assert.strictEqual(r.json.error?.code ?? r.json.code, 'USER_OWNS_ACCOUNT');
      assert.strictEqual((await prisma.user.findUniqueOrThrow({ where: { id: fx.users.owner } })).deletedAt, null);
    });

    it('refuses a person who still has a paid personal plan', async () => {
      const r = await call('paid', 'DELETE', '/users/me', { password: PASSWORD });
      assert.strictEqual(r.status, 409);
      assert.strictEqual(r.json.error?.code ?? r.json.code, 'USER_HAS_PAID_PLAN');
      assert.strictEqual(await prisma.userAiSubscription.count({ where: { userId: paid } }), 1);
    });
  });

  describe('nobody can pass as a deleted user', () => {
    it('refuses the reserved name, however it is spaced or cased, when registering', async () => {
      for (const name of ['Deleted user', '  deleted   USER ', 'مستخدم محذوف']) {
        const r = await call(null, 'POST', '/auth/register', { email: `reserved.${fx.run}@veyro-test.io`, password: 'Passw0rd!long', name });
        assert.strictEqual(r.status, 400, name);
        assert.strictEqual(r.json.error.code, 'VALIDATION_FAILED');
      }
      assert.strictEqual(await prisma.user.count({ where: { email: `reserved.${fx.run}@veyro-test.io` } }), 0);
    });

    it('refuses it when renaming, and still accepts a name that merely contains it', async () => {
      for (const name of ['Deleted user', 'DELETED  user', 'مستخدم  محذوف']) {
        assert.strictEqual((await call('memberb', 'PATCH', '/users/me', { name })).status, 400, name);
      }
      const ok = await call('memberb', 'PATCH', '/users/me', { name: 'Deleted users fan' });
      assert.strictEqual(ok.status, 200, JSON.stringify(ok.json));
      assert.strictEqual((await prisma.user.findUniqueOrThrow({ where: { id: fx.users.memberB } })).name, 'Deleted users fan');
    });
  });

  describe('a workspace admin deletes their account', () => {
    let authoredTask: any;
    let assignedTask: any;
    let auditBefore: number;
    let deleteRes: Awaited<ReturnType<typeof call>>;

    before(async () => {
      const added = await call('owner', 'POST', `/projects/${fx.projectA1}/members`, { userId: fx.users.admin2 });
      assert.strictEqual(added.status, 201, JSON.stringify(added.json));
      const authored =await call('admin2', 'POST', `/projects/${fx.projectA1}/tasks`, { title: `Authored ${fx.run}`, priority: 'LOW', assigneeId: fx.users.memberA });
      assert.strictEqual(authored.status, 201, JSON.stringify(authored.json));
      authoredTask = authored.json.data;
      const assigned = await call('owner', 'POST', `/projects/${fx.projectA1}/tasks`, { title: `Assigned ${fx.run}`, priority: 'LOW', assigneeId: fx.users.admin2 });
      assert.strictEqual(assigned.status, 201, JSON.stringify(assigned.json));
      assignedTask = assigned.json.data;
      const comment = await call('admin2', 'POST', `/tasks/${authoredTask.id}/comments`, { content: 'My comment stays.' });
      assert.strictEqual(comment.status, 201, JSON.stringify(comment.json));
      // an invitation addressed to their email, and a leftover reset token
      const invite = await prisma.workspaceInvitation.create({ data: { workspaceId: fx.workspaceB, inviterId: fx.users.outsider, email: emailOf('admin2'), hashedToken: crypto.randomBytes(16).toString('hex'), expiresAt: new Date(Date.now() + 86_400_000) } });
      assert.ok(invite.id);
      await prisma.userPasswordResetToken.create({ data: { userId: fx.users.admin2, tokenHash: crypto.randomBytes(16).toString('hex'), expiresAt: new Date(Date.now() + 3_600_000) } });
      assert.ok((await prisma.notification.count({ where: { recipientId: fx.users.admin2 } })) >= 1, 'the assignment told admin2');
      auditBefore = await prisma.auditLog.count({ where: { actorUserId: fx.users.admin2 } });
      deleteRes = await call('admin2', 'DELETE', '/users/me', { password: PASSWORD });
    });

    it('answers 200 and clears the sign-in cookies', () => {
      assert.strictEqual(deleteRes.status, 200, JSON.stringify(deleteRes.json));
      assert.strictEqual(deleteRes.json.data.success, true);
      const set = deleteRes.res.headers.getSetCookie().join(' | ');
      assert.match(set, /access_token=;/);
      assert.match(set, /refresh_token=;/);
    });

    it('anonymizes the row and removes everything sign-in related', async () => {
      const row = await prisma.user.findUniqueOrThrow({ where: { id: fx.users.admin2 } });
      assert.strictEqual(row.name, 'Deleted user');
      assert.strictEqual(row.email, `deleted-${fx.users.admin2}@deleted.invalid`);
      assert.ok(row.deletedAt);
      assert.deepEqual([row.avatarUrl, row.avatarType, row.avatarPresetKey, row.isEmailVerified], [null, 'INITIALS', null, false]);
      const mine = { userId: fx.users.admin2 };
      assert.deepEqual(
        await Promise.all([prisma.userSession.count({ where: mine }), prisma.userPasswordResetToken.count({ where: mine }), prisma.userOtpVerification.count({ where: mine }), prisma.workspaceMember.count({ where: mine }), prisma.projectMember.count({ where: mine }), prisma.aiConversation.count({ where: mine }), prisma.notification.count({ where: { recipientId: fx.users.admin2 } })]),
        [0, 0, 0, 0, 0, 0, 0],
      );
      assert.strictEqual(await prisma.workspaceInvitation.count({ where: { email: emailOf('admin2') } }), 0, 'invitations to their email are gone');
    });

    it('cannot sign in again and the old cookie is dead', async () => {
      assert.strictEqual((await call('admin2', 'GET', '/auth/me')).status, 401);
      const old = await fetch(`${base}/auth/login`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email: emailOf('admin2'), password: PASSWORD }) });
      assert.strictEqual(old.status, 401);
      const byNewEmail = await fetch(`${base}/auth/login`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email: `deleted-${fx.users.admin2}@deleted.invalid`, password: PASSWORD }) });
      assert.strictEqual(byNewEmail.status, 401);
      assert.strictEqual((await call('admin2', 'DELETE', '/users/me', { password: PASSWORD })).status, 401, 'deleting twice is refused, not repeated');
    });

    it('keeps the team history: authored tasks, comments and the audit trail', async () => {
      const task = await prisma.task.findUniqueOrThrow({ where: { id: authoredTask.id } });
      assert.strictEqual(task.authorId, fx.users.admin2);
      assert.strictEqual(task.deletedAt, null);
      const comments = await prisma.taskComment.findMany({ where: { taskId: authoredTask.id } });
      assert.deepEqual(comments.map((c) => [c.authorId, c.content]), [[fx.users.admin2, 'My comment stays.']]);
      assert.ok((await prisma.auditLog.count({ where: { actorUserId: fx.users.admin2 } })) >= auditBefore + 1, 'earlier audit rows stay, and USER_DELETED is added');
      assert.strictEqual(await prisma.auditLog.count({ where: { actorUserId: fx.users.admin2, action: 'USER_DELETED' } }), 1);
      const read = await call('owner', 'GET', `/tasks/${authoredTask.id}`);
      assert.strictEqual(read.status, 200);
      assert.strictEqual(read.json.data.author?.name ?? read.json.data.task?.author?.name, 'Deleted user');
    });

    it('gives their assigned work back as unassigned', async () => {
      assert.strictEqual((await prisma.task.findUniqueOrThrow({ where: { id: assignedTask.id } })).assigneeId, null);
    });

    it('rewrites their name inside other people\'s notifications', async () => {
      const mine = await prisma.notification.findMany({ where: { recipientId: fx.users.memberA, actorId: fx.users.admin2 } });
      assert.ok(mine.length >= 1, 'memberA was told about the task admin2 assigned');
      for (const n of mine) assert.strictEqual((n.data as any).actorName, 'Deleted user');
    });

    it('leaves everyone else untouched, and frees the email', async () => {
      assert.strictEqual((await call('memberb', 'GET', '/auth/me')).status, 200);
      assert.strictEqual(await prisma.workspaceMember.count({ where: { workspaceId: fx.workspaceA } }), 3, 'owner, memberA and memberB are still members');
      const again = await prisma.user.create({ data: { email: emailOf('admin2'), name: 'Someone new', passwordHash: 'x', isEmailVerified: false } });
      assert.notStrictEqual(again.id, fx.users.admin2);
      await prisma.user.delete({ where: { id: again.id } });
    });
  });
});
