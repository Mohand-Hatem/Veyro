import 'dotenv/config';
import 'reflect-metadata';
import * as bcrypt from 'bcrypt';
import { describe, it, before, after } from 'node:test';
import * as assert from 'node:assert/strict';
import { NestFactory } from '@nestjs/core';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import cookieParser from 'cookie-parser';
import { AppModule } from '../src/app.module';
import { AuthService } from '../src/modules/auth/auth.service';
import { GoogleStrategy } from '../src/modules/auth/strategies/google.strategy';
import { GithubStrategy } from '../src/modules/auth/strategies/github.strategy';
import { CookieStateStore } from '../src/modules/auth/strategies/oauth-state-store';
import { AccountPurgeService } from '../src/modules/tenancy/account-purge.service';
import { TransformInterceptor } from '../src/common/interceptors/transform.interceptor';
import { AllExceptionsFilter } from '../src/common/filters/http-exception.filter';
import { PrismaService } from '../src/prisma/prisma.service';
import { cleanupJourneyUsers } from './helpers/journey-cleanup';

/** Step 5.6: Google and GitHub sign-in. Provider answers are faked; everything Veyro decides about them is real. */
// A repo without credentials (CI, a fresh clone) still gets a configured app, so the redirects can be checked.
process.env.GOOGLE_CLIENT_ID ||= 'test-google-client-id';
process.env.GOOGLE_CLIENT_SECRET ||= 'test-google-client-secret';
process.env.GITHUB_CLIENT_ID ||= 'test-github-client-id';
process.env.GITHUB_CLIENT_SECRET ||= 'test-github-client-secret';
const config = { get: (k: string, d?: string) => process.env[k] ?? d } as any;

describe('5.6: only a provider-verified email may identify an account', () => {
  const google = new GoogleStrategy(config);
  const github = new GithubStrategy(config);
  const gProfile = (emails: any) => ({ id: '1', emails, displayName: 'Gail', photos: [] }) as any;
  const hProfile = (emails: any) => ({ id: '2', emails, displayName: 'Hal', username: 'hal', photos: [] }) as any;

  it('Google: accepts a verified address (lower-cased) and rejects an unverified or missing one', async () => {
    assert.equal((await google.validate('', '', gProfile([{ value: 'Gail@Example.test', verified: true }]))).email, 'gail@example.test');
    await assert.rejects(() => google.validate('', '', gProfile([{ value: 'x@example.test', verified: false }])), (e: any) => e.getResponse().code === 'OAUTH_EMAIL_NOT_VERIFIED');
    await assert.rejects(() => google.validate('', '', gProfile(undefined)), (e: any) => e.getResponse().code === 'OAUTH_EMAIL_NOT_VERIFIED');
  });

  it('GitHub: only the primary AND verified address counts, and nothing is ever invented', async () => {
    const ok = await github.validate('', '', hProfile([
      { value: 'victim@example.test', primary: false, verified: false },
      { value: 'Hal@Example.test', primary: true, verified: true },
    ]));
    assert.equal(ok.email, 'hal@example.test');
    // An address the person merely attached to their GitHub account (unverified) must not log them in as its owner.
    await assert.rejects(() => github.validate('', '', hProfile([{ value: 'victim@example.test', primary: true, verified: false }])));
    await assert.rejects(() => github.validate('', '', hProfile([{ value: 'victim@example.test', primary: false, verified: true }])));
    await assert.rejects(() => github.validate('', '', hProfile(undefined)), (e: any) => !String(e.message).includes('placeholder'));
  });
});

describe('5.6: the redirect carries a state that only this browser can answer (login CSRF)', () => {
  const fakeReq = (cookies: Record<string, string> = {}) => {
    const set: Record<string, string> = {};
    const cleared: string[] = [];
    const req: any = { cookies, res: { cookie: (n: string, v: string) => { set[n] = v; }, clearCookie: (n: string) => { cleared.push(n); } } };
    return { req, set, cleared };
  };
  const verify = (store: CookieStateStore, req: any, provided: any) => new Promise<boolean>((resolve) => store.verify(req, provided, (_e, ok) => resolve(!!ok)));

  it('issues a random state, keeps it in an httpOnly cookie and accepts only that value, once', async () => {
    const store = new CookieStateStore('google');
    const a = fakeReq();
    const state = await new Promise<string>((resolve) => store.store(a.req, (_e, s) => resolve(s!)));
    assert.match(state, /^[a-f0-9]{64}$/);
    assert.equal(a.set['oauth_state_google'], state);

    const good = fakeReq({ oauth_state_google: state });
    assert.equal(await verify(store, good.req, state), true);
    assert.deepEqual(good.cleared, ['oauth_state_google'], 'a state is good for one callback only');
    assert.equal(await verify(store, fakeReq({ oauth_state_google: state }).req, 'f'.repeat(64)), false, 'another value');
    assert.equal(await verify(store, fakeReq().req, state), false, 'no cookie: the answer comes from another browser');
    assert.equal(await verify(store, fakeReq({ oauth_state_google: state }).req, undefined), false, 'no state at all');
    assert.equal(await verify(new CookieStateStore('github'), fakeReq({ oauth_state_google: state }).req, state), false, 'the other provider cookie does not count');
  });
});

