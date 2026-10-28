import { PrismaService } from '../../src/prisma/prisma.service';
import { AccountPurgeService } from '../../src/modules/tenancy/account-purge.service';

/** Cleanup must survive the same flaky link the tests may have hit, so every step is retried a few times. */
async function retry<T>(step: () => Promise<T>): Promise<T> {
  for (let attempt = 0; ; attempt++) {
    try {
      return await step();
    } catch (e) {
      if (attempt >= 4) throw e;
      await new Promise((r) => setTimeout(r, 1500));
    }
  }
}

/**
 * Removes everything the journeys created for these people. Accounts go through the product's own child-first purge
 * (an account must be in offboarding to be purged, so it is put there first if a failed journey left it active).
 */
export async function cleanupJourneyUsers(prisma: PrismaService, purge: AccountPurgeService, userIds: string[]) {
  const accounts = await retry(() => prisma.account.findMany({ where: { ownerId: { in: userIds } }, select: { id: true } }));
  const accountIds = accounts.map((a) => a.id);
  for (const id of accountIds) {
    await retry(() => prisma.account.update({ where: { id }, data: { offboardingState: 'PENDING' } }));
    await retry(() => purge.purgeAccount(id));
  }
  await retry(() => prisma.auditLog.deleteMany({ where: { OR: [{ actorUserId: { in: userIds } }, { accountId: { in: accountIds } }] } }));
  await retry(() => prisma.aiMutationProposal.deleteMany({ where: { conversation: { userId: { in: userIds } } } }));
  await retry(() => prisma.aiConversation.deleteMany({ where: { userId: { in: userIds } } }));
  await retry(() => prisma.aiUsageReservation.deleteMany({ where: { userId: { in: userIds } } }));
  await retry(() => prisma.aiDailyUsage.deleteMany({ where: { userId: { in: userIds } } }));
  await retry(() => prisma.userAiSubscription.deleteMany({ where: { userId: { in: userIds } } }));
  await retry(() => prisma.userOtpVerification.deleteMany({ where: { userId: { in: userIds } } }));
  await retry(() => prisma.userPasswordResetToken.deleteMany({ where: { userId: { in: userIds } } }));
  await retry(() => prisma.userSession.deleteMany({ where: { userId: { in: userIds } } }));
  await retry(() => prisma.user.deleteMany({ where: { id: { in: userIds } } }));
}
