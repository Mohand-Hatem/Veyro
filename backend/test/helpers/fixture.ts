import * as bcrypt from 'bcrypt';
import { PrismaService } from '../../src/prisma/prisma.service';
import { WorkspaceRole, SubscriptionPlanTier } from '@prisma/client';

/**
 * Isolated multi-tenant fixture for CS-01 tests.
 * Everything is created with a unique run suffix and removed in cleanup(), because the flow tests
 * run against the shared development database.
 *
 *  tenant A : owner (account owner + ADMIN), admin2 (ADMIN), memberA (MEMBER on projectA1), memberB (MEMBER, unassigned)
 *             projectA1, projectA2
 *  tenant B : outsider (owner + ADMIN of a different account/workspace) with projectB1
 */
export interface Fixture {
  prisma: PrismaService;
  run: string;
  users: Record<'owner' | 'admin2' | 'memberA' | 'memberB' | 'outsider', string>;
  accountA: string;
  workspaceA: string;
  workspaceB: string;
  projectA1: string;
  projectA2: string;
  projectB1: string;
  cleanup: () => Promise<void>;
}

export async function buildFixture(prisma: PrismaService, tier: SubscriptionPlanTier = SubscriptionPlanTier.PRO): Promise<Fixture> {
  const run = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
  const passwordHash = await bcrypt.hash('Password123!', 4);
  const mkUser = (label: string) =>
    prisma.user.create({ data: { email: `${label}.${run}@veyro-test.io`, name: `${label} ${run}`, passwordHash, isEmailVerified: true } });

  const [owner, admin2, memberA, memberB, outsider] = await Promise.all(
    ['owner', 'admin2', 'membera', 'memberb', 'outsider'].map(mkUser),
  );

  const accountA = await prisma.account.create({ data: { name: `Acct A ${run}`, slug: `acct-a-${run}`, ownerId: owner.id } });
  const accountB = await prisma.account.create({ data: { name: `Acct B ${run}`, slug: `acct-b-${run}`, ownerId: outsider.id } });
  await prisma.accountSubscription.create({ data: { accountId: accountA.id, tier } });

  const wsA = await prisma.workspace.create({
    data: {
      accountId: accountA.id, name: `WS A ${run}`, slug: `ws-a-${run}`,
      members: {
        create: [
          { userId: owner.id, role: WorkspaceRole.ADMIN },
          { userId: admin2.id, role: WorkspaceRole.ADMIN },
          { userId: memberA.id, role: WorkspaceRole.MEMBER },
          { userId: memberB.id, role: WorkspaceRole.MEMBER },
        ],
      },
    },
  });
  const wsB = await prisma.workspace.create({
    data: { accountId: accountB.id, name: `WS B ${run}`, slug: `ws-b-${run}`, members: { create: { userId: outsider.id, role: WorkspaceRole.ADMIN } } },
  });

  const p = (workspaceId: string, name: string, key: string, createdById: string) =>
    prisma.project.create({ data: { workspaceId, name: `${name} ${run}`, key, createdById } });
  const projectA1 = await p(wsA.id, 'Alpha', 'ALP', owner.id);
  const projectA2 = await p(wsA.id, 'Beta', 'BET', owner.id);
  const projectB1 = await p(wsB.id, 'Other', 'OTH', outsider.id);
  await prisma.projectMember.createMany({
    data: [
      { projectId: projectA1.id, userId: owner.id, role: 'ADMIN' as const },
      { projectId: projectA1.id, userId: memberA.id },
    ],
  });

  const userIds = [owner.id, admin2.id, memberA.id, memberB.id, outsider.id];
  const workspaceIds = [wsA.id, wsB.id];
  const projectIds = [projectA1.id, projectA2.id, projectB1.id];

  return {
    prisma, run,
    users: { owner: owner.id, admin2: admin2.id, memberA: memberA.id, memberB: memberB.id, outsider: outsider.id },
    accountA: accountA.id, workspaceA: wsA.id, workspaceB: wsB.id,
    projectA1: projectA1.id, projectA2: projectA2.id, projectB1: projectB1.id,
    cleanup: async () => {
      // Tests may create extra projects/tasks; resolve everything that lives under the fixture workspaces.
      const all = await prisma.project.findMany({ where: { workspaceId: { in: workspaceIds } }, select: { id: true } });
      projectIds.splice(0, projectIds.length, ...all.map((x) => x.id));
      await prisma.auditLog.deleteMany({ where: { OR: [{ workspaceId: { in: workspaceIds } }, { actorUserId: { in: userIds } }, { accountId: { in: [accountA.id, accountB.id] } }] } });
      // AI data (CS-06 tests): proposals first, then conversations (messages cascade), usage and subscriptions.
      await prisma.aiMutationProposal.deleteMany({ where: { conversation: { userId: { in: userIds } } } });
      await prisma.aiConversation.deleteMany({ where: { userId: { in: userIds } } });
      await prisma.aiUsageReservation.deleteMany({ where: { userId: { in: userIds } } });
      await prisma.aiDailyUsage.deleteMany({ where: { userId: { in: userIds } } });
      await prisma.userAiSubscription.deleteMany({ where: { userId: { in: userIds } } });
      await prisma.taskComment.deleteMany({ where: { task: { projectId: { in: projectIds } } } });
      await prisma.task.deleteMany({ where: { projectId: { in: projectIds } } });
      await prisma.workspaceInvitationProject.deleteMany({ where: { invitation: { workspaceId: { in: workspaceIds } } } });
      await prisma.workspaceInvitation.deleteMany({ where: { workspaceId: { in: workspaceIds } } });
      await prisma.projectMember.deleteMany({ where: { projectId: { in: projectIds } } });
      await prisma.project.deleteMany({ where: { id: { in: projectIds } } });
      await prisma.workspaceMember.deleteMany({ where: { workspaceId: { in: workspaceIds } } });
      await prisma.workspace.deleteMany({ where: { id: { in: workspaceIds } } });
      await prisma.billingEvent.deleteMany({ where: { accountSubscription: { accountId: { in: [accountA.id, accountB.id] } } } });
      await prisma.accountSubscription.deleteMany({ where: { accountId: { in: [accountA.id, accountB.id] } } });
      await prisma.account.deleteMany({ where: { id: { in: [accountA.id, accountB.id] } } });
      await prisma.userSession.deleteMany({ where: { userId: { in: userIds } } });
      await prisma.user.deleteMany({ where: { id: { in: userIds } } });
    },
  };
}
