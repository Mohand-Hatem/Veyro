import 'dotenv/config';
import 'reflect-metadata';
import { describe, it, before, after, beforeEach } from 'node:test';
import * as assert from 'node:assert/strict';
import Stripe from 'stripe';
import { Test } from '@nestjs/testing';
import { ValidationPipe, INestApplication } from '@nestjs/common';
import cookieParser from 'cookie-parser';
import { AppModule } from '../src/app.module';
import { AuthService } from '../src/modules/auth/auth.service';
import { StripeService } from '../src/modules/billing/stripe.service';
import { TransformInterceptor } from '../src/common/interceptors/transform.interceptor';
import { AllExceptionsFilter } from '../src/common/filters/http-exception.filter';
import { PrismaService } from '../src/prisma/prisma.service';
import { buildFixture, Fixture } from './helpers/fixture';

/**
 * Step 5.7: Stripe payments. Stripe itself is faked (no network); the signature check, the mapping of events to plans and
 * statuses, idempotency, ordering and the owner-only checkout and portal are the app's own and run for real.
 */
const SECRET = 'whsec_unit_test_secret';
const PRICE = { PRO: 'price_test_pro', ENTERPRISE: 'price_test_ent', EPIC: 'price_test_epic' };
process.env.STRIPE_WEBHOOK_SECRET = SECRET;
process.env.STRIPE_PRICE_ID_PRO = PRICE.PRO;
process.env.STRIPE_PRICE_ID_ENTERPRISE = PRICE.ENTERPRISE;
process.env.STRIPE_PRICE_ID_EPIC = PRICE.EPIC;

/** What "Stripe" currently says about each subscription; the webhook always asks for the latest state. */
class FakeStripe extends StripeService {
  subs: Record<string, any> = {};
  checkoutCalls: any[] = [];
  portalCalls: any[] = [];
  changeCalls: any[] = [];
  failChange = false;
  async changePlan(subscriptionId: string, tier: string) {
    if (this.failChange) throw Object.assign(new Error('Your card was declined.'), { type: 'StripeCardError' });
    this.changeCalls.push({ subscriptionId, tier });
  }
  async retrieveSubscription(id: string) {
    return this.subs[id];
  }
  async checkoutUrl(a: any) {
    this.checkoutCalls.push(a);
    return 'https://checkout.example.test/session';
  }
  async portalUrl(customerId: string, returnUrl: string) {
    this.portalCalls.push({ customerId, returnUrl });
    return 'https://billing.example.test/portal';
  }
}

