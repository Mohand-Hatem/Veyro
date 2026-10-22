import 'dotenv/config';
import 'reflect-metadata';
import { describe, it, before, after } from 'node:test';
import * as assert from 'node:assert/strict';
import { randomUUID } from 'crypto';
import { NestFactory } from '@nestjs/core';
import { ValidationPipe, INestApplication } from '@nestjs/common';
import cookieParser from 'cookie-parser';
import { ProjectLifecycleStatus } from '@prisma/client';
import { AppModule } from '../src/app.module';
import { TransformInterceptor } from '../src/common/interceptors/transform.interceptor';
import { AllExceptionsFilter } from '../src/common/filters/http-exception.filter';
import { PrismaService } from '../src/prisma/prisma.service';
import { AccountPurgeService } from '../src/modules/tenancy/account-purge.service';
import { buildFixture, Fixture } from './helpers/fixture';

/**
 * CS-07 / ADR-014: account governance (owner-only billing overview, grace period, downgrade project selection with the
 * plan cap, account audit trail, offboarding with password + slug, child-first purge).
 */
describe('CS-07: account governance (billing, downgrade selection, account audit, offboarding)', () => {
  let app: INestApplication;
  let base: string;
  let prisma: PrismaService;
  let fx: Fixture;
  let fx2: Fixture;
  const cookies: Record<string, string> = {};
  const code = (r: { json: any }) => r.json?.error?.code ?? r.json?.code ?? r.json?.data?.code;

  const login = async (f: Fixture, label: string) => {
    const res = await fetch(`${base}/auth/login`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email: `${label}.${f.run}@veyro-test.io`, password: 'Password123!' }) });
    assert.strictEqual(res.status, 200, `login ${label}`);
    return res.headers.getSetCookie().map((c) => c.split(';')[0]).join('; ');
  };
  const call = async (who: string, method: string, path: string, body?: object) => {
    const res = await fetch(`${base}${path}`, { method, headers: { cookie: cookies[who], 'content-type': 'application/json' }, body: body ? JSON.stringify(body) : undefined });
    return { status: res.status, json: (await res.json().catch(() => ({}))) as any };
  };
  const webhook = (data: object, eventType = 'subscription.updated') =>
    fetch(`${base}/billing/webhook`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ externalEventId: `evt_${randomUUID()}`, eventType, data }) });
  const sub = (f: Fixture) => prisma.accountSubscription.findUniqueOrThrow({ where: { accountId: f.accountA } });
  const readOnly = async (f: Fixture) => (await prisma.project.findMany({ where: { workspace: { accountId: f.accountA }, deletedAt: null }, select: { id: true, isBillingReadOnly: true } })).filter((p) => p.isBillingReadOnly).map((p) => p.id);

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
    fx2 = await buildFixture(prisma);
    for (const l of ['owner', 'admin2', 'outsider']) cookies[l] = await login(fx, l);
    cookies.owner2 = await login(fx2, 'owner');
    cookies.admin22 = await login(fx2, 'admin2');
  });

  after(async () => {
    try {
      await fx2.cleanup();
      await fx.cleanup();
    } finally {
      await app.close();
    }
  });

  describe('billing overview (owner only)', () => {
    it('returns plan, limits and counts without provider identifiers', async () => {
      await prisma.accountSubscription.update({ where: { accountId: fx.accountA }, data: { providerCustomerId: 'cus_secret', providerSubscriptionId: 'sub_secret' } });
      const r = await call('owner', 'GET', `/accounts/${fx.accountA}/subscription`);
      assert.strictEqual(r.status, 200);
      const d = r.json.data;
      assert.strictEqual(d.account.slug, `acct-a-${fx.run}`);
      assert.strictEqual(d.subscription.tier, 'PRO');
      assert.deepEqual([d.limits.maxProjects, d.limits.maxWorkspaces, d.limits.currentProjects, d.limits.currentWorkspaces], [7, 3, 2, 1]);
      assert.strictEqual(d.grace, null);
      assert.strictEqual(d.readOnlyProjects, 0);
      assert.ok(!JSON.stringify(d).includes('cus_secret') && !JSON.stringify(d).includes('sub_secret'), 'no provider ids leave the server');
    });

    it('answers 403 to everyone but the Account Owner (admins, members of other tenants) on every owner-only route', async () => {
      for (const path of [`/accounts/${fx.accountA}/subscription`, `/accounts/${fx.accountA}/projects`, `/accounts/${fx.accountA}/billing-events`]) {
        for (const who of ['admin2', 'outsider']) {
          const r = await call(who, 'GET', path);
          assert.strictEqual(r.status, 403, `${who} ${path}`);
          assert.strictEqual(code(r), 'PERMISSION_DENIED');
        }
      }
      assert.strictEqual((await call('owner', 'GET', '/accounts/does-not-exist/subscription')).status, 404);
    });
  });

  describe('grace period (BR-SUB-03.1)', () => {
    it('opens a 7-day window on the first PAST_DUE event, keeps it on repeats and clears it on recovery', async () => {
      assert.strictEqual((await webhook({ accountId: fx.accountA, status: 'PAST_DUE' })).status, 200);
      const first = await sub(fx);
      assert.strictEqual(first.status, 'PAST_DUE');
      const days = (first.gracePeriodEndsAt!.getTime() - Date.now()) / 86_400_000;
      assert.ok(days > 6.99 && days <= 7, `grace ends in ${days} days`);

      const view = (await call('owner', 'GET', `/accounts/${fx.accountA}/subscription`)).json.data;
      assert.deepEqual([view.grace.daysLeft, view.grace.expired], [7, false]);

      await webhook({ accountId: fx.accountA, status: 'PAST_DUE' });
      assert.strictEqual((await sub(fx)).gracePeriodEndsAt!.getTime(), first.gracePeriodEndsAt!.getTime(), 'a repeat must not extend the window');

      await prisma.accountSubscription.update({ where: { accountId: fx.accountA }, data: { gracePeriodEndsAt: new Date(Date.now() - 1000) } });
      const expired = (await call('owner', 'GET', `/accounts/${fx.accountA}/subscription`)).json.data;
      assert.deepEqual([expired.grace.daysLeft, expired.grace.expired], [0, true]);

      await webhook({ accountId: fx.accountA, status: 'ACTIVE' });
      const back = await sub(fx);
      assert.deepEqual([back.status, back.gracePeriodEndsAt], ['ACTIVE', null]);
      assert.strictEqual((await call('owner', 'GET', `/accounts/${fx.accountA}/subscription`)).json.data.grace, null);
    });

    it('rejects unknown tiers or statuses as 400 instead of a database error', async () => {
      assert.strictEqual((await webhook({ accountId: fx.accountA, tier: 'PLATINUM' })).status, 400);
      assert.strictEqual((await webhook({ accountId: fx.accountA, status: 'EXPLODED' })).status, 400);
    });

    it('lists billing history newest first, without provider event ids', async () => {
      await webhook({ accountId: fx.accountA, status: 'ACTIVE' }, 'invoice.paid');
      const r = await call('owner', 'GET', `/accounts/${fx.accountA}/billing-events`);
      assert.strictEqual(r.status, 200);
      const events = r.json.data.events;
      assert.ok(events.length >= 4);
      assert.strictEqual(events[0].eventType, 'invoice.paid');
      assert.ok(events.every((e: any) => !('externalEventId' in e)));
      assert.ok(events.every((e: any, i: number) => i === 0 || new Date(events[i - 1].occurredAt) >= new Date(e.occurredAt)));
    });
  });

  describe('downgrade project selection (BR-SUB-03.2 / 03.3)', () => {
    let extra: string[] = [];

    it('refuses a selection while nothing is pending', async () => {
      const r = await call('owner', 'POST', `/accounts/${fx.accountA}/select-active-projects`, { activeProjectIds: [fx.projectA1] });
      assert.strictEqual(r.status, 409);
      assert.strictEqual(code(r), 'NO_PROJECT_SELECTION_REQUIRED');
    });

    it('locks every project on the transition to Free and lists them for the owner', async () => {
      assert.strictEqual((await webhook({ accountId: fx.accountA, tier: 'FREE', status: 'DOWNGRADED' })).status, 200);
      assert.strictEqual((await sub(fx)).requiresProjectSelection, true);
      assert.strictEqual((await readOnly(fx)).length, 2);
      const r = await call('owner', 'GET', `/accounts/${fx.accountA}/projects`);
      assert.strictEqual(r.status, 200);
      assert.strictEqual(r.json.data.selectionCap, 3);
      assert.strictEqual(r.json.data.requiresProjectSelection, true);
      assert.strictEqual(r.json.data.projects.length, 2);
      const p = r.json.data.projects[0];
      assert.ok(p.workspace.name && p.key && p.isBillingReadOnly === true && typeof p.taskCount === 'number');
    });

    it('enforces the plan cap (3 on Free) and rejects foreign, duplicate and non-owner selections', async () => {
      extra = [
        (await prisma.project.create({ data: { workspaceId: fx.workspaceA, name: `Gamma ${fx.run}`, key: 'GAM', createdById: fx.users.owner, isBillingReadOnly: true } })).id,
        (await prisma.project.create({ data: { workspaceId: fx.workspaceA, name: `Delta ${fx.run}`, key: 'DEL', createdById: fx.users.owner, isBillingReadOnly: true } })).id,
      ];
      const four = [fx.projectA1, fx.projectA2, ...extra];
      const over = await call('owner', 'POST', `/accounts/${fx.accountA}/select-active-projects`, { activeProjectIds: four });
      assert.strictEqual(over.status, 400);
      assert.strictEqual(code(over), 'PROJECT_SELECTION_EXCEEDS_LIMIT');

      const foreign = await call('owner', 'POST', `/accounts/${fx.accountA}/select-active-projects`, { activeProjectIds: [fx.projectB1] });
      assert.strictEqual(foreign.status, 400);
      assert.strictEqual(code(foreign), 'INVALID_PROJECT_SELECTION');

      const nonOwner = await call('admin2', 'POST', `/accounts/${fx.accountA}/select-active-projects`, { activeProjectIds: [fx.projectA1] });
      assert.strictEqual(nonOwner.status, 403);
      assert.strictEqual((await readOnly(fx)).length, 4, 'a rejected selection changes nothing');

      // duplicates count once: the same project listed twice is a valid selection of one
      const dup = await call('owner', 'POST', `/accounts/${fx.accountA}/select-active-projects`, { activeProjectIds: [fx.projectA1, fx.projectA1] });
      assert.strictEqual(dup.status, 200);
      assert.strictEqual(dup.json.data.activeProjectCount, 1);
    });

    it('keeps an archived project archived when it is selected, and never auto-fills unused slots', async () => {
      await prisma.project.update({ where: { id: fx.projectA2 }, data: { lifecycleStatus: ProjectLifecycleStatus.ARCHIVED, isBillingReadOnly: true } });
      await webhook({ accountId: fx.accountA, tier: 'PRO', status: 'ACTIVE' }); // upgrade over read-only projects
      assert.strictEqual((await sub(fx)).requiresProjectSelection, true, 'an upgrade asks the owner to choose');
      assert.strictEqual((await readOnly(fx)).length >= 3, true, 'an upgrade never reactivates by itself');

      const r = await call('owner', 'POST', `/accounts/${fx.accountA}/select-active-projects`, { activeProjectIds: [fx.projectA2, extra[0]] });
      assert.strictEqual(r.status, 200);
      assert.deepEqual([r.json.data.activeProjectCount, r.json.data.readOnlyProjectCount], [2, 2]);
      const a2 = await prisma.project.findUniqueOrThrow({ where: { id: fx.projectA2 } });
      assert.deepEqual([a2.lifecycleStatus, a2.isBillingReadOnly], ['ARCHIVED', false]);
      assert.strictEqual((await sub(fx)).requiresProjectSelection, false);
      assert.strictEqual((await readOnly(fx)).length, 2, 'only the two unselected projects stay read-only');
    });

    it('does not re-lock reactivated projects on a repeated Free event or an ordinary renewal', async () => {
      await webhook({ accountId: fx.accountA, tier: 'FREE', status: 'DOWNGRADED' }); // genuine second downgrade: PRO -> FREE locks again
      assert.strictEqual((await sub(fx)).requiresProjectSelection, true);
      await call('owner', 'POST', `/accounts/${fx.accountA}/select-active-projects`, { activeProjectIds: [fx.projectA1] });
      assert.strictEqual((await sub(fx)).requiresProjectSelection, false);
      const before = (await readOnly(fx)).length;

      await webhook({ accountId: fx.accountA, tier: 'FREE', status: 'DOWNGRADED' }, 'subscription.downgraded'); // already there: not a transition
      await webhook({ accountId: fx.accountA }, 'invoice.paid'); // ordinary event
      assert.strictEqual((await readOnly(fx)).length, before, 'repeated events must not lock the owner chosen project again');
      assert.strictEqual((await sub(fx)).requiresProjectSelection, false, 'a renewal must not touch the pending flag');
    });
  });

  describe('account audit trail (SCR-AUD-02)', () => {
    it('returns only account-level events to the owner, and 403 to admins and other tenants', async () => {
      // workspace-level events carry the account id too (invitations, tasks): they must not appear in the account trail
      await prisma.auditLog.createMany({
        data: [
          { accountId: fx.accountA, workspaceId: fx.workspaceA, actorUserId: fx.users.owner, action: 'WORKSPACE_INVITATION_ISSUED' },
          { accountId: fx.accountA, workspaceId: fx.workspaceA, actorUserId: fx.users.owner, action: 'WORKSPACE_CREATED' },
        ],
      });
      const r = await call('owner', 'GET', `/audit-logs?accountId=${fx.accountA}&limit=100`);
      assert.strictEqual(r.status, 200);
      const logs = r.json.data.logs as any[];
      assert.ok(logs.length >= 3);
      assert.ok(logs.every((l) => l.accountId === fx.accountA), 'only that account events');
      const actions = new Set(logs.map((l) => l.action));
      assert.ok(actions.has('SUBSCRIPTION_UPDATED') && actions.has('PROJECT_SELECTION_CONFIRMED') && actions.has('WORKSPACE_CREATED'));
      assert.ok(!actions.has('WORKSPACE_INVITATION_ISSUED'), 'workspace activity stays out of the account trail');
      assert.ok([...actions].every((a) => /^(ACCOUNT_|SUBSCRIPTION_)/.test(a as string) || ['PROJECT_SELECTION_CONFIRMED', 'WORKSPACE_CREATED'].includes(a as string)));
      const everything = await call('owner', 'GET', `/audit-logs?limit=100`);
      assert.ok(everything.json.data.logs.some((l: any) => l.action === 'WORKSPACE_INVITATION_ISSUED'), 'the default view still shows it');
      const confirmed = logs.find((l) => l.action === 'PROJECT_SELECTION_CONFIRMED');
      assert.ok(confirmed.actor && confirmed.actor.name, 'the actor is resolved to a name');

      const filtered = await call('owner', 'GET', `/audit-logs?accountId=${fx.accountA}&action=SUBSCRIPTION_UPDATED`);
      assert.ok(filtered.json.data.logs.every((l: any) => l.action === 'SUBSCRIPTION_UPDATED'));

      for (const who of ['admin2', 'outsider']) {
        const denied = await call(who, 'GET', `/audit-logs?accountId=${fx.accountA}`);
        assert.strictEqual(denied.status, 403, who);
        assert.strictEqual(code(denied), 'PERMISSION_DENIED');
      }
    });
  });

  describe('offboarding and purge (DEC-15, D-13)', () => {
    const offboard = (who: string, f: Fixture, body: object) => call(who, 'POST', `/accounts/${f.accountA}/offboard`, body);
    const good = () => ({ passwordConfirmation: 'Password123!', slugConfirmation: `acct-a-${fx2.run}` });

    it('refuses without the exact slug and the owner password, and for non-owners', async () => {
      assert.strictEqual((await offboard('owner2', fx2, { passwordConfirmation: 'Password123!' })).status, 400);
      const slug = await offboard('owner2', fx2, { ...good(), slugConfirmation: 'wrong-slug' });
      assert.strictEqual(slug.status, 400);
      assert.strictEqual(code(slug), 'SLUG_CONFIRMATION_MISMATCH');
      const pw = await offboard('owner2', fx2, { ...good(), passwordConfirmation: 'Nope12345!' });
      assert.strictEqual(pw.status, 401);
      assert.strictEqual(code(pw), 'INVALID_PASSWORD_CONFIRMATION');
      assert.strictEqual((await offboard('admin22', fx2, good())).status, 403);
      assert.strictEqual((await prisma.account.findUniqueOrThrow({ where: { id: fx2.accountA } })).offboardingState, 'NONE');
    });

    it('locks the account, cancels billing, audits it, and blocks every write', async () => {
      const task = await prisma.task.create({ data: { projectId: fx2.projectA1, title: 'Doomed', authorId: fx2.users.owner } });
      await prisma.taskComment.create({ data: { taskId: task.id, authorId: fx2.users.owner, content: 'bye' } });

      const r = await offboard('owner2', fx2, good());
      assert.strictEqual(r.status, 202);
      assert.strictEqual(r.json.data.offboardingState, 'PENDING');
      assert.ok((await sub(fx2)).canceledAt, 'billing is cancelled');
      assert.ok(await prisma.auditLog.findFirst({ where: { accountId: fx2.accountA, action: 'ACCOUNT_OFFBOARDING_INITIATED', actorUserId: fx2.users.owner } }));

      const again = await offboard('owner2', fx2, good());
      assert.strictEqual(again.status, 409);
      assert.strictEqual(code(again), 'ACCOUNT_ALREADY_OFFBOARDING');

      const write = await call('owner2', 'POST', `/workspaces/${fx2.workspaceA}/projects`, { name: 'Nope', key: 'NOP' });
      assert.strictEqual(write.status, 403);
      assert.strictEqual(code(write), 'ACCOUNT_OFFBOARDING_LOCKED');
    });

    it('refuses to purge an account that is not offboarding', async () => {
      const purge = app.get(AccountPurgeService);
      await assert.rejects(() => purge.purgeAccount(fx.accountA), (e: any) => e.getResponse().code === 'ACCOUNT_NOT_OFFBOARDING');
    });

    it('purges child-first, keeps audit history and users, and is a no-op target afterwards', async () => {
      const purge = app.get(AccountPurgeService);
      const counts = await purge.purgeAccount(fx2.accountA);
      assert.deepEqual([counts.workspaces, counts.projects, counts.tasks, counts.comments], [1, 2, 1, 1]);
      assert.strictEqual(await prisma.account.count({ where: { id: fx2.accountA } }), 0);
      assert.strictEqual(await prisma.workspace.count({ where: { id: fx2.workspaceA } }), 0);
      assert.strictEqual(await prisma.project.count({ where: { id: { in: [fx2.projectA1, fx2.projectA2] } } }), 0);
      assert.strictEqual(await prisma.task.count({ where: { projectId: fx2.projectA1 } }), 0);
      assert.strictEqual(await prisma.accountSubscription.count({ where: { accountId: fx2.accountA } }), 0);
      assert.strictEqual(await prisma.user.count({ where: { id: fx2.users.owner } }), 1, 'people are not deleted');
      assert.strictEqual(await prisma.workspace.count({ where: { id: fx2.workspaceB } }), 1, 'other tenants are untouched');
      assert.ok(await prisma.auditLog.findFirst({ where: { accountId: fx2.accountA, action: 'ACCOUNT_OFFBOARDING_INITIATED' } }), 'audit history survives');
      assert.ok(await prisma.auditLog.findFirst({ where: { accountId: fx2.accountA, action: 'ACCOUNT_PURGED' } }));
      await assert.rejects(() => purge.purgeAccount(fx2.accountA), (e: any) => e.getResponse().code === 'RESOURCE_NOT_FOUND');
    });
  });
});
