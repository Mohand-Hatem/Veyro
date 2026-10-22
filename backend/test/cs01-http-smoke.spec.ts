import 'dotenv/config';
import 'reflect-metadata';
import { describe, it, before, after } from 'node:test';
import * as assert from 'node:assert/strict';
import { NestFactory } from '@nestjs/core';
import { ValidationPipe, INestApplication } from '@nestjs/common';
import cookieParser from 'cookie-parser';
import { AppModule } from '../src/app.module';
import { TransformInterceptor } from '../src/common/interceptors/transform.interceptor';
import { AllExceptionsFilter } from '../src/common/filters/http-exception.filter';
import { PrismaService } from '../src/prisma/prisma.service';
import { buildFixture, Fixture } from './helpers/fixture';

/**
 * End-to-end smoke test of the real HTTP stack (guards, validation pipe, envelopes) for CS-01.
 * It boots the application exactly like main.ts and talks to it with fetch + the auth cookie.
 */
describe('CS-01: HTTP smoke test (real app, real guards)', () => {
  let app: INestApplication;
  let base: string;
  let prisma: PrismaService;
  let fx: Fixture;

  const login = async (email: string) => {
    const res = await fetch(`${base}/auth/login`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email, password: 'Password123!' }),
    });
    assert.strictEqual(res.status, 200, 'login must succeed for fixture users');
    return res.headers.getSetCookie().map((c) => c.split(';')[0]).join('; ');
  };
  const call = async (cookie: string, method: string, path: string, body?: object) => {
    const res = await fetch(`${base}${path}`, {
      method,
      headers: { cookie, 'content-type': 'application/json' },
      body: body ? JSON.stringify(body) : undefined,
    });
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
  });

  after(async () => {
    try {
      await fx.cleanup();
    } finally {
      await app.close();
    }
  });

  it('GET /workspaces/:id/dashboard returns the enveloped read model for an Admin', async () => {
    const ck = await login(`owner.${fx.run}@veyro-test.io`);
    const { status, json } = await call(ck, 'GET', `/workspaces/${fx.workspaceA}/dashboard`);
    assert.strictEqual(status, 200);
    assert.strictEqual(json.success, true);
    assert.deepEqual(json.data.projects.map((p: any) => p.key).sort(), ['ALP', 'BET']);
    assert.ok(json.data.workload, 'admin sees workload');
  });

  it('a Member gets a scoped dashboard without admin-only blocks', async () => {
    const ck = await login(`membera.${fx.run}@veyro-test.io`);
    const { status, json } = await call(ck, 'GET', `/workspaces/${fx.workspaceA}/dashboard`);
    assert.strictEqual(status, 200);
    assert.deepEqual(json.data.projects.map((p: any) => p.key), ['ALP']);
    assert.strictEqual(json.data.workload, null);
    assert.strictEqual(json.data.capacity, null);
  });

  it('an outsider is refused (403) and an unauthenticated call is 401', async () => {
    const ck = await login(`outsider.${fx.run}@veyro-test.io`);
    assert.strictEqual((await call(ck, 'GET', `/workspaces/${fx.workspaceA}/dashboard`)).status, 403);
    assert.strictEqual((await call('', 'GET', `/workspaces/${fx.workspaceA}/dashboard`)).status, 401);
  });

  it('POST projects: key is validated by the pipe and duplicates return 409 PROJECT_KEY_TAKEN', async () => {
    const ck = await login(`owner.${fx.run}@veyro-test.io`);
    const ok = await call(ck, 'POST', `/workspaces/${fx.workspaceA}/projects`, { name: 'Smoke Project', key: 'SMK' });
    assert.strictEqual(ok.status, 201);
    assert.strictEqual(ok.json.data.key, 'SMK');
    const dup = await call(ck, 'POST', `/workspaces/${fx.workspaceA}/projects`, { name: 'Smoke Two', key: 'SMK' });
    assert.strictEqual(dup.status, 409);
    assert.strictEqual(dup.json.error.code, 'PROJECT_KEY_TAKEN', 'domain error codes must reach the client');
    const bad = await call(ck, 'POST', `/workspaces/${fx.workspaceA}/projects`, { name: 'Smoke Bad', key: '1x' });
    assert.strictEqual(bad.status, 400);
  });

  it('invitations: a Member cannot invite (403); an Admin can invite with projectIds', async () => {
    const member = await login(`membera.${fx.run}@veyro-test.io`);
    const denied = await call(member, 'POST', `/workspaces/${fx.workspaceA}/invitations`, { email: `n1.${fx.run}@veyro-test.io`, role: 'MEMBER' });
    assert.strictEqual(denied.status, 403);

    const admin = await login(`admin2.${fx.run}@veyro-test.io`);
    const ok = await call(admin, 'POST', `/workspaces/${fx.workspaceA}/invitations`, { email: `n2.${fx.run}@veyro-test.io`, role: 'MEMBER', projectIds: [fx.projectA1] });
    assert.strictEqual(ok.status, 201);
    assert.deepEqual(ok.json.data.projectIds, [fx.projectA1]);
  });

  it('audit-logs: a Member naming the workspace gets 403; an Admin gets 200', async () => {
    const member = await login(`membera.${fx.run}@veyro-test.io`);
    assert.strictEqual((await call(member, 'GET', `/audit-logs?workspaceId=${fx.workspaceA}`)).status, 403);
    const admin = await login(`admin2.${fx.run}@veyro-test.io`);
    assert.strictEqual((await call(admin, 'GET', `/audit-logs?workspaceId=${fx.workspaceA}`)).status, 200);
  });
});