describe('5.7: Stripe payments (real app, Stripe faked)', () => {
  let app: INestApplication;
  let base: string;
  let prisma: PrismaService;
  let fx: Fixture;
  let stripe: FakeStripe;
  const cookies: Record<string, string> = {};
  let n = 0;

  const sub = (status: string, over: Record<string, any> = {}) => ({
    id: 'sub_test_1', status, customer: 'cus_test_1', cancel_at_period_end: false,
    metadata: { accountId: fx.accountA }, items: { data: [{ price: { id: PRICE.PRO }, current_period_end: 1893456000 }] }, ...over,
  });
  const event = (type: string, object: object, id = `evt_test_${Date.now()}_${n++}`) => ({ id, object: 'event', type, data: { object } });
  const post = (payload: object | string, signature?: string | null) => {
    const body = typeof payload === 'string' ? payload : JSON.stringify(payload);
    const sig = signature === undefined ? Stripe.webhooks.generateTestHeaderString({ payload: body, secret: SECRET }) : signature;
    return fetch(`${base}/billing/webhook`, { method: 'POST', headers: { 'content-type': 'application/json', ...(sig ? { 'stripe-signature': sig } : {}) }, body });
  };
  const call = async (who: string, method: string, path: string, body?: object) => {
    const res = await fetch(`${base}${path}`, { method, headers: { cookie: cookies[who], 'content-type': 'application/json' }, body: body ? JSON.stringify(body) : undefined });
    return { status: res.status, json: (await res.json().catch(() => ({}))) as any };
  };
  const account = () => prisma.accountSubscription.findUniqueOrThrow({ where: { accountId: fx.accountA } });

  before(async () => {
    stripe = new FakeStripe();
    const mod = await Test.createTestingModule({ imports: [AppModule] }).overrideProvider(StripeService).useValue(stripe).compile();
    app = mod.createNestApplication({ logger: false, rawBody: true });
    app.use(cookieParser());
    app.setGlobalPrefix('api/v1');
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true, forbidNonWhitelisted: true, transformOptions: { enableImplicitConversion: true } }));
    app.useGlobalInterceptors(new TransformInterceptor());
    app.useGlobalFilters(new AllExceptionsFilter());
    await app.listen(0);
    base = `${await app.getUrl()}/api/v1`.replace('[::1]', 'localhost');
    prisma = app.get(PrismaService);
    fx = await buildFixture(prisma, 'FREE');
    const auth = app.get(AuthService);
    for (const [who, label] of Object.entries({ owner: 'owner', admin2: 'admin2', memberA: 'membera' })) {
      cookies[who] = `access_token=${(await auth.login({ email: `${label}.${fx.run}@veyro-test.io`, password: 'Password123!' })).accessToken}`;
    }
  });

  beforeEach(() => {
    stripe.subs = {};
    stripe.checkoutCalls = [];
    stripe.portalCalls = [];
    stripe.changeCalls = [];
    stripe.failChange = false;
  });

  after(async () => {
    try {
      await fx.cleanup();
    } finally {
      await app.close();
    }
  });

  describe('the webhook only trusts Stripe', () => {
    it('refuses a call with no signature, a wrong signature, a tampered body, or the old unsigned format', async () => {
      const e = event('customer.subscription.updated', { id: 'sub_test_1' });
      assert.equal((await post(e, null)).status, 400);
      assert.equal((await post(e, 't=1,v1=deadbeef')).status, 400);
      const body = JSON.stringify(e);
      const goodSig = Stripe.webhooks.generateTestHeaderString({ payload: body, secret: SECRET });
      assert.equal((await post(body.replace('sub_test_1', 'sub_other'), goodSig)).status, 400, 'a signature for a different body is refused');
      const forged = await post({ externalEventId: 'x', eventType: 'subscription.updated', data: { accountId: fx.accountA, tier: 'EPIC', status: 'ACTIVE' } }, null);
      assert.equal(forged.status, 400);
      assert.equal((await account()).tier, 'FREE', 'nothing was applied');
    });

    it('refuses an old signature (replay protection)', async () => {
      const body = JSON.stringify(event('customer.subscription.updated', { id: 'sub_test_1' }));
      const old = Stripe.webhooks.generateTestHeaderString({ payload: body, secret: SECRET, timestamp: Math.floor(Date.now() / 1000) - 3600 });
      assert.equal((await post(body, old)).status, 400);
    });

    it('is closed to everyone while no webhook secret is configured', async () => {
      process.env.STRIPE_WEBHOOK_SECRET = '';
      try {
        const body = JSON.stringify(event('customer.subscription.updated', { id: 'sub_test_1' }));
        const res = await post(body, Stripe.webhooks.generateTestHeaderString({ payload: body, secret: SECRET }));
        assert.equal(res.status, 503);
      } finally {
        process.env.STRIPE_WEBHOOK_SECRET = SECRET;
      }
    });
  });

  describe('events change the plan', () => {
    it('a completed checkout upgrades the account and records the renewal date', async () => {
      stripe.subs['sub_test_1'] = sub('active');
      const res = await post(event('checkout.session.completed', { mode: 'subscription', subscription: 'sub_test_1' }, 'evt_co_1'));
      assert.equal(res.status, 200);
      const s = await account();
      assert.equal(s.tier, 'PRO');
      assert.equal(s.status, 'ACTIVE');
      assert.equal(s.providerCustomerId, 'cus_test_1');
      assert.equal(s.providerSubscriptionId, 'sub_test_1');
      assert.equal(s.billingCycleEndsAt?.toISOString(), new Date(1893456000 * 1000).toISOString());
      assert.equal(await prisma.billingEvent.count({ where: { externalEventId: 'evt_co_1' } }), 1);
    });

    it('the same event delivered twice is applied once', async () => {
      stripe.subs['sub_test_1'] = sub('active');
      const again = await (await post(event('checkout.session.completed', { mode: 'subscription', subscription: 'sub_test_1' }, 'evt_co_1'))).json() as any;
      assert.equal(again.data.deduplicated, true);
      assert.equal(await prisma.billingEvent.count({ where: { externalEventId: 'evt_co_1' } }), 1);
    });

    it('a failed payment starts the grace period; the next paid invoice ends it', async () => {
      stripe.subs['sub_test_1'] = sub('past_due');
      await post(event('invoice.payment_failed', { parent: { subscription_details: { subscription: 'sub_test_1' } }, amount_due: 900, currency: 'usd' }));
      let s = await account();
      assert.equal(s.status, 'PAST_DUE');
      assert.ok(s.gracePeriodEndsAt, 'a grace period is set');
      assert.equal(s.tier, 'PRO', 'the plan is kept during the grace period');

      stripe.subs['sub_test_1'] = sub('active');
      await post(event('invoice.paid', { subscription: 'sub_test_1', amount_paid: 900, currency: 'usd' }));
      s = await account();
      assert.equal(s.status, 'ACTIVE');
      assert.equal(s.gracePeriodEndsAt, null);
    });

    it('events that arrive out of order cannot leave an old state behind (the latest state is fetched)', async () => {
      // Stripe now says "active", yet a late "payment failed" event shows up: the account must end up active.
      stripe.subs['sub_test_1'] = sub('active');
      await post(event('invoice.payment_failed', { subscription: 'sub_test_1' }));
      assert.equal((await account()).status, 'ACTIVE');
    });

    it('cancelling at the end of the period is recorded without changing the plan yet', async () => {
      stripe.subs['sub_test_1'] = sub('active', { cancel_at_period_end: true });
      await post(event('customer.subscription.updated', { id: 'sub_test_1' }));
      const s = await account();
      assert.equal(s.cancelAtPeriodEnd, true);
      assert.equal(s.tier, 'PRO');
    });

    it('cancelling in the billing portal (Stripe sets a cancel date, not the period-end flag) is recorded too', async () => {
      stripe.subs['sub_test_1'] = sub('active', { cancel_at_period_end: false, cancel_at: 1893456000 });
      await post(event('customer.subscription.updated', { id: 'sub_test_1' }));
      assert.equal((await account()).cancelAtPeriodEnd, true);
      // Undoing the cancellation in the portal clears it again.
      stripe.subs['sub_test_1'] = sub('active', { cancel_at_period_end: false, cancel_at: null });
      await post(event('customer.subscription.updated', { id: 'sub_test_1' }));
      assert.equal((await account()).cancelAtPeriodEnd, false);
    });

    it('when the subscription ends the account returns to Free and must choose its projects', async () => {
      stripe.subs['sub_test_1'] = sub('canceled');
      await post(event('customer.subscription.deleted', { id: 'sub_test_1' }));
      const s = await account();
      assert.equal(s.tier, 'FREE');
      assert.equal(s.status, 'DOWNGRADED');
      assert.equal(s.requiresProjectSelection, true);
      assert.equal(s.cancelAtPeriodEnd, false);
      assert.equal(s.billingCycleEndsAt, null);
    });

    it('answers 200 and changes nothing for events we do not use, unknown prices, or subscriptions without an account', async () => {
      const before = await account();
      assert.equal((await post(event('customer.created', { id: 'cus_x' }))).status, 200);
      stripe.subs['sub_test_1'] = sub('active', { items: { data: [{ price: { id: 'price_never_sold' } }] } });
      assert.equal((await post(event('customer.subscription.updated', { id: 'sub_test_1' }))).status, 200);
      stripe.subs['sub_test_1'] = sub('active', { metadata: {} });
      assert.equal((await post(event('customer.subscription.updated', { id: 'sub_test_1' }))).status, 200);
      const after = await account();
      assert.equal(after.tier, before.tier);
      assert.equal(after.status, before.status);
    });
  });

  describe('what the billing screen is told', () => {
    it('plan prices and whether the portal can be opened, and never a Stripe id', async () => {
      await prisma.accountSubscription.update({ where: { accountId: fx.accountA }, data: { providerCustomerId: null, providerSubscriptionId: null } });
      const before = await call('owner', 'GET', `/accounts/${fx.accountA}/subscription`);
      assert.deepEqual(before.json.data.billing, { currency: 'USD', priceCents: { PRO: 900, ENTERPRISE: 1900, EPIC: 2900 }, canManage: false, canSwitch: false, testMode: false });

      await prisma.accountSubscription.update({ where: { accountId: fx.accountA }, data: { providerCustomerId: 'cus_secret_id', providerSubscriptionId: 'sub_secret_id' } });
      const after = await call('owner', 'GET', `/accounts/${fx.accountA}/subscription`);
      assert.equal(after.json.data.billing.canManage, true);
      assert.equal(after.json.data.billing.canSwitch, false, 'a Free account has no paid plan to switch');
      await prisma.accountSubscription.update({ where: { accountId: fx.accountA }, data: { tier: 'PRO', status: 'ACTIVE' } });
      assert.equal((await call('owner', 'GET', `/accounts/${fx.accountA}/subscription`)).json.data.billing.canSwitch, true);
      await prisma.accountSubscription.update({ where: { accountId: fx.accountA }, data: { status: 'PAST_DUE' } });
      assert.equal((await call('owner', 'GET', `/accounts/${fx.accountA}/subscription`)).json.data.billing.canSwitch, false, 'not while a payment is failing');
      await prisma.accountSubscription.update({ where: { accountId: fx.accountA }, data: { tier: 'FREE', status: 'ACTIVE', providerCustomerId: null, providerSubscriptionId: null } });
      assert.ok(!JSON.stringify(after.json).includes('_secret_id'), 'no provider identifier leaves the server');
    });
  });

  describe('switching between paid plans', () => {
    const paying = (tier = 'PRO', status = 'ACTIVE') =>
      prisma.accountSubscription.update({ where: { accountId: fx.accountA }, data: { tier: tier as any, status: status as any, providerCustomerId: 'cus_test_1', providerSubscriptionId: 'sub_test_1', requiresProjectSelection: false } });
    const change = (who: string, tier: string) => call(who, 'POST', `/accounts/${fx.accountA}/billing/change-plan`, { tier });
    const unlockProjects = () => prisma.project.updateMany({ where: { workspace: { accountId: fx.accountA } }, data: { isBillingReadOnly: false } });
    // Earlier groups leave the fixture mid-story (locked projects, a paid plan); later groups expect a plain Free account.
    after(async () => {
      await prisma.accountSubscription.update({ where: { accountId: fx.accountA }, data: { tier: 'FREE', status: 'ACTIVE', providerCustomerId: null, providerSubscriptionId: null, requiresProjectSelection: false } });
      await unlockProjects();
    });

    it('the owner of a paying account switches plan; Stripe is asked to swap the price', async () => {
      await paying('PRO');
      const r = await change('owner', 'ENTERPRISE');
      assert.equal(r.status, 200);
      assert.deepEqual(stripe.changeCalls, [{ subscriptionId: 'sub_test_1', tier: 'ENTERPRISE' }]);
    });

    it('refuses a switch that makes no sense, and tells why', async () => {
      await paying('PRO');
      assert.equal((await change('owner', 'PRO')).json.error.code, 'SAME_PLAN');
      assert.equal((await change('owner', 'FREE')).status, 400);
      assert.equal((await change('admin2', 'EPIC')).status, 403);
      assert.equal((await change('memberA', 'EPIC')).status, 403);
      await paying('PRO', 'PAST_DUE');
      assert.equal((await change('owner', 'EPIC')).json.error.code, 'PAYMENT_PAST_DUE');
      await prisma.accountSubscription.update({ where: { accountId: fx.accountA }, data: { tier: 'FREE', status: 'ACTIVE', providerSubscriptionId: null } });
      assert.equal((await change('owner', 'EPIC')).json.error.code, 'NO_ACTIVE_SUBSCRIPTION', 'a Free account buys a plan through checkout');
      assert.equal(stripe.changeCalls.length, 0, 'Stripe was never asked');
    });

    it('a declined payment aborts the change with a clear answer', async () => {
      await paying('PRO');
      stripe.failChange = true;
      const r = await change('owner', 'EPIC');
      assert.equal(r.status, 402);
      assert.equal(r.json.error.code, 'PAYMENT_FAILED');
    });

    it('moving to a smaller plan locks projects only when there are more than the new plan keeps editable', async () => {
      const readOnly = async () => (await prisma.project.findMany({ where: { workspace: { accountId: fx.accountA }, deletedAt: null } })).filter((p) => p.isBillingReadOnly).length;
      const toTier = async (price: string) => {
        stripe.subs['sub_test_1'] = sub('active', { items: { data: [{ price: { id: price }, current_period_end: 1893456000 }] } });
        await post(event('customer.subscription.updated', { id: 'sub_test_1' }));
      };
      // 2 projects (fits Pro's 7): Epic -> Pro changes the plan and locks nothing.
      await unlockProjects();
      await paying('EPIC');
      await toTier(PRICE.PRO);
      assert.equal((await account()).tier, 'PRO');
      assert.equal((await account()).requiresProjectSelection, false);
      assert.equal(await readOnly(), 0);

      // 8 projects (more than Pro's 7): Epic -> Pro locks them all until the owner chooses.
      await prisma.project.createMany({ data: ['AAA', 'BBB', 'CCC', 'DDD', 'EEE', 'FFF'].map((key) => ({ workspaceId: fx.workspaceA, name: `Extra ${key}`, key, createdById: fx.users.owner })) });
      await paying('EPIC');
      await toTier(PRICE.PRO);
      assert.equal((await account()).requiresProjectSelection, true);
      assert.equal(await readOnly(), 8);

      // Going up again with read-only projects still waiting keeps the owner's choice pending.
      await toTier(PRICE.EPIC);
      assert.equal((await account()).tier, 'EPIC');
      assert.equal((await account()).requiresProjectSelection, true);
    });
  });

  describe('checkout and billing portal (account owner only)', () => {
    it('the owner of a Free account is sent to Stripe checkout for the plan they chose', async () => {
      const r = await call('owner', 'POST', `/accounts/${fx.accountA}/billing/checkout`, { tier: 'ENTERPRISE' });
      assert.equal(r.status, 200);
      assert.equal(r.json.data.url, 'https://checkout.example.test/session');
      const c = stripe.checkoutCalls[0];
      assert.equal(c.accountId, fx.accountA);
      assert.equal(c.tier, 'ENTERPRISE');
      assert.match(c.successUrl, /\/en\/account\/billing\?checkout=success$/);
      assert.match(c.cancelUrl, /\/en\/account\/billing\?checkout=cancelled$/);
    });

    it('nobody else can start a checkout or open the portal, and only paid plans can be chosen', async () => {
      for (const who of ['admin2', 'memberA']) {
        assert.equal((await call(who, 'POST', `/accounts/${fx.accountA}/billing/checkout`, { tier: 'PRO' })).status, 403, who);
        assert.equal((await call(who, 'POST', `/accounts/${fx.accountA}/billing/portal`)).status, 403, who);
      }
      assert.equal((await call('owner', 'POST', `/accounts/${fx.accountA}/billing/checkout`, { tier: 'FREE' })).status, 400);
      assert.equal((await call('owner', 'POST', `/accounts/${fx.accountA}/billing/checkout`, { tier: 'PLATINUM' })).status, 400);
      assert.equal(stripe.checkoutCalls.length, 0);
    });

    it('the portal needs a Stripe customer; once there is one it opens', async () => {
      await prisma.accountSubscription.update({ where: { accountId: fx.accountA }, data: { providerCustomerId: null, providerSubscriptionId: null } });
      const none = await call('owner', 'POST', `/accounts/${fx.accountA}/billing/portal`);
      assert.equal(none.status, 409);
      assert.equal(none.json.error.code, 'NO_BILLING_CUSTOMER');

      await prisma.accountSubscription.update({ where: { accountId: fx.accountA }, data: { providerCustomerId: 'cus_test_1' } });
      const ok = await call('owner', 'POST', `/accounts/${fx.accountA}/billing/portal`);
      assert.equal(ok.status, 200);
      assert.equal(stripe.portalCalls[0].customerId, 'cus_test_1');
      assert.match(stripe.portalCalls[0].returnUrl, /\/en\/account\/billing$/);
    });

    it('an account that already pays cannot open a second subscription', async () => {
      await prisma.accountSubscription.update({ where: { accountId: fx.accountA }, data: { tier: 'PRO', status: 'ACTIVE', providerCustomerId: 'cus_test_1', providerSubscriptionId: 'sub_test_1' } });
      const r = await call('owner', 'POST', `/accounts/${fx.accountA}/billing/checkout`, { tier: 'EPIC' });
      assert.equal(r.status, 409);
      assert.equal(r.json.error.code, 'ALREADY_SUBSCRIBED');
    });

    it('no checkout while the account is being deleted', async () => {
      await prisma.accountSubscription.update({ where: { accountId: fx.accountA }, data: { tier: 'FREE', providerSubscriptionId: null } });
      await prisma.account.update({ where: { id: fx.accountA }, data: { offboardingState: 'PENDING' } });
      const r = await call('owner', 'POST', `/accounts/${fx.accountA}/billing/checkout`, { tier: 'PRO' });
      assert.equal(r.json.error.code, 'ACCOUNT_OFFBOARDING_LOCKED');
      await prisma.account.update({ where: { id: fx.accountA }, data: { offboardingState: 'NONE' } });
    });
  });
});

