import 'dotenv/config';
import { describe, it, before, after } from 'node:test';
import * as assert from 'node:assert/strict';
import { TaskStatus, TaskPriority, SubscriptionPaymentStatus } from '@prisma/client';
import { PrismaService } from '../src/prisma/prisma.service';
import { DashboardService } from '../src/modules/dashboard/dashboard.service';
import { buildFixture, Fixture } from './helpers/fixture';

const DAY = 24 * 60 * 60 * 1000;

describe('CS-01 / ADR-001: workspace dashboard read model', () => {
  let prisma: PrismaService;
  let dash: DashboardService;
  let fx: Fixture;

  const task = (projectId: string, over: Record<string, any>) =>
    prisma.task.create({ data: { projectId, authorId: fx.users.owner, title: 'T', ...over } as any });

  before(async () => {
    prisma = new PrismaService();
    await prisma.onModuleInit();
    dash = new DashboardService(prisma);
    fx = await buildFixture(prisma);
    const today = new Date();
    today.setUTCHours(12, 0, 0, 0);

    // Project A1 (members: owner, memberA)
    await task(fx.projectA1, { status: TaskStatus.TODO, assigneeId: fx.users.owner, priority: TaskPriority.URGENT, dueDate: today, title: 'Owner today' });
    await task(fx.projectA1, { status: TaskStatus.IN_PROGRESS, assigneeId: fx.users.owner, title: 'Owner doing' });
    await task(fx.projectA1, { status: TaskStatus.IN_REVIEW, assigneeId: fx.users.memberA, title: 'MemberA review' });
    await task(fx.projectA1, { status: TaskStatus.DONE, assigneeId: fx.users.memberA, completedAt: new Date(Date.now() - 2 * DAY), title: 'Done recently' });
    await task(fx.projectA1, { status: TaskStatus.DONE, assigneeId: fx.users.memberA, completedAt: new Date(Date.now() - 10 * DAY), title: 'Done long ago' });
    await task(fx.projectA1, { status: TaskStatus.CANCELLED, title: 'Cancelled' });
    await task(fx.projectA1, { status: TaskStatus.TODO, assigneeId: fx.users.owner, deletedAt: new Date(), title: 'Soft deleted' });
    // Project A2 (no assigned members: privileged roles only)
    await task(fx.projectA2, { status: TaskStatus.TODO, assigneeId: fx.users.admin2, title: 'A2 one' });
    await task(fx.projectA2, { status: TaskStatus.TODO, assigneeId: fx.users.admin2, title: 'A2 two' });
    // Foreign tenant
    await task(fx.projectB1, { status: TaskStatus.TODO, assigneeId: fx.users.outsider, title: 'Foreign' });
  });

  after(async () => {
    try {
      await fx.cleanup();
    } finally {
      await prisma.onModuleDestroy();
    }
  });

  describe('Admin / Account Owner view', () => {
    it('lists every project of the workspace with keys and task counts, nothing from other tenants', async () => {
      const d: any = await dash.getDashboard(fx.users.owner, fx.workspaceA);
      assert.deepEqual(d.projects.map((p: any) => p.key).sort(), ['ALP', 'BET']);
      const alp = d.projects.find((p: any) => p.key === 'ALP');
      assert.deepEqual(alp.tasks, { todo: 1, inProgress: 1, inReview: 1, done: 2, cancelled: 1 }, 'soft-deleted task excluded');
      assert.strictEqual(alp.memberCount, 2);
      assert.ok(alp.members.length <= 3);
      assert.ok(!JSON.stringify(d).includes('Foreign'));
    });

    it('computes counts: open tasks, my tasks, due today, completed this week', async () => {
      const d: any = await dash.getDashboard(fx.users.owner, fx.workspaceA);
      assert.strictEqual(d.counts.openTasks, 5, 'A1 open (1+1+1) + A2 open (2)');
      assert.strictEqual(d.counts.myOpenTasks, 2);
      assert.strictEqual(d.counts.myDueToday, 1);
      assert.strictEqual(d.counts.completedThisWeek, 1, 'only the task completed 2 days ago');
      assert.strictEqual(d.counts.projects, 2);
      assert.strictEqual(d.counts.members, 4);
    });

    it('returns my open tasks ordered by due date with project keys', async () => {
      const d: any = await dash.getDashboard(fx.users.owner, fx.workspaceA);
      assert.strictEqual(d.myTasks[0].title, 'Owner today');
      assert.strictEqual(d.myTasks[0].project.key, 'ALP');
      assert.ok(d.myTasks.length <= 10);
      assert.ok(d.myTasks.every((t: any) => ['TODO', 'IN_PROGRESS', 'IN_REVIEW'].includes(t.status)));
    });

    it('exposes workload per member (including idle members) and plan capacity', async () => {
      const d: any = await dash.getDashboard(fx.users.owner, fx.workspaceA);
      const by = Object.fromEntries(d.workload.map((w: any) => [w.userId, w.openTasks]));
      assert.strictEqual(by[fx.users.owner], 2);
      assert.strictEqual(by[fx.users.admin2], 2);
      assert.strictEqual(by[fx.users.memberA], 1);
      assert.strictEqual(by[fx.users.memberB], 0);
      assert.deepEqual(d.capacity, { tier: 'PRO', maxProjects: 7, currentProjects: 2 });
      assert.strictEqual(d.viewer.isAccountOwner, true);
    });

    it('derives billing notices from the subscription', async () => {
      const ok: any = await dash.getDashboard(fx.users.admin2, fx.workspaceA);
      assert.strictEqual(ok.notices.billingState, 'OK');
      assert.strictEqual(ok.viewer.isAccountOwner, false);

      await prisma.accountSubscription.update({
        where: { accountId: fx.accountA },
        data: { status: SubscriptionPaymentStatus.PAST_DUE, gracePeriodEndsAt: new Date(Date.now() + 3 * DAY) },
      });
      assert.strictEqual(((await dash.getDashboard(fx.users.owner, fx.workspaceA)) as any).notices.billingState, 'GRACE');

      await prisma.accountSubscription.update({
        where: { accountId: fx.accountA },
        data: { gracePeriodEndsAt: new Date(Date.now() - DAY) },
      });
      assert.strictEqual(((await dash.getDashboard(fx.users.owner, fx.workspaceA)) as any).notices.billingState, 'PAST_DUE');

      await prisma.accountSubscription.update({
        where: { accountId: fx.accountA },
        data: { status: SubscriptionPaymentStatus.DOWNGRADED, requiresProjectSelection: true },
      });
      const ro: any = await dash.getDashboard(fx.users.owner, fx.workspaceA);
      assert.strictEqual(ro.notices.billingState, 'READ_ONLY');
      assert.strictEqual(ro.notices.requiresProjectSelection, true);
    });
  });

  describe('Member view (least privilege)', () => {
    it('only returns assigned projects and hides admin-only blocks', async () => {
      const d: any = await dash.getDashboard(fx.users.memberA, fx.workspaceA);
      assert.deepEqual(d.projects.map((p: any) => p.key), ['ALP']);
      assert.strictEqual(d.capacity, null);
      assert.strictEqual(d.notices, null);
      assert.strictEqual(d.workload, null);
      assert.strictEqual(d.counts.members, null);
      assert.strictEqual(d.viewer.role, 'MEMBER');
    });

    it('scopes counts and my tasks to the projects the member can see', async () => {
      const d: any = await dash.getDashboard(fx.users.memberA, fx.workspaceA);
      assert.strictEqual(d.counts.openTasks, 3, 'A1 only; A2 tasks are invisible');
      assert.strictEqual(d.counts.myOpenTasks, 1);
      assert.deepEqual(d.myTasks.map((t: any) => t.title), ['MemberA review']);
    });

    it('a member with no assigned project gets an empty, zeroed dashboard', async () => {
      const d: any = await dash.getDashboard(fx.users.memberB, fx.workspaceA);
      assert.deepEqual(d.projects, []);
      assert.strictEqual(d.counts.openTasks, 0);
      assert.deepEqual(d.myTasks, []);
    });
  });

  describe('Tenant isolation', () => {
    it('refuses a caller who is not a member of the workspace (403)', async () => {
      await assert.rejects(
        () => dash.getDashboard(fx.users.outsider, fx.workspaceA),
        (e: any) => {
          assert.strictEqual(e.status, 403);
          assert.strictEqual(e.response?.code, 'PERMISSION_DENIED');
          return true;
        },
      );
    });

    it('returns 404 for an unknown workspace', async () => {
      await assert.rejects(() => dash.getDashboard(fx.users.owner, 'does-not-exist'), (e: any) => e.status === 404);
    });
  });
});
