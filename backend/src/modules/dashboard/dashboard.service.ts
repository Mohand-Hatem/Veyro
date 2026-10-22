import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import {
  SubscriptionPaymentStatus,
  SubscriptionPlanTier,
  TaskStatus,
  WorkspaceRole,
} from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { TIER_PROJECT_LIMITS } from '../billing/billing.service';

const OPEN_STATUSES: TaskStatus[] = [TaskStatus.TODO, TaskStatus.IN_PROGRESS, TaskStatus.IN_REVIEW];
const WEEK_MS = 7 * 24 * 60 * 60 * 1000;
const MY_TASKS_LIMIT = 10;
const TOP_MEMBERS = 3;

type BillingState = 'OK' | 'GRACE' | 'PAST_DUE' | 'READ_ONLY';

/**
 * Read model behind the workspace dashboard (CS-01, ADR-001, docs/06 §2.3.1).
 *
 * Security notes
 *  - The caller's role is resolved here from the database (defense in depth); it never trusts request flags.
 *  - Members only ever see projects they are assigned to. Every aggregate below is restricted to `projectIds`.
 *  - Admin-only blocks (`capacity`, `notices`, `workload`, `counts.members`) are `null` for Members.
 *  - All collections are bounded, so no pagination is required.
 */
@Injectable()
export class DashboardService {
  constructor(private readonly prisma: PrismaService) {}

