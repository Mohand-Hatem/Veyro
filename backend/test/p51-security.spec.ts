import 'dotenv/config';
import 'reflect-metadata';
import { describe, it, before, after } from 'node:test';
import * as assert from 'node:assert/strict';
import { NestFactory } from '@nestjs/core';
import { ValidationPipe, INestApplication } from '@nestjs/common';
import cookieParser from 'cookie-parser';
import { AppModule } from '../src/app.module';
import { validateEnv } from '../src/config/env.validation';
import { TransformInterceptor } from '../src/common/interceptors/transform.interceptor';
import { AllExceptionsFilter } from '../src/common/filters/http-exception.filter';
import { PrismaService } from '../src/prisma/prisma.service';
import { buildFixture, Fixture } from './helpers/fixture';

/** Step 5.1: security hardening (secret check at boot, cookie-only tokens, rate limits, offboarding lock). */
describe('5.1: secret validation at boot', () => {
  const good = 'x'.repeat(40);
  it('accepts a long random secret', () => {
    assert.doesNotThrow(() => validateEnv({ JWT_SECRET: good }));
  });
  it('rejects a missing, empty or short secret', () => {
    for (const JWT_SECRET of [undefined, '', '   ', 'short-secret']) {
      assert.throws(() => validateEnv({ JWT_SECRET }), /JWT_SECRET/);
    }
  });
  it('rejects the two published placeholders', () => {
    assert.throws(() => validateEnv({ JWT_SECRET: 'veyro-super-secret-dev-key-change-in-prod-12345' }), /placeholder/);
    assert.throws(() => validateEnv({ JWT_SECRET: 'replace-with-a-cryptographically-secure-random-secret-key-min-32-chars' }), /placeholder/);
  });
});

describe('5.5: email settings at boot', () => {
  const base = { JWT_SECRET: 'x'.repeat(40) };
  it('are optional in development and required in production', () => {
    assert.doesNotThrow(() => validateEnv({ ...base, NODE_ENV: 'development' }));
    assert.throws(() => validateEnv({ ...base, NODE_ENV: 'production' }), /RESEND_API_KEY/);
    assert.throws(() => validateEnv({ ...base, NODE_ENV: 'production', RESEND_API_KEY: 're_x' }), /EMAIL_FROM/);
  });
  it('refuse the Resend test sender in production', () => {
    assert.throws(() => validateEnv({ ...base, NODE_ENV: 'production', RESEND_API_KEY: 're_x', EMAIL_FROM: 'Veyro <onboarding@resend.dev>' }), /test sender/);
    const stripe = { STRIPE_SECRET_KEY: 'sk_live_x', STRIPE_WEBHOOK_SECRET: 'whsec_x', STRIPE_PRICE_ID_PRO: 'p', STRIPE_PRICE_ID_ENTERPRISE: 'e', STRIPE_PRICE_ID_EPIC: 'x', GEMINI_API_KEY: 'k', CLOUDINARY_CLOUD_NAME: 'c', CLOUDINARY_API_KEY: 'k', CLOUDINARY_API_SECRET: 's' };
    assert.doesNotThrow(() => validateEnv({ ...base, ...stripe, NODE_ENV: 'production', RESEND_API_KEY: 're_x', EMAIL_FROM: 'Veyro <noreply@veyro.app>' }));
  });
});

describe('5.1: auth over HTTP (real app, real guards)', () => {
  let app: INestApplication;
  let base: string;
  let prisma: PrismaService;
  let fx: Fixture;

  const post = (path: string, body: object, headers: Record<string, string> = {}) =>
    fetch(`${base}${path}`, { method: 'POST', headers: { 'content-type': 'application/json', ...headers }, body: JSON.stringify(body) });

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

  it('login sets httpOnly cookies and keeps the access token out of the body', async () => {
    const res = await post('/auth/login', { email: `owner.${fx.run}@veyro-test.io`, password: 'Password123!' });
    assert.strictEqual(res.status, 200);
    const body = (await res.json()) as any;
    assert.ok(body.data.user.id);
    assert.strictEqual(body.data.accessToken, undefined);
    const cookies = res.headers.getSetCookie();
    for (const name of ['access_token', 'refresh_token']) {
      const c = cookies.find((x) => x.startsWith(`${name}=`));
      assert.ok(c && /HttpOnly/i.test(c) && /SameSite=Lax/i.test(c), `${name} must be an httpOnly SameSite=Lax cookie`);
    }
  });

  it('limits login to 10 attempts a minute per client (the 11th is refused with 429)', async () => {
    // One login already happened in the test above, so 9 more are allowed.
    const statuses: number[] = [];
    for (let i = 0; i < 3; i++) statuses.push((await post('/auth/login', { email: 'nobody@veyro-test.io', password: 'Wrong-password1!' })).status);
    assert.deepStrictEqual(statuses, [401, 401, 401]);
    for (let i = 0; i < 6; i++) await post('/auth/login', { email: 'nobody@veyro-test.io', password: 'Wrong-password1!' });
    const blocked = await post('/auth/login', { email: 'nobody@veyro-test.io', password: 'Wrong-password1!' });
    assert.strictEqual(blocked.status, 429);
  });

  it('limits password-reset requests to 5 a minute, and keeps counters per route', async () => {
    const forgot = () => post('/auth/forgot-password', { email: 'nobody@veyro-test.io' });
    for (let i = 0; i < 5; i++) assert.strictEqual((await forgot()).status, 200);
    assert.strictEqual((await forgot()).status, 429);
    // The exhausted login counter does not spill into other routes, and the other way round.
    const resend = await post('/auth/otp/resend', { email: 'nobody@veyro-test.io' });
    assert.notStrictEqual(resend.status, 429);
  });

  it('locks select-active-projects while the account is being offboarded', async () => {
    await prisma.account.update({ where: { id: fx.accountA }, data: { offboardingState: 'PENDING' } });
    // Login is exhausted for this client, so sign the session cookie by hand from the service instead of calling /login.
    const auth = app.get((await import('../src/modules/auth/auth.service')).AuthService);
    const session = await auth.login({ email: `owner.${fx.run}@veyro-test.io`, password: 'Password123!' });
    const res = await post(`/accounts/${fx.accountA}/select-active-projects`, { activeProjectIds: [fx.projectA1] }, { cookie: `access_token=${session.accessToken}` });
    assert.strictEqual(res.status, 403);
    assert.strictEqual(((await res.json()) as any).error.code, 'ACCOUNT_OFFBOARDING_LOCKED');
  });
});
