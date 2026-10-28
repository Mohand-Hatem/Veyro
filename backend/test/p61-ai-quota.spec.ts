import 'dotenv/config';
import 'reflect-metadata';
import { describe, it, before, after } from 'node:test';
import * as assert from 'node:assert/strict';
import { randomUUID } from 'crypto';
import { Test } from '@nestjs/testing';
import { ValidationPipe, INestApplication } from '@nestjs/common';
import cookieParser from 'cookie-parser';
import { SubscriptionPlanTier } from '@prisma/client';
import { AppModule } from '../src/app.module';
import { AuthService } from '../src/modules/auth/auth.service';
import { AiGateway, EMBEDDING_DIMS } from '../src/modules/ai/ai.gateway';
import { TIER_AI_DAILY_QUOTA } from '../src/modules/ai/ai-quota';
import { TransformInterceptor } from '../src/common/interceptors/transform.interceptor';
import { AllExceptionsFilter } from '../src/common/filters/http-exception.filter';
import { PrismaService } from '../src/prisma/prisma.service';
import { buildFixture, Fixture } from './helpers/fixture';

/** Step 5.8d: the daily assistant limit follows the best plan among the accounts a person owns. The model is faked. */
class FakeGateway extends AiGateway {
  isConfigured() {
    return true;
  }
  async embed(texts: string[]) {
    return texts.map(() => [1, ...new Array<number>(EMBEDDING_DIMS - 1).fill(0)]);
  }
  async generate() {
    return { inScope: true, answer: 'ok', sourcesUsed: [] };
  }
}

describe('5.8d: assistant limit by plan (real app, model faked)', () => {
  let app: INestApplication;
  let base: string;
  let prisma: PrismaService;
  let fx: Fixture;
  const cookies: Record<string, string> = {};

  const call = async (who: string, method: string, path: string, body?: object, headers: Record<string, string> = {}) => {
    const res = await fetch(`${base}${path}`, { method, headers: { cookie: cookies[who], 'content-type': 'application/json', ...headers }, body: body ? JSON.stringify(body) : undefined });
    return { status: res.status, json: (await res.json().catch(() => ({}))) as any };
  };
  const setPlan = (tier: SubscriptionPlanTier) => prisma.accountSubscription.update({ where: { accountId: fx.accountA }, data: { tier } });
  const quota = async (who: string) => (await call(who, 'GET', '/ai/quota')).json.data;
  const send = async (who: string, conv: string) => call(who, 'POST', `/ai/conversations/${conv}/messages`, { content: `hello ${randomUUID()}` }, { 'idempotency-key': randomUUID() });
  const usedToday = (who: string, n: number) => {
    const d = new Date();
    const usageDate = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
    const userId = fx.users[who as keyof Fixture['users']];
    return prisma.aiDailyUsage.upsert({ where: { userId_usageDate: { userId, usageDate } }, create: { userId, usageDate, messagesUsed: n }, update: { messagesUsed: n } });
  };

  before(async () => {
    const mod = await Test.createTestingModule({ imports: [AppModule] }).overrideProvider(AiGateway).useValue(new FakeGateway()).compile();
    app = mod.createNestApplication({ logger: false });
    app.use(cookieParser());
    app.setGlobalPrefix('api/v1');
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true, forbidNonWhitelisted: true, transformOptions: { enableImplicitConversion: true } }));
    app.useGlobalInterceptors(new TransformInterceptor());
    app.useGlobalFilters(new AllExceptionsFilter());
    await app.listen(0);
    base = `${await app.getUrl()}/api/v1`.replace('[::1]', 'localhost');
    prisma = app.get(PrismaService);
    fx = await buildFixture(prisma, SubscriptionPlanTier.FREE);
    const auth = app.get(AuthService);
    for (const [who, label] of Object.entries({ owner: 'owner', memberA: 'membera', outsider: 'outsider' })) {
      cookies[who] = `access_token=${(await auth.login({ email: `${label}.${fx.run}@veyro-test.io`, password: 'Password123!' })).accessToken}`;
    }
  });

  after(async () => {
    try {
      await fx.cleanup();
    } finally {
      await app.close();
    }
  });

  it('uses the numbers from the business rules', () => {
    assert.deepEqual(TIER_AI_DAILY_QUOTA, { FREE: 3, PRO: 15, ENTERPRISE: 25, EPIC: 50 });
  });

  it('follows the plan of the account the person owns, the moment it changes', async () => {
    for (const [tier, expected] of [['FREE', 3], ['PRO', 15], ['ENTERPRISE', 25], ['EPIC', 50], ['FREE', 3]] as const) {
      await setPlan(tier);
      const q = await quota('owner');
      assert.deepEqual([q.tier, q.dailyQuota], [tier, expected]);
      assert.equal(q.remaining, expected - q.messagesUsed);
    }
  });

  it('gives people who only belong to someone else workspace, or own an account with no plan row, the Free number', async () => {
    await setPlan('EPIC');
    assert.equal((await quota('memberA')).dailyQuota, 3);
    assert.equal((await quota('outsider')).dailyQuota, 3);
  });

  it('keeps a higher personal limit as a floor', async () => {
    await setPlan('PRO');
    await prisma.userAiSubscription.upsert({ where: { userId: fx.users.owner }, create: { userId: fx.users.owner, dailyQuota: 100 }, update: { dailyQuota: 100 } });
    assert.equal((await quota('owner')).dailyQuota, 100);
    await prisma.userAiSubscription.update({ where: { userId: fx.users.owner }, data: { dailyQuota: 3 } });
  });

  it('enforces the limit of the current plan when sending, and a better plan opens more room at once', async () => {
    await setPlan('FREE');
    const conv = (await call('owner', 'POST', '/ai/conversations', { title: 'Q', mode: 'KNOWLEDGE', contextScope: 'GLOBAL' })).json.data.id;
    await usedToday('owner', 3);
    const blocked = await send('owner', conv);
    assert.equal(blocked.status, 429);
    assert.match(blocked.json?.error?.message ?? blocked.json?.message ?? '', /\(3\)/);

    await setPlan('PRO');
    assert.equal((await send('owner', conv)).status, 201, 'the 4th message is allowed on Pro');
    await usedToday('owner', 15);
    const full = await send('owner', conv);
    assert.equal(full.status, 429);
    assert.match(full.json?.error?.message ?? full.json?.message ?? '', /\(15\)/);
  });

  it('shows the same number on the profile page', async () => {
    await setPlan('ENTERPRISE');
    const p = (await call('owner', 'GET', '/users/me/profile')).json.data;
    assert.deepEqual([p.aiSubscription.tier, p.aiSubscription.dailyQuota], ['ENTERPRISE', 25]);
    const m = (await call('memberA', 'GET', '/users/me/profile')).json.data;
    assert.deepEqual([m.aiSubscription.tier, m.aiSubscription.dailyQuota], ['FREE', 3]);
  });
});