describe('5.7: payment settings at boot', () => {
  const base = { JWT_SECRET: 'x'.repeat(40), RESEND_API_KEY: 're_x', EMAIL_FROM: 'Veyro <noreply@veyro.app>', GEMINI_API_KEY: 'k', CLOUDINARY_CLOUD_NAME: 'c', CLOUDINARY_API_KEY: 'k', CLOUDINARY_API_SECRET: 's', CRON_SECRET: 'c'.repeat(16) };
  const live = { STRIPE_SECRET_KEY: 'sk_live_x', STRIPE_WEBHOOK_SECRET: 'whsec_x', STRIPE_PRICE_ID_PRO: 'p', STRIPE_PRICE_ID_ENTERPRISE: 'e', STRIPE_PRICE_ID_EPIC: 'x' };
  it('are optional in development and complete in production', async () => {
    const { validateEnv } = await import('../src/config/env.validation');
    assert.doesNotThrow(() => validateEnv({ ...base, NODE_ENV: 'development' }));
    assert.throws(() => validateEnv({ ...base, NODE_ENV: 'production' }), /STRIPE_SECRET_KEY/);
    assert.throws(() => validateEnv({ ...base, ...live, STRIPE_WEBHOOK_SECRET: '', NODE_ENV: 'production' }), /STRIPE_WEBHOOK_SECRET/);
    assert.throws(() => validateEnv({ ...base, ...live, STRIPE_SECRET_KEY: 'sk_test_x', NODE_ENV: 'production' }), /test key/);
    // A portfolio demo may run on test keys, but only when it says so.
    assert.doesNotThrow(() => validateEnv({ ...base, ...live, STRIPE_SECRET_KEY: 'sk_test_x', STRIPE_ALLOW_TEST_KEYS: 'true', NODE_ENV: 'production' }));
    assert.doesNotThrow(() => validateEnv({ ...base, ...live, NODE_ENV: 'production' }));
  });
});
