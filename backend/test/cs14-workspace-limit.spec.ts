import 'dotenv/config';
import 'reflect-metadata';
import { describe, it, before, after } from 'node:test';
import * as assert from 'node:assert/strict';
import { NestFactory } from '@nestjs/core';
import { ValidationPipe, INestApplication } from '@nestjs/common';
import cookieParser from 'cookie-parser';
import { SubscriptionPlanTier } from '@prisma/client';
import { AppModule } from '../src/app.module';
import { TransformInterceptor } from '../src/common/interceptors/transform.interceptor';
import { AllExceptionsFilter } from '../src/common/filters/http-exception.filter';
import { PrismaService } from '../src/prisma/prisma.service';
import { buildFixture, Fixture } from './helpers/fixture';

/** CS-14 / BR-SUB-02: creating a workspace is checked against the plan (Free 1, Pro 3, Enterprise 10, Epic unlimited). */
describe('CS-14: workspace plan limit', () => {
  let app: INestApplication;
  let base: string;
  let prisma: PrismaService;
  let fx: Fixture;
  const cookies: Record<string, string> = {};

  const login = async (email: string) => {
    const res = await fetch(`${base}/auth/login`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email, password: 'Password123!' }) });
    assert.strictEqual(res.status, 200, `login ${email}`);
    return res.headers.getSetCookie().map((c) => c.split(';')[0]).join('; ');
  };
  const create = async (who: string, name: string, slug: string) => {
    const res = await fetch(`${base}/accounts/${fx.accountA}/workspaces`, { method: 'POST', headers: { 'content-type': 'application/json', cookie: cookies[who] }, body: JSON.stringify({ name, slug }) });
    return { status: res.status, json: (await res.json().catch(() => ({}))) as any };
  };
  const setTier = (tier: SubscriptionPlanTier) => prisma.accountSubscription.update({ where: { accountId: fx.accountA }, data: { tier } });

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
    fx = await buildFixture(prisma, SubscriptionPlanTier.FREE);
    cookies.owner = await login(`owner.${fx.run}@veyro-test.io`);
    cookies.admin2 = await login(`admin2.${fx.run}@veyro-test.io`);
  });

  after(async () => {
    try {
      // the workspaces this test created are not known to the fixture
      const extra = (await prisma.workspace.findMany({ where: { accountId: fx.accountA, slug: { startsWith: `cs14-${fx.run}` } }, select: { id: true } })).map((w) => w.id);
      await prisma.auditLog.deleteMany({ where: { workspaceId: { in: extra } } });
      await prisma.workspaceMember.deleteMany({ where: { workspaceId: { in: extra } } });
      await prisma.workspace.deleteMany({ where: { id: { in: extra } } });
      await fx.cleanup();
    } finally {
      await app.close();
    }
  });

  it('refuses the second workspace on the Free plan', async () => {
    const r = await create('owner', 'Second', `cs14-${fx.run}-a`);
    assert.strictEqual(r.status, 403, JSON.stringify(r.json));
    assert.strictEqual(r.json.error.code, 'WORKSPACE_CAPACITY_EXCEEDED');
    assert.strictEqual(await prisma.workspace.count({ where: { accountId: fx.accountA } }), 1);
  });

  it('allows it on Pro, makes the owner its admin, and refuses the fourth', async () => {
    await setTier(SubscriptionPlanTier.PRO);
    const ok = await create('owner', 'Second', `cs14-${fx.run}-a`);
    assert.strictEqual(ok.status, 201, JSON.stringify(ok.json));
    const member = await prisma.workspaceMember.findFirst({ where: { workspaceId: ok.json.data.id }, select: { role: true } });
    assert.strictEqual(member?.role, 'ADMIN');
    assert.strictEqual((await create('owner', 'Third', `cs14-${fx.run}-b`)).status, 201);
    const fourth = await create('owner', 'Fourth', `cs14-${fx.run}-c`);
    assert.strictEqual(fourth.status, 403);
    assert.strictEqual(fourth.json.error.code, 'WORKSPACE_CAPACITY_EXCEEDED');
  });

  it('has no cap on Epic, and an address in use is still a 409', async () => {
    await setTier(SubscriptionPlanTier.EPIC);
    assert.strictEqual((await create('owner', 'Fourth', `cs14-${fx.run}-c`)).status, 201);
    const dup = await create('owner', 'Again', `cs14-${fx.run}-c`);
    assert.strictEqual(dup.status, 409);
    assert.strictEqual(dup.json.error.code, 'WORKSPACE_SLUG_TAKEN');
  });

  it('stays owner-only: a workspace admin who is not the owner gets 403 PERMISSION_DENIED', async () => {
    const r = await create('admin2', 'Sneaky', `cs14-${fx.run}-z`);
    assert.strictEqual(r.status, 403);
    assert.notStrictEqual(r.json.error.code, 'WORKSPACE_CAPACITY_EXCEEDED');
  });
});