describe('5.6: signing in with a provider (real app, real database)', () => {
  let app: INestApplication;
  let base: string;
  let prisma: PrismaService;
  let auth: AuthService;
  const run = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`;
  const userIds: string[] = [];
  const emailOf = (label: string) => `p56.${label}.${run}@veyro-test.io`;
  const mkUser = async (label: string, verified: boolean) => {
    const u = await prisma.user.create({
      data: { email: emailOf(label), name: label, passwordHash: await bcrypt.hash('Original-Passw0rd!', 4), isEmailVerified: verified },
    });
    userIds.push(u.id);
    return u;
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
    auth = app.get(AuthService);
  });

  after(async () => {
    try {
      await cleanupJourneyUsers(prisma, app.get(AccountPurgeService), userIds);
    } finally {
      await app.close();
    }
  });

  it('a first-time sign-in creates a verified account with a password nobody knows', async () => {
    const r = await auth.validateOAuthUser({ email: emailOf('fresh'), name: 'Fresh Person', avatarUrl: null });
    userIds.push(r.user.id);
    assert.equal(r.user.isEmailVerified, true);
    assert.equal(r.user.locale, 'EN');
    assert.ok(r.accessToken && r.refreshToken);
  });

  it('signing in to an existing verified account keeps its password and sessions', async () => {
    const u = await mkUser('verified', true);
    const session = await prisma.userSession.create({ data: { userId: u.id, hashedToken: `h-${run}-v`, familyId: `f-${run}-v`, expiresAt: new Date(Date.now() + 86400000) } });
    await auth.validateOAuthUser({ email: u.email, name: 'x', avatarUrl: null });
    assert.equal((await prisma.userSession.findUniqueOrThrow({ where: { id: session.id } })).isRevoked, false);
    assert.ok((await auth.login({ email: u.email, password: 'Original-Passw0rd!' })).accessToken, 'the password still works');
  });

  it('claiming an address that was registered but never confirmed locks out whoever set that password', async () => {
    const u = await mkUser('squatted', false);
    const session = await prisma.userSession.create({ data: { userId: u.id, hashedToken: `h-${run}-s`, familyId: `f-${run}-s`, expiresAt: new Date(Date.now() + 86400000) } });
    await prisma.userOtpVerification.create({ data: { userId: u.id, email: u.email, codeHash: 'x', expiresAt: new Date(Date.now() + 600000), resendAvailableAt: new Date() } });
    await auth.validateOAuthUser({ email: u.email, name: 'Rightful Owner', avatarUrl: null });
    const after = await prisma.user.findUniqueOrThrow({ where: { id: u.id } });
    assert.equal(after.isEmailVerified, true);
    assert.equal((await prisma.userSession.findUniqueOrThrow({ where: { id: session.id } })).isRevoked, true, 'old sessions are revoked');
    assert.equal(await prisma.userOtpVerification.count({ where: { userId: u.id, isConsumed: false } }), 0, 'pending codes are void');
    await assert.rejects(() => auth.login({ email: u.email, password: 'Original-Passw0rd!' }), 'the squatter password no longer works');
  });

  const hit = (path: string) => fetch(`${base}${path}`, { redirect: 'manual' });

  it('starting Google and GitHub sign-in redirects to the provider with our callback', async () => {
    const g = await hit('/auth/google');
    assert.equal(g.status, 302);
    const gl = g.headers.get('location')!;
    assert.match(gl, /^https:\/\/accounts\.google\.com\//);
    assert.ok(decodeURIComponent(gl).includes('/api/v1/auth/google/callback'));
    assert.ok(decodeURIComponent(gl).includes(`client_id=${process.env.GOOGLE_CLIENT_ID}`));

    const h = await hit('/auth/github');
    assert.equal(h.status, 302);
    const hl = h.headers.get('location')!;
    assert.match(hl, /^https:\/\/github\.com\/login\/oauth\/authorize/);
    assert.ok(decodeURIComponent(hl).includes('/api/v1/auth/github/callback'));
  });

  it('the redirect carries a state that matches a cookie on this browser, and a callback without it is refused', async () => {
    for (const provider of ['google', 'github']) {
      const start = await hit(`/auth/${provider}`);
      const state = new URL(start.headers.get('location')!).searchParams.get('state');
      assert.match(state ?? '', /^[a-f0-9]{64}$/, `${provider} redirect has a state`);
      const cookie = start.headers.getSetCookie().find((c) => c.startsWith(`oauth_state_${provider}=`));
      assert.ok(cookie && cookie.includes(`=${state};`) && /HttpOnly/i.test(cookie) && /SameSite=Lax/i.test(cookie), `${provider} state cookie`);

      // A callback prepared by someone else: right shape, wrong state, no cookie. Refused before any provider call.
      const forged = await hit(`/auth/${provider}/callback?code=abc&state=${'0'.repeat(64)}`);
      assert.equal(forged.status, 302);
      assert.equal(forged.headers.get('location'), `${process.env.APP_URL || 'http://localhost:3000'}/login?oauth=failed`);
      assert.equal(forged.headers.getSetCookie().filter((c) => c.startsWith('access_token=')).length, 0, 'no session');
    }
  });

  it('a provider without credentials answers "not configured" instead of redirecting', async () => {
    const saved = process.env.GITHUB_CLIENT_SECRET;
    process.env.GITHUB_CLIENT_SECRET = '';
    try {
      const r = await hit('/auth/github');
      assert.equal(r.status, 404);
      assert.equal(((await r.json()) as any).error.code, 'OAUTH_NOT_CONFIGURED');
    } finally {
      process.env.GITHUB_CLIENT_SECRET = saved;
    }
  });

  it('cancelling on the provider page sends the person back to the login page, not to a JSON error', async () => {
    const appUrl = process.env.APP_URL || 'http://localhost:3000';
    for (const provider of ['google', 'github']) {
      const r = await hit(`/auth/${provider}/callback?error=access_denied`);
      assert.equal(r.status, 302, provider);
      assert.equal(r.headers.get('location'), `${appUrl}/login?oauth=failed`, provider);
      assert.equal(r.headers.getSetCookie().length, 0, 'no session is created');
    }
  });
});
