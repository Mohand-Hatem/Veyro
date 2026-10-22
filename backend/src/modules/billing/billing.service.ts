import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { WebhookEventDto } from './dto/webhook-event.dto';
import { SelectActiveProjectsDto } from './dto/select-active-projects.dto';
import {
  SubscriptionPlanTier,
  SubscriptionPaymentStatus,
  AiPlanTier,
  Prisma,
} from '@prisma/client';

export const TIER_PROJECT_LIMITS: Record<SubscriptionPlanTier, number> = {
  [SubscriptionPlanTier.FREE]: 3,
  [SubscriptionPlanTier.PRO]: 7,
  [SubscriptionPlanTier.ENTERPRISE]: 15,
  [SubscriptionPlanTier.EPIC]: 25,
};

/** BR-SUB-02: workspaces per account. `null` = unlimited (Epic). */
export const TIER_WORKSPACE_LIMITS: Record<SubscriptionPlanTier, number | null> = {
  [SubscriptionPlanTier.FREE]: 1,
  [SubscriptionPlanTier.PRO]: 3,
  [SubscriptionPlanTier.ENTERPRISE]: 10,
  [SubscriptionPlanTier.EPIC]: null,
};

/** BR-SUB-03.1 / BR-SUB-01: a failed renewal keeps full plan benefits for 7 days. */
export const GRACE_PERIOD_DAYS = 7;
const DAY_MS = 86_400_000;
const BILLING_HISTORY_LIMIT = 24;