  async getDashboard(userId: string, workspaceId: string) {
    const workspace = await this.prisma.workspace.findUnique({
      where: { id: workspaceId },
      include: {
        account: { select: { id: true, ownerId: true, subscription: true } },
        members: { include: { user: { select: { id: true, name: true, avatarUrl: true } } }, orderBy: { joinedAt: 'asc' } },
      },
    });
    if (!workspace) {
      throw new NotFoundException({ code: 'RESOURCE_NOT_FOUND', message: 'Workspace not found.' });
    }

    const membership = workspace.members.find((m) => m.userId === userId);
    const isAccountOwner = workspace.account.ownerId === userId;
    if (!membership && !isAccountOwner) {
      throw new ForbiddenException({ code: 'PERMISSION_DENIED', message: 'You are not a member of this workspace.' });
    }
    const role: WorkspaceRole = isAccountOwner ? WorkspaceRole.ADMIN : membership!.role;
    const isPrivileged = role === WorkspaceRole.ADMIN;

    // 1. Visible projects (Members: assigned only).
    const projects = await this.prisma.project.findMany({
      where: {
        workspaceId,
        deletedAt: null,
        ...(isPrivileged ? {} : { members: { some: { userId } } }),
      },
      orderBy: { createdAt: 'desc' },
      include: {
        _count: { select: { members: true } },
        members: {
          take: TOP_MEMBERS,
          orderBy: { assignedAt: 'asc' },
          include: { user: { select: { id: true, name: true, avatarUrl: true } } },
        },
      },
    });
    const projectIds = projects.map((p) => p.id);
    const inVisible = { projectId: { in: projectIds }, deletedAt: null };
    const now = new Date();
    const startOfDay = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
    const endOfDay = new Date(startOfDay.getTime() + 24 * 60 * 60 * 1000);

    // 2. Aggregates: fixed number of queries, independent of the number of projects.
    const [statusGroups, myOpenTasks, myDueToday, completedThisWeek, myTasks, workloadGroups, accountProjectCount] =
      await Promise.all([
        this.prisma.task.groupBy({ by: ['projectId', 'status'], where: inVisible, _count: { _all: true } }),
        this.prisma.task.count({ where: { ...inVisible, assigneeId: userId, status: { in: OPEN_STATUSES } } }),
        this.prisma.task.count({
          where: { ...inVisible, assigneeId: userId, status: { in: OPEN_STATUSES }, dueDate: { gte: startOfDay, lt: endOfDay } },
        }),
        this.prisma.task.count({ where: { ...inVisible, completedAt: { gte: new Date(now.getTime() - WEEK_MS) } } }),
        this.prisma.task.findMany({
          where: { ...inVisible, assigneeId: userId, status: { in: OPEN_STATUSES } },
          orderBy: [{ dueDate: { sort: 'asc', nulls: 'last' } }, { priority: 'desc' }, { createdAt: 'desc' }],
          take: MY_TASKS_LIMIT,
          select: {
            id: true, title: true, status: true, priority: true, dueDate: true,
            project: { select: { id: true, key: true, name: true } },
          },
        }),
        isPrivileged
          ? this.prisma.task.groupBy({
              by: ['assigneeId'],
              where: { ...inVisible, assigneeId: { not: null }, status: { in: OPEN_STATUSES } },
              _count: { _all: true },
            })
          : Promise.resolve(null),
        isPrivileged
          ? this.prisma.project.count({ where: { workspace: { accountId: workspace.accountId }, deletedAt: null } })
          : Promise.resolve(0),
      ]);

    // 3. Fold status groups into per-project counters.
    const perProject = new Map<string, { todo: number; inProgress: number; inReview: number; done: number; cancelled: number }>();
    const blank = () => ({ todo: 0, inProgress: 0, inReview: 0, done: 0, cancelled: 0 });
    let openTasks = 0;
    for (const g of statusGroups) {
      const bucket = perProject.get(g.projectId) ?? blank();
      const n = g._count._all;
      switch (g.status) {
        case TaskStatus.TODO: bucket.todo += n; openTasks += n; break;
        case TaskStatus.IN_PROGRESS: bucket.inProgress += n; openTasks += n; break;
        case TaskStatus.IN_REVIEW: bucket.inReview += n; openTasks += n; break;
        case TaskStatus.DONE: bucket.done += n; break;
        case TaskStatus.CANCELLED: bucket.cancelled += n; break;
      }
      perProject.set(g.projectId, bucket);
    }

    // 4. Admin-only blocks.
    const sub = workspace.account.subscription;
    const tier = sub?.tier ?? SubscriptionPlanTier.FREE;
    const workloadByUser = new Map((workloadGroups ?? []).map((g) => [g.assigneeId as string, g._count._all]));

    return {
      viewer: { userId, role, isAccountOwner },
      workspace: { id: workspace.id, name: workspace.name, slug: workspace.slug },
      capacity: isPrivileged
        ? { tier, maxProjects: TIER_PROJECT_LIMITS[tier], currentProjects: accountProjectCount }
        : null,
      notices: isPrivileged ? this.billingNotices(sub, now) : null,
      counts: {
        members: isPrivileged ? workspace.members.length : null,
        projects: projects.length,
        openTasks,
        myOpenTasks,
        myDueToday,
        completedThisWeek,
      },
      projects: projects.map((p) => ({
        id: p.id,
        key: p.key,
        name: p.name,
        lifecycleStatus: p.lifecycleStatus,
        isBillingReadOnly: p.isBillingReadOnly,
        createdAt: p.createdAt,
        memberCount: p._count.members,
        members: p.members.map((m) => ({ userId: m.user.id, name: m.user.name, avatarUrl: m.user.avatarUrl })),
        tasks: perProject.get(p.id) ?? blank(),
      })),
      myTasks,
      workload: isPrivileged
        ? workspace.members
            .map((m) => ({
              userId: m.user.id,
              name: m.user.name,
              avatarUrl: m.user.avatarUrl,
              openTasks: workloadByUser.get(m.user.id) ?? 0,
            }))
            .sort((a, b) => b.openTasks - a.openTasks || a.name.localeCompare(b.name))
        : null,
    };
  }

  /** Maps the stored subscription onto a small, payment-detail-free state for Admins. */
  private billingNotices(
    sub: { status: SubscriptionPaymentStatus; gracePeriodEndsAt: Date | null; requiresProjectSelection: boolean } | null,
    now: Date,
  ) {
    let billingState: BillingState = 'OK';
    if (sub) {
      if (sub.requiresProjectSelection || sub.status === SubscriptionPaymentStatus.DOWNGRADED) billingState = 'READ_ONLY';
      else if (sub.status === SubscriptionPaymentStatus.PAST_DUE) {
        billingState = sub.gracePeriodEndsAt && sub.gracePeriodEndsAt > now ? 'GRACE' : 'PAST_DUE';
      }
    }
    return {
      billingState,
      gracePeriodEndsAt: sub?.gracePeriodEndsAt ?? null,
      requiresProjectSelection: sub?.requiresProjectSelection ?? false,
    };
  }
}
