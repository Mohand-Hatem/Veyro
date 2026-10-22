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
 * CS-09 / ADR-016: the signed-in person's profile (identity, preferences, footprint), name and preference updates,
 * and the authenticated password change.
 */
describe('CS-09: profile, preferences and password change', () => {
  let app: INestApplication;
  let base: string;
  let prisma: PrismaService;
  let fx: Fixture;
  const cookies: Record<string, string> = {};
  const code = (r: { json: any }) => r.json?.error?.code ?? r.json?.code ?? r.json?.data?.code;

  const rawLogin = async (label: string, password = 'Password123!') =>
    fetch(`${base}/auth/login`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email: `${label}.${fx.run}@veyro-test.io`, password }) });
  const login = async (label: string, password = 'Password123!') => {
    const res = await rawLogin(label, password);
    assert.strictEqual(res.status, 200, `login ${label}`);
    return res.headers.getSetCookie().map((c) => c.split(';')[0]).join('; ');
  };
  const call = async (who: string, method: string, path: string, body?: object) => {
    const res = await fetch(`${base}${path}`, { method, headers: { cookie: cookies[who], 'content-type': 'application/json' }, body: body ? JSON.stringify(body) : undefined });
    return { status: res.status, json: (await res.json().catch(() => ({}))) as any };
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
    for (const l of ['owner', 'membera', 'memberb']) cookies[l] = await login(l);
    const t = (title: string, extra: object) => prisma.task.create({ data: { projectId: fx.projectA1, title, authorId: fx.users.owner, assigneeId: fx.users.memberA, ...extra } });
    await t('Open one', {});
    await t('Open two', { status: TaskStatus.IN_PROGRESS });
    await t('Finished', { status: TaskStatus.DONE, completedAt: new Date() });
    await t('Deleted', { deletedAt: new Date() });
  });

  after(async () => {
    try {
      await fx.cleanup();
    } finally {
      await app.close();
    }
  });

  describe('GET /users/me/profile', () => {
    it('returns identity, default preferences and the footprint of the caller', async () => {
      const r = await call('membera', 'GET', '/users/me/profile');
      assert.strictEqual(r.status, 200);
      const d = r.json.data;
      assert.strictEqual(d.email, `membera.${fx.run}@veyro-test.io`);
      assert.deepEqual(d.preferences, { locale: 'EN', theme: 'SYSTEM' });
      assert.deepEqual(d.stats, { workspaces: 1, projects: 1, openTasks: 2, ownedAccounts: 0 });
      assert.deepEqual([d.workspaces[0].role, d.workspaces[0].projectCount, d.workspaces[0].isAccountOwner], ['MEMBER', 1, false]);
      assert.strictEqual(d.workspaces[0].account.plan, null, 'a member never sees the account plan');
      assert.deepEqual([d.aiSubscription.tier, d.aiSubscription.dailyQuota], ['FREE', 3]);
      assert.ok(!('passwordHash' in d));
    });

    it('shows the account plan only to the account owner', async () => {
      const d = (await call('owner', 'GET', '/users/me/profile')).json.data;
      assert.deepEqual(d.stats, { workspaces: 1, projects: 1, openTasks: 0, ownedAccounts: 1 });
      assert.strictEqual(d.workspaces[0].isAccountOwner, true);
      assert.deepEqual([d.workspaces[0].account.plan.tier, d.workspaces[0].account.plan.status], ['PRO', 'ACTIVE']);
    });

    it('counts only projects the person belongs to, and nothing for a member without projects', async () => {
      const d = (await call('memberb', 'GET', '/users/me/profile')).json.data;
      assert.deepEqual(d.stats, { workspaces: 1, projects: 0, openTasks: 0, ownedAccounts: 0 });
    });
  });

  describe('PATCH /users/me', () => {
    it('updates the name (trimmed) and the preferences, and the profile reflects them', async () => {
      const r = await call('membera', 'PATCH', '/users/me', { name: '  Mona Younis  ', locale: 'AR', theme: 'DARK' });
      assert.strictEqual(r.status, 200);
      assert.deepEqual([r.json.data.name, r.json.data.preferences], ['Mona Younis', { locale: 'AR', theme: 'DARK' }]);
      const d = (await call('membera', 'GET', '/users/me/profile')).json.data;
      assert.deepEqual([d.name, d.preferences.locale, d.preferences.theme], ['Mona Younis', 'AR', 'DARK']);
      assert.strictEqual((await call('membera', 'PATCH', '/users/me', { theme: 'LIGHT' })).json.data.name, 'Mona Younis', 'a partial update keeps the rest');
    });

    it('rejects bad input and fields that are not editable here', async () => {
      assert.strictEqual((await call('membera', 'PATCH', '/users/me', { name: 'A' })).status, 400);
      assert.strictEqual((await call('membera', 'PATCH', '/users/me', { locale: 'FR' })).status, 400);
      assert.strictEqual((await call('membera', 'PATCH', '/users/me', { theme: 'NEON' })).status, 400);
      const none = await call('membera', 'PATCH', '/users/me', {});
      assert.strictEqual(none.status, 400);
      assert.strictEqual(code(none), 'NO_PROFILE_CHANGES');
      for (const field of [{ avatarUrl: 'https://x.test/a.png' }, { email: 'x@y.io' }, { passwordHash: 'x' }]) {
        assert.strictEqual((await call('membera', 'PATCH', '/users/me', field)).status, 400, JSON.stringify(field));
      }
    });

    it('only ever touches the caller', async () => {
      await call('memberb', 'PATCH', '/users/me', { name: 'Only Me' });
      const other = await prisma.user.findUniqueOrThrow({ where: { id: fx.users.memberA } });
      assert.strictEqual(other.name, 'Mona Younis');
    });
  });

  describe('POST /auth/change-password', () => {
    it('checks the current password, the rule and that the password really changes', async () => {
      const wrong = await call('owner', 'POST', '/auth/change-password', { currentPassword: 'Nope12345!', newPassword: 'Brand-New-9' });
      assert.strictEqual(wrong.status, 401);
      assert.strictEqual(code(wrong), 'INVALID_CURRENT_PASSWORD');
      const same = await call('owner', 'POST', '/auth/change-password', { currentPassword: 'Password123!', newPassword: 'Password123!' });
      assert.strictEqual(same.status, 400);
      assert.strictEqual(code(same), 'PASSWORD_UNCHANGED');
      assert.strictEqual((await call('owner', 'POST', '/auth/change-password', { currentPassword: 'Password123!', newPassword: 'weak' })).status, 400);
      assert.strictEqual((await call('owner', 'POST', '/auth/change-password', { newPassword: 'Brand-New-9' })).status, 400);
    });

    it('changes it, signs the other sessions out at once, keeps this one, and audits it', async () => {
      cookies.ownerOther = await login('owner'); // a second device
      assert.strictEqual((await call('ownerOther', 'GET', '/users/me/profile')).status, 200);

      const ok = await call('owner', 'POST', '/auth/change-password', { currentPassword: 'Password123!', newPassword: 'Brand-New-9' });
      assert.strictEqual(ok.status, 200);
      assert.ok(ok.json.data.otherSessionsRevoked >= 1);

      assert.strictEqual((await call('ownerOther', 'GET', '/users/me/profile')).status, 401, 'the other device is signed out immediately');
      assert.strictEqual((await call('owner', 'GET', '/users/me/profile')).status, 200, 'this session continues');
      assert.strictEqual((await rawLogin('owner', 'Password123!')).status, 401, 'the old password no longer works');
      assert.strictEqual((await rawLogin('owner', 'Brand-New-9')).status, 200, 'the new one does');
      const log = await prisma.auditLog.findFirst({ where: { actorUserId: fx.users.owner, action: 'USER_PASSWORD_CHANGED' } });
      assert.ok(log);
      assert.ok(!JSON.stringify(log.metadata).includes('Brand-New-9'), 'no password in the audit record');
    });

    it('needs a signed-in user', async () => {
      const res = await fetch(`${base}/auth/change-password`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ currentPassword: 'a', newPassword: 'Brand-New-9' }) });
      assert.strictEqual(res.status, 401);
    });
  });
});
