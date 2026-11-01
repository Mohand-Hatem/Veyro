import 'dotenv/config';
import 'reflect-metadata';
import { describe, it, before, after } from 'node:test';
import * as assert from 'node:assert/strict';
import { NestFactory } from '@nestjs/core';
import { ValidationPipe, INestApplication } from '@nestjs/common';
import cookieParser from 'cookie-parser';
import { AppModule } from '../src/app.module';
import { NotificationsService } from '../src/modules/notifications/notifications.service';
import { CloudinaryService } from '../src/modules/storage/cloudinary.service';
import { TransformInterceptor } from '../src/common/interceptors/transform.interceptor';
import { AllExceptionsFilter } from '../src/common/filters/http-exception.filter';
import { PrismaService } from '../src/prisma/prisma.service';
import { buildFixture, Fixture } from './helpers/fixture';

const SECRET = 'jobs-test-secret-0123456789';

/** Step 6.4: the daily cleanup endpoint, through the real app (real guards, real database). */
describe('6.4: daily jobs (real app, real guards)', () => {
  let app: INestApplication;
  let base: string;
  let prisma: PrismaService;
  let fx: Fixture;
  let notifications: NotificationsService;
  const previousSecret = process.env.CRON_SECRET;

  const run = (authorization?: string) => fetch(`${base}/jobs/daily`, { headers: authorization ? { authorization } : {} });

  before(async () => {
    process.env.CRON_SECRET = SECRET;
    app = await NestFactory.create(AppModule, { logger: false });
    app.use(cookieParser());
    app.setGlobalPrefix('api/v1');
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true, forbidNonWhitelisted: true, transformOptions: { enableImplicitConversion: true } }));
    app.useGlobalInterceptors(new TransformInterceptor());
    app.useGlobalFilters(new AllExceptionsFilter());
    await app.listen(0);
    base = `${await app.getUrl()}/api/v1`.replace('[::1]', 'localhost');
    prisma = app.get(PrismaService);
    notifications = app.get(NotificationsService);
    fx = await buildFixture(prisma);
  });

  after(async () => {
    if (previousSecret === undefined) delete process.env.CRON_SECRET;
    else process.env.CRON_SECRET = previousSecret;
    try {
      await fx.cleanup();
    } finally {
      await app.close();
    }
  });

  describe('who may call it', () => {
    it('is closed to everyone when no secret is configured', async () => {
      delete process.env.CRON_SECRET;
      try {
        const res = await run(`Bearer ${SECRET}`);
        assert.strictEqual(res.status, 503);
        assert.strictEqual(((await res.json()) as any).error.code, 'CRON_NOT_CONFIGURED');
      } finally {
        process.env.CRON_SECRET = SECRET;
      }
    });

    it('is closed when the configured secret is too short to be one', async () => {
      process.env.CRON_SECRET = 'short';
      try {
        assert.strictEqual((await run('Bearer short')).status, 503);
      } finally {
        process.env.CRON_SECRET = SECRET;
      }
    });

    it('refuses a missing, a wrong and a nearly right secret', async () => {
      for (const header of [undefined, 'Bearer wrong', SECRET, `Bearer ${SECRET}x`, `bearer ${SECRET}`]) {
        const res = await run(header);
        assert.strictEqual(res.status, 401, String(header));
        assert.strictEqual(((await res.json()) as any).error.code, 'INVALID_CRON_SECRET');
      }
    });

    it('does not accept a signed-in user instead of the secret', async () => {
      const login = await fetch(`${base}/auth/login`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email: `owner.${fx.run}@veyro-test.io`, password: 'Password123!' }) });
      assert.strictEqual(login.status, 200);
      const cookie = login.headers.getSetCookie().map((c) => c.split(';')[0]).join('; ');
      assert.strictEqual((await fetch(`${base}/jobs/daily`, { headers: { cookie } })).status, 401);
    });
  });

  describe('what it does', () => {
    it('runs with the right secret and reports every job', async () => {
      const res = await run(`Bearer ${SECRET}`);
      assert.strictEqual(res.status, 200);
      const data = ((await res.json()) as any).data;
      assert.deepStrictEqual(Object.keys(data).sort(), ['accounts', 'avatars', 'expired', 'notifications', 'tasks']);
      assert.ok(Number.isInteger(data.notifications.deleted));
    });

    it('deletes only notifications older than 90 days, and a second run deletes none of the rest', async () => {
      const mk = (daysAgo: number) =>
        prisma.notification.create({ data: { recipientId: fx.users.memberA, workspaceId: fx.workspaceA, type: 'TASK_ASSIGNED', data: {}, createdAt: new Date(Date.now() - daysAgo * 86_400_000) } });
      const [old, recent] = await Promise.all([mk(100), mk(10)]);
      const first = ((await (await run(`Bearer ${SECRET}`)).json()) as any).data.notifications.deleted;
      assert.ok(first >= 1);
      assert.strictEqual(await prisma.notification.count({ where: { id: old.id } }), 0, 'the 100-day-old one is gone');
      assert.strictEqual(await prisma.notification.count({ where: { id: recent.id } }), 1, 'the 10-day-old one stays');
      const second = ((await (await run(`Bearer ${SECRET}`)).json()) as any).data.notifications.deleted;
      assert.strictEqual(second, 0, 'running it twice is safe');
    });

    it('lets one failing job fail alone', async () => {
      const original = notifications.purgeOlderThan;
      notifications.purgeOlderThan = async () => {
        throw new Error('simulated outage');
      };
      try {
        const res = await run(`Bearer ${SECRET}`);
        assert.strictEqual(res.status, 200);
        const data = ((await res.json()) as any).data;
        assert.deepStrictEqual(data.notifications, { error: 'simulated outage' });
        assert.ok('purged' in data.avatars && 'purged' in data.accounts, 'the other jobs still ran');
      } finally {
        notifications.purgeOlderThan = original;
      }
    });

    it('purges tasks deleted more than 30 days ago with their comments and files, audits it, and keeps the rest', async () => {
      const day = 86_400_000;
      const mk = (title: string, deletedDaysAgo: number | null) =>
        prisma.task.create({ data: { projectId: fx.projectA1, title: `${title} ${fx.run}`, authorId: fx.users.owner, deletedAt: deletedDaysAgo === null ? null : new Date(Date.now() - deletedDaysAgo * day) } });
      const [old, recent, live] = await Promise.all([mk('old', 31), mk('recent', 10), mk('live', null)]);
      await prisma.taskComment.create({ data: { taskId: old.id, authorId: fx.users.owner, content: 'gone with the task' } });
      await prisma.taskAttachment.create({ data: { taskId: old.id, publicId: `tasks/purge-${fx.run}`, resourceType: 'raw', format: 'pdf', fileName: 'brief.pdf', bytes: 10 } });

      const storage = app.get(CloudinaryService);
      const original = storage.destroyAttachment;
      const destroyed: string[] = [];
      storage.destroyAttachment = async (publicId) => { destroyed.push(publicId); };
      try {
        const data = ((await (await run(`Bearer ${SECRET}`)).json()) as any).data;
        assert.ok(data.tasks.purged >= 1, JSON.stringify(data.tasks));
        assert.strictEqual(await prisma.task.count({ where: { id: old.id } }), 0, 'the task deleted 31 days ago is gone');
        assert.strictEqual(await prisma.taskComment.count({ where: { taskId: old.id } }), 0, 'with its comments');
        assert.strictEqual(await prisma.taskAttachment.count({ where: { taskId: old.id } }), 0, 'and its file rows');
        assert.ok(destroyed.includes(`tasks/purge-${fx.run}`), 'and the file itself on Cloudinary');
        assert.strictEqual(await prisma.auditLog.count({ where: { taskId: old.id, action: 'TASK_PURGED' } }), 1, 'the history says so once');
        assert.strictEqual(await prisma.task.count({ where: { id: { in: [recent.id, live.id] } } }), 2, 'a task still in its restore window and a live one stay');

        const second = ((await (await run(`Bearer ${SECRET}`)).json()) as any).data;
        assert.strictEqual(await prisma.auditLog.count({ where: { taskId: old.id, action: 'TASK_PURGED' } }), 1, 'a second run adds no history');
        assert.ok(Number.isInteger(second.tasks.purged));
      } finally {
        storage.destroyAttachment = original;
      }
    });

    it('deletes invitations, sessions, sign-up codes and reset links 30 days after they expired, and nothing newer or accepted', async () => {
      const ago = (days: number) => new Date(Date.now() - days * 86_400_000);
      const invite = (key: string, status: 'PENDING' | 'ACCEPTED' | 'REVOKED', expiredDaysAgo: number) =>
        prisma.workspaceInvitation.create({ data: { workspaceId: fx.workspaceA, inviterId: fx.users.owner, email: `${key}.${fx.run}@veyro-test.io`, hashedToken: `inv-${key}-${fx.run}`, status, expiresAt: ago(expiredDaysAgo) } });
      const [oldPending, oldRevoked, oldAccepted, recentPending] = await Promise.all([invite('old-p', 'PENDING', 40), invite('old-r', 'REVOKED', 40), invite('old-a', 'ACCEPTED', 40), invite('new-p', 'PENDING', 10)]);
      const session = (key: string, expiredDaysAgo: number) =>
        prisma.userSession.create({ data: { userId: fx.users.memberA, hashedToken: `ses-${key}-${fx.run}`, familyId: `fam-${fx.run}`, expiresAt: ago(expiredDaysAgo) } });
      const [oldSession, recentSession] = await Promise.all([session('old', 40), session('new', 10)]);
      const otp = (expiredDaysAgo: number) =>
        prisma.userOtpVerification.create({ data: { userId: fx.users.memberA, email: `otp.${fx.run}@veyro-test.io`, codeHash: 'x', expiresAt: ago(expiredDaysAgo), resendAvailableAt: ago(expiredDaysAgo) } });
      const [oldOtp, recentOtp] = await Promise.all([otp(40), otp(10)]);
      const reset = (key: string, expiredDaysAgo: number) =>
        prisma.userPasswordResetToken.create({ data: { userId: fx.users.memberA, tokenHash: `rst-${key}-${fx.run}`, expiresAt: ago(expiredDaysAgo) } });
      const [oldReset, recentReset] = await Promise.all([reset('old', 40), reset('new', 10)]);

      const data = ((await (await run(`Bearer ${SECRET}`)).json()) as any).data;
      assert.ok(data.expired.invitations >= 2 && data.expired.sessions >= 1 && data.expired.signupCodes >= 1 && data.expired.resetLinks >= 1, JSON.stringify(data.expired));
      assert.strictEqual(await prisma.workspaceInvitation.count({ where: { id: { in: [oldPending.id, oldRevoked.id] } } }), 0, 'old pending and revoked invitations are gone');
      assert.strictEqual(await prisma.workspaceInvitation.count({ where: { id: { in: [oldAccepted.id, recentPending.id] } } }), 2, 'an accepted one and a recent one stay');
      assert.strictEqual(await prisma.userSession.count({ where: { id: { in: [oldSession.id, recentSession.id] } } }), 1);
      assert.strictEqual(await prisma.userSession.count({ where: { id: recentSession.id } }), 1, 'the recent session stays');
      assert.strictEqual(await prisma.userOtpVerification.count({ where: { id: { in: [oldOtp.id, recentOtp.id] } } }), 1);
      assert.strictEqual(await prisma.userOtpVerification.count({ where: { id: recentOtp.id } }), 1, 'the recent sign-up code stays');
      assert.strictEqual(await prisma.userPasswordResetToken.count({ where: { id: { in: [oldReset.id, recentReset.id] } } }), 1);
      assert.strictEqual(await prisma.userPasswordResetToken.count({ where: { id: recentReset.id } }), 1, 'the recent reset link stays');
    });

    it('purges an account that was deleted from Billing, and leaves every other account alone', async () => {
      const login = await fetch(`${base}/auth/login`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email: `outsider.${fx.run}@veyro-test.io`, password: 'Password123!' }) });
      const cookie = login.headers.getSetCookie().map((c) => c.split(';')[0]).join('; ');
      const accountB = (await prisma.account.findFirstOrThrow({ where: { slug: `acct-b-${fx.run}` } })).id;
      const off = await fetch(`${base}/accounts/${accountB}/offboard`, { method: 'POST', headers: { cookie, 'content-type': 'application/json' }, body: JSON.stringify({ passwordConfirmation: 'Password123!', slugConfirmation: `acct-b-${fx.run}` }) });
      assert.strictEqual(off.status, 202);
      assert.strictEqual((await prisma.account.findUniqueOrThrow({ where: { id: accountB } })).offboardingState, 'PENDING');

      const data = ((await (await run(`Bearer ${SECRET}`)).json()) as any).data;
      assert.ok(data.accounts.purged >= 1, JSON.stringify(data.accounts));
      assert.strictEqual(await prisma.account.count({ where: { id: accountB } }), 0, 'the account is gone');
      assert.strictEqual(await prisma.workspace.count({ where: { id: fx.workspaceB } }), 0, 'and its workspace');
      assert.strictEqual(await prisma.account.count({ where: { id: fx.accountA } }), 1, 'the other account is untouched');
      assert.strictEqual(await prisma.workspace.count({ where: { id: fx.workspaceA } }), 1);
    });
  });
});