@Injectable()
export class BillingService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Owner-only billing overview (CS-07, ADR-014). Provider identifiers are never returned (no payment details
   * leave the server). `grace` is derived from the stored end date so the UI can show a countdown.
   */
  async getAccountSubscription(accountId: string) {
    const subscription = await this.prisma.accountSubscription.findUnique({
      where: { accountId },
      include: {
        account: {
          select: { id: true, name: true, slug: true, offboardingState: true },
        },
      },
    });

    if (!subscription) {
      throw new NotFoundException({
        code: 'RESOURCE_NOT_FOUND',
        message: 'Account subscription not found.',
      });
    }

    const [currentProjects, currentWorkspaces, readOnlyProjects] = await Promise.all([
      // Archived projects count toward the limit, soft-deleted ones do not (BR-SUB-02.3).
      this.prisma.project.count({ where: { workspace: { accountId }, deletedAt: null } }),
      this.prisma.workspace.count({ where: { accountId } }),
      this.prisma.project.count({ where: { workspace: { accountId }, deletedAt: null, isBillingReadOnly: true } }),
    ]);

    const { account, providerCustomerId: _c, providerSubscriptionId: _s, ...plan } = subscription;
    const endsAt = subscription.gracePeriodEndsAt;
    const msLeft = endsAt ? endsAt.getTime() - Date.now() : null;

    return {
      account,
      subscription: plan,
      limits: {
        tier: subscription.tier,
        maxProjects: TIER_PROJECT_LIMITS[subscription.tier],
        currentProjects,
        maxWorkspaces: TIER_WORKSPACE_LIMITS[subscription.tier],
        currentWorkspaces,
      },
      grace:
        subscription.status === SubscriptionPaymentStatus.PAST_DUE && endsAt && msLeft !== null
          ? { endsAt, daysLeft: Math.max(0, Math.ceil(msLeft / DAY_MS)), expired: msLeft <= 0 }
          : null,
      readOnlyProjects,
    };
  }

  /** Billing history for the owner: newest first, bounded, without provider event ids. */
  async listBillingEvents(accountId: string) {
    const events = await this.prisma.billingEvent.findMany({
      where: { accountSubscription: { accountId } },
      orderBy: [{ occurredAt: 'desc' }, { id: 'desc' }],
      take: BILLING_HISTORY_LIMIT,
      select: { id: true, eventType: true, amount: true, currency: true, occurredAt: true },
    });
    return { events };
  }

  /**
   * Every project of the account with its workspace and billing state, for the downgrade selection (SCR-SET-03).
   * Bounded by the plan cap (max 25 projects), so it is not paginated. Soft-deleted projects are not listed.
   */
  async listAccountProjects(accountId: string) {
    const sub = await this.prisma.accountSubscription.findUnique({ where: { accountId } });
    if (!sub) {
      throw new NotFoundException({ code: 'RESOURCE_NOT_FOUND', message: 'Account subscription not found.' });
    }
    const projects = await this.prisma.project.findMany({
      where: { workspace: { accountId }, deletedAt: null },
      orderBy: [{ workspace: { name: 'asc' } }, { name: 'asc' }],
      select: {
        id: true,
        key: true,
        name: true,
        lifecycleStatus: true,
        isBillingReadOnly: true,
        updatedAt: true,
        workspace: { select: { id: true, name: true } },
        _count: { select: { tasks: { where: { deletedAt: null } } } },
      },
    });
    return {
      selectionCap: TIER_PROJECT_LIMITS[sub.tier],
      requiresProjectSelection: sub.requiresProjectSelection,
      projects: projects.map(({ _count, ...p }) => ({ ...p, taskCount: _count.tasks })),
    };
  }

  async getUserAiSubscription(userId: string) {
    let sub = await this.prisma.userAiSubscription.findUnique({
      where: { userId },
    });

    if (!sub) {
      sub = await this.prisma.userAiSubscription.create({
        data: {
          userId,
          tier: AiPlanTier.FREE,
          dailyQuota: 3,
        },
      });
    }

    return sub;
  }

  /** The grace window opens on the first PAST_DUE event and is kept on repeats; any other status clears it. */
  private graceEnd(prevStatus: SubscriptionPaymentStatus, prevEnd: Date | null, nextStatus: SubscriptionPaymentStatus): Date | null {
    if (nextStatus !== SubscriptionPaymentStatus.PAST_DUE) return null;
    if (prevStatus === SubscriptionPaymentStatus.PAST_DUE && prevEnd) return prevEnd;
    return new Date(Date.now() + GRACE_PERIOD_DAYS * DAY_MS);
  }

  async handleWebhook(dto: WebhookEventDto) {
    // Boundary validation: unknown tiers or statuses must be a 400, not a database enum error.
    const wantedTier = dto.data?.tier;
    const wantedStatus = dto.data?.status;
    if ((wantedTier !== undefined && !(wantedTier in SubscriptionPlanTier)) || (wantedStatus !== undefined && !(wantedStatus in SubscriptionPaymentStatus))) {
      throw new BadRequestException({ code: 'INVALID_BILLING_EVENT', message: 'Unknown plan tier or payment status.' });
    }

    // 1. Idempotency Verification: Check if event was already processed
    const existing = await this.prisma.billingEvent.findUnique({
      where: { externalEventId: dto.externalEventId },
    });

    if (existing) {
      return {
        received: true,
        deduplicated: true,
        eventId: existing.id,
      };
    }

    // 2. Atomic Transaction Execution
    return this.prisma.$transaction(async (tx) => {
      let accountSubId: string | null = null;
      let userAiSubId: string | null = null;

      if (dto.data?.accountId) {
        const targetAccount = await tx.account.findUnique({
          where: { id: dto.data.accountId },
          include: { subscription: true },
        });

        if (targetAccount?.subscription) {
          const prev = targetAccount.subscription;
          accountSubId = prev.id;

          const newTier = (dto.data.tier as SubscriptionPlanTier) || prev.tier;
          const newStatus = (dto.data.status as SubscriptionPaymentStatus) || prev.status;
          // A downgrade is a transition INTO Free / DOWNGRADED. Repeated events on an account that is
          // already there must not re-lock projects the owner has since reactivated.
          const isDowngradeToFree =
            (newTier === SubscriptionPlanTier.FREE && prev.tier !== SubscriptionPlanTier.FREE) ||
            (newStatus === SubscriptionPaymentStatus.DOWNGRADED && prev.status !== SubscriptionPaymentStatus.DOWNGRADED);
          // An upgrade out of Free never reactivates projects by itself (BR-SUB-03.3): the owner must choose.
          const isUpgradeFromFree = prev.tier === SubscriptionPlanTier.FREE && newTier !== SubscriptionPlanTier.FREE;
          const hasReadOnly = isUpgradeFromFree
            ? (await tx.project.count({ where: { workspace: { accountId: targetAccount.id }, deletedAt: null, isBillingReadOnly: true } })) > 0
            : false;

          await tx.accountSubscription.update({
            where: { id: prev.id },
            data: {
              tier: newTier,
              status: newStatus,
              gracePeriodEndsAt: this.graceEnd(prev.status, prev.gracePeriodEndsAt, newStatus),
              providerCustomerId: dto.data.providerCustomerId || prev.providerCustomerId,
              providerSubscriptionId: dto.data.providerSubscriptionId || prev.providerSubscriptionId,
              // Only a downgrade or an upgrade over read-only projects asks for a selection; ordinary renewals leave it alone.
              requiresProjectSelection: isDowngradeToFree ? true : hasReadOnly ? true : prev.requiresProjectSelection,
            },
          });

          // Invariant (BR-SUB-03): If downgraded to Free, set all existing projects to Read-only hold
          if (isDowngradeToFree) {
            await tx.project.updateMany({
              where: {
                workspace: { accountId: targetAccount.id },
                deletedAt: null,
              },
              data: {
                isBillingReadOnly: true,
              },
            });
          }

          await tx.auditLog.create({
            data: {
              accountId: targetAccount.id,
              action: 'SUBSCRIPTION_UPDATED',
              metadata: {
                externalEventId: dto.externalEventId,
                tier: newTier,
                status: newStatus,
              },
            },
          });
        }
      }

      if (dto.data?.userId) {
        const targetUserAi = await tx.userAiSubscription.findUnique({
          where: { userId: dto.data.userId },
        });

        if (targetUserAi) {
          userAiSubId = targetUserAi.id;
          const nextStatus = (dto.data.status as SubscriptionPaymentStatus) || targetUserAi.status;

          await tx.userAiSubscription.update({
            where: { id: targetUserAi.id },
            data: {
              tier: (dto.data.tier as AiPlanTier) || targetUserAi.tier,
              dailyQuota: dto.data.dailyQuota || targetUserAi.dailyQuota,
              status: nextStatus,
              gracePeriodEndsAt: this.graceEnd(targetUserAi.status, targetUserAi.gracePeriodEndsAt, nextStatus),
            },
          });
        }
      }

      // Record immutable BillingEvent
      const billingEvent = await tx.billingEvent.create({
        data: {
          externalEventId: dto.externalEventId,
          eventType: dto.eventType,
          amount: dto.amount,
          currency: dto.currency,
          accountSubscriptionId: accountSubId,
          userAiSubscriptionId: userAiSubId,
        },
      });

      return {
        received: true,
        success: true,
        eventId: billingEvent.id,
      };
    });
  }

  /**
   * Owner chooses which projects stay (or become) editable (BR-SUB-03). The plan cap is enforced here, not in the DTO,
   * because it depends on the current tier. Unselected projects become read-only; archived projects may be selected
   * and stay archived. Allowed only while a selection is actually pending (after a downgrade, or an upgrade over
   * read-only projects), so it can never be used to lock a healthy account.
   */
  async selectActiveProjects(
    userId: string,
    accountId: string,
    dto: SelectActiveProjectsDto,
  ) {
    const account = await this.prisma.account.findUnique({
      where: { id: accountId },
      include: { subscription: true },
    });

    if (!account) {
      throw new NotFoundException({
        code: 'RESOURCE_NOT_FOUND',
        message: 'Account not found.',
      });
    }

    if (account.ownerId !== userId) {
      throw new BadRequestException({
        code: 'PERMISSION_DENIED',
        message: 'Only the account owner can confirm active projects.',
      });
    }

    const subscription = account.subscription;
    if (!subscription) {
      throw new NotFoundException({ code: 'RESOURCE_NOT_FOUND', message: 'Account subscription not found.' });
    }

    const selected = Array.from(new Set(dto.activeProjectIds));
    const cap = TIER_PROJECT_LIMITS[subscription.tier];
    if (selected.length > cap) {
      throw new BadRequestException({
        code: 'PROJECT_SELECTION_EXCEEDS_LIMIT',
        message: `Your plan allows ${cap} editable projects; ${selected.length} were selected.`,
      });
    }

    const readOnlyCount = await this.prisma.project.count({
      where: { workspace: { accountId }, deletedAt: null, isBillingReadOnly: true },
    });
    if (!subscription.requiresProjectSelection && readOnlyCount === 0) {
      throw new ConflictException({
        code: 'NO_PROJECT_SELECTION_REQUIRED',
        message: 'This account has no pending project selection.',
      });
    }

    // Verify all selected projects belong to workspaces owned by this account
    if (selected.length > 0) {
      const candidateProjects = await this.prisma.project.findMany({
        where: {
          id: { in: selected },
          workspace: { accountId },
          deletedAt: null,
        },
        select: { id: true },
      });

      if (candidateProjects.length !== selected.length) {
        throw new BadRequestException({
          code: 'INVALID_PROJECT_SELECTION',
          message: 'One or more selected projects do not belong to this account.',
        });
      }
    }

    return this.prisma.$transaction(async (tx) => {
      // 1. Mark selected projects as editable (isBillingReadOnly = false)
      if (selected.length > 0) {
        await tx.project.updateMany({
          where: { id: { in: selected }, workspace: { accountId } },
          data: { isBillingReadOnly: false },
        });
      }

      // 2. Mark all other unselected projects of this account as Read-only
      const locked = await tx.project.updateMany({
        where: {
          workspace: { accountId },
          id: { notIn: selected },
          deletedAt: null,
        },
        data: { isBillingReadOnly: true },
      });

      // 3. Clear requiresProjectSelection flag
      await tx.accountSubscription.update({
        where: { id: subscription.id },
        data: { requiresProjectSelection: false },
      });

      await tx.auditLog.create({
        data: {
          actorUserId: userId,
          accountId,
          action: 'PROJECT_SELECTION_CONFIRMED',
          metadata: { selectedProjectIds: selected } as Prisma.InputJsonValue,
        },
      });

      return {
        success: true,
        activeProjectCount: selected.length,
        readOnlyProjectCount: locked.count,
      };
    });
  }
}
