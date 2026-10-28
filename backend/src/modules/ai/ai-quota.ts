import { AiPlanTier, SubscriptionPaymentStatus, SubscriptionPlanTier } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

/**
 * Messages a person may send the assistant per day, by plan (BR-SUB-01.3). The number follows the best plan among the
 * accounts the person OWNS: members of someone else's workspace stay on the Free number. This replaces the old rule that the
 * AI plan is independent of the account plan (BR-SUB-01.10), because the only thing Stripe sells is the account plan.
 */
export const TIER_AI_DAILY_QUOTA: Record<SubscriptionPlanTier, number> = {
  [SubscriptionPlanTier.FREE]: 3,
  [SubscriptionPlanTier.PRO]: 15,
  [SubscriptionPlanTier.ENTERPRISE]: 25,
  [SubscriptionPlanTier.EPIC]: 50,
};

export interface EffectiveAiQuota {
  tier: AiPlanTier;
  dailyQuota: number;
  status: SubscriptionPaymentStatus;
}

/**
 * The limit that applies to this person right now. The tier is read from the account subscription as it is stored: a
 * downgrade after the grace period or a cancellation already writes FREE there, so no date maths is repeated here.
 * The personal AI subscription row (default 3, editable through billing events) acts as a floor.
 */
export async function effectiveAiQuota(prisma: PrismaService, userId: string): Promise<EffectiveAiQuota> {
  const [personal, owned] = await Promise.all([
    prisma.userAiSubscription.upsert({ where: { userId }, create: { userId, dailyQuota: TIER_AI_DAILY_QUOTA.FREE }, update: {} }),
    prisma.accountSubscription.findMany({ where: { account: { ownerId: userId } }, select: { tier: true } }),
  ]);
  const best = owned.reduce<{ tier: SubscriptionPlanTier; quota: number } | null>((acc, o) => {
    const quota = TIER_AI_DAILY_QUOTA[o.tier];
    return !acc || quota > acc.quota ? { tier: o.tier, quota } : acc;
  }, null);
  if (best && best.quota > personal.dailyQuota) return { tier: best.tier as AiPlanTier, dailyQuota: best.quota, status: personal.status };
  return { tier: personal.tier, dailyQuota: personal.dailyQuota, status: personal.status };
}
