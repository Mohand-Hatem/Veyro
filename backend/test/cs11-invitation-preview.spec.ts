import 'dotenv/config';
import 'reflect-metadata';
import { describe, it, before, after } from 'node:test';
import * as assert from 'node:assert/strict';
import * as bcrypt from 'bcrypt';
import { NestFactory } from '@nestjs/core';
import { ValidationPipe, INestApplication } from '@nestjs/common';
import cookieParser from 'cookie-parser';
import { AppModule } from '../src/app.module';
import { TransformInterceptor } from '../src/common/interceptors/transform.interceptor';
import { AllExceptionsFilter } from '../src/common/filters/http-exception.filter';
import { PrismaService } from '../src/prisma/prisma.service';
import { buildFixture, Fixture } from './helpers/fixture';

/** CS-11 / ADR-018: the read-only invitation preview that the invitation page shows before the person accepts. */
describe('CS-11: invitation preview', () => {
  let app: INestApplication;
  let base: string;
  let prisma: PrismaService;
  let fx: Fixture;
  const cookies: Record<string, string> = {};
  let inviteeId = '';
  let token = '';
  const inviteeEmail = () => `invitee.${fx.run}@veyro-test.io`;

  const login = async (email: string) => {
    const res = await fetch(`${base}/auth/login`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email, password: 'Password123!' }) });
    assert.strictEqual(res.status, 200, `login ${email}`);
    return res.headers.getSetCookie().map((c) => c.split(';')[0]).join('; ');
  };
  const call = async (who: string | null, method: string, path: string, body?: object) => {
    const headers: Record<string, string> = { 'content-type': 'application/json' };
    if (who) headers.cookie = cookies[who];
    const res = await fetch(`${base}${path}`, { method, headers, body: body ? JSON.stringify(body) : undefined });
    return { status: res.status, json: (await res.json().catch(() => ({}))) as any };
  };
  const preview = (who: string | null, t: string) => call(who, 'GET', `/invitations/preview?token=${encodeURIComponent(t)}`);
  const invite = async (email: string) => {
    const r = await call('owner', 'POST', `/workspaces/${fx.workspaceA}/invitations`, { email, role: 'MEMBER' });
    assert.strictEqual(r.status, 201, JSON.stringify(r.json));
    return r.json.data as { invitationId: string; rawToken: string };
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
    const u = await prisma.user.create({ data: { email: inviteeEmail(), name: 'Newcomer', passwordHash: await bcrypt.hash('Password123!', 4), isEmailVerified: true } });
    inviteeId = u.id;
    cookies.owner = await login(`owner.${fx.run}@veyro-test.io`);
    cookies.memberb = await login(`memberb.${fx.run}@veyro-test.io`);
    cookies.invitee = await login(inviteeEmail());
    token = (await invite(inviteeEmail())).rawToken;
  });

  after(async () => {
    try {
      await prisma.workspaceInvitation.deleteMany({ where: { workspaceId: fx.workspaceA } });
      await fx.cleanup();
      await prisma.auditLog.deleteMany({ where: { actorUserId: inviteeId } });
      await prisma.userSession.deleteMany({ where: { userId: inviteeId } });
      await prisma.user.deleteMany({ where: { id: inviteeId } });
    } finally {
      await app.close();
    }
  });

  it('needs a signed-in user (401 without a session)', async () => {
    assert.strictEqual((await preview(null, token)).status, 401);
  });

  it('rejects a missing token with a validation error', async () => {
    const r = await call('invitee', 'GET', '/invitations/preview');
    assert.strictEqual(r.status, 400);
    assert.strictEqual(r.json.error.code, 'VALIDATION_FAILED');
  });

  it('returns 404 for an unknown token', async () => {
    const r = await preview('invitee', 'not-a-real-token');
    assert.strictEqual(r.status, 404);
    assert.strictEqual(r.json.error.code, 'RESOURCE_NOT_FOUND');
  });

  it('shows the invitation details to the invited person', async () => {
    const r = await preview('invitee', token);
    assert.strictEqual(r.status, 200);
    const d = r.json.data;
    assert.strictEqual(d.workspaceName, `WS A ${fx.run}`);
    assert.strictEqual(d.workspaceSlug, `ws-a-${fx.run}`);
    assert.strictEqual(d.inviterName, `owner ${fx.run}`);
    assert.strictEqual(d.role, 'MEMBER');
    assert.strictEqual(d.email, inviteeEmail());
    assert.strictEqual(d.status, 'PENDING');
    assert.strictEqual(d.emailMatches, true);
    assert.ok(new Date(d.expiresAt) > new Date());
    assert.ok(!('hashedToken' in d) && !('id' in d), 'internal fields stay out of the response');
  });

  it('tells a different signed-in user that the email does not match', async () => {
    const r = await preview('memberb', token);
    assert.strictEqual(r.status, 200);
    assert.strictEqual(r.json.data.emailMatches, false);
    assert.strictEqual(r.json.data.email, inviteeEmail());
  });

  it('never changes the invitation, even when it has elapsed', async () => {
    const row = await prisma.workspaceInvitation.findFirstOrThrow({ where: { workspaceId: fx.workspaceA, email: inviteeEmail() } });
    await prisma.workspaceInvitation.update({ where: { id: row.id }, data: { expiresAt: new Date(Date.now() - 60_000) } });
    const r = await preview('invitee', token);
    assert.strictEqual(r.json.data.status, 'EXPIRED');
    const after = await prisma.workspaceInvitation.findUniqueOrThrow({ where: { id: row.id } });
    assert.strictEqual(after.status, 'PENDING', 'the preview is read-only');
  });

  it('reports revoked and accepted invitations as they are', async () => {
    const other = await invite(`later.${fx.run}@veyro-test.io`);
    await prisma.workspaceInvitation.update({ where: { id: other.invitationId }, data: { status: 'REVOKED' } });
    assert.strictEqual((await preview('invitee', other.rawToken)).json.data.status, 'REVOKED');
    await prisma.workspaceInvitation.update({ where: { id: other.invitationId }, data: { status: 'ACCEPTED' } });
    assert.strictEqual((await preview('invitee', other.rawToken)).json.data.status, 'ACCEPTED');
  });
});
