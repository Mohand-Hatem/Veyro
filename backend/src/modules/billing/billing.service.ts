import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { WebhookEventDto } from './dto/webhook-event.dto';
import { SelectActiveProjectsDto } from './dto/select-active-projects.dto';
import {
  SubscriptionPlanTier,
  SubscriptionPaymentStatus,
  AiPlanTier,
} from '@prisma/client';

export const TIER_PROJECT_LIMITS: Record<SubscriptionPlanTier, number> = {
  [SubscriptionPlanTier.FREE]: 3,
  [SubscriptionPlanTier.PRO]: 7,
  [SubscriptionPlanTier.ENTERPRISE]: 15,
  [SubscriptionPlanTier.EPIC]: 25,
};

@Injectable()
export class BillingService {
  constructor(private readonly prisma: PrismaService) {}

  async getAccountSubscription(accountId: string) {
    const subscription = await this.prisma.accountSubscription.findUnique({
      where: { accountId },
      include: {
        account: {
          select: { id: true, name: true, slug: true },
        },
      },
    });

    if (!subscription) {
      throw new NotFoundException({
        code: 'RESOURCE_NOT_FOUND',
        message: 'Account subscription not found.',
      });
    }

    const currentProjectCount = await this.prisma.project.count({
      where: {
        workspace: { accountId },
        deletedAt: null,
      },
    });

    return {
      subscription,
      limits: {
        tier: subscription.tier,
        maxProjects: TIER_PROJECT_LIMITS[subscription.tier],
        currentProjects: currentProjectCount,
      },
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

  async handleWebhook(dto: WebhookEventDto) {
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
          accountSubId = targetAccount.subscription.id;

          const newTier = dto.data.tier || targetAccount.subscription.tier;
          const newStatus = dto.data.status || targetAccount.subscription.status;
          const isDowngradeToFree =
            newTier === SubscriptionPlanTier.FREE ||
            newStatus === SubscriptionPaymentStatus.DOWNGRADED;

          await tx.accountSubscription.update({
            where: { id: targetAccount.subscription.id },
            data: {
              tier: newTier,
              status: newStatus,
              providerCustomerId: dto.data.providerCustomerId || targetAccount.subscription.providerCustomerId,
              providerSubscriptionId: dto.data.providerSubscriptionId || targetAccount.subscription.providerSubscriptionId,
              requiresProjectSelection: isDowngradeToFree,
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

          await tx.userAiSubscription.update({
            where: { id: targetUserAi.id },
            data: {
              tier: dto.data.tier || targetUserAi.tier,
              dailyQuota: dto.data.dailyQuota || targetUserAi.dailyQuota,
              status: dto.data.status || targetUserAi.status,
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

    // Verify all selected projects belong to workspaces owned by this account
    if (dto.activeProjectIds.length > 0) {
      const candidateProjects = await this.prisma.project.findMany({
        where: {
          id: { in: dto.activeProjectIds },
          workspace: { accountId },
          deletedAt: null,
        },
      });

      if (candidateProjects.length !== dto.activeProjectIds.length) {
        throw new BadRequestException({
          code: 'INVALID_PROJECT_SELECTION',
          message: 'One or more selected projects do not belong to this account.',
        });
      }
    }

    return this.prisma.$transaction(async (tx) => {
      // 1. Mark selected projects as editable (isBillingReadOnly = false)
      if (dto.activeProjectIds.length > 0) {
        await tx.project.updateMany({
          where: {
            id: { in: dto.activeProjectIds },
          },
          data: {
            isBillingReadOnly: false,
          },
        });
      }

      // 2. Mark all other unselected projects of this account as Read-only
      await tx.project.updateMany({
        where: {
          workspace: { accountId },
          id: { notIn: dto.activeProjectIds },
          deletedAt: null,
        },
        data: {
          isBillingReadOnly: true,
        },
      });

      // 3. Clear requiresProjectSelection flag
      if (account.subscription) {
        await tx.accountSubscription.update({
          where: { id: account.subscription.id },
          data: {
            requiresProjectSelection: false,
          },
        });
      }

      await tx.auditLog.create({
        data: {
          actorUserId: userId,
          accountId,
          action: 'PROJECT_SELECTION_CONFIRMED',
          metadata: {
            selectedProjectIds: dto.activeProjectIds,
          },
        },
      });

      return {
        success: true,
        activeProjectCount: dto.activeProjectIds.length,
      };
    });
  }
}
