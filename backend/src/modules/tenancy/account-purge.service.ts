import { Injectable, Logger, ConflictException, NotFoundException } from '@nestjs/common';
import { AccountOffboardingState, Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

const BATCH = 500;

/**
 * Child-first purge of an offboarded account (docs/05 D-5 / D-13, docs/06 offboarding flow, CS-07 / ADR-014).
 * Every foreign key is RESTRICT, so rows go from the leaves up. Each step is a bounded, idempotent deleteMany:
 * if the process dies half way, running it again resumes where it stopped. Audit logs are append-only and are never
 * deleted (BR-AUD-01); they keep the account id as a plain snapshot. Users are not deleted: a person may belong to
 * other accounts.
 *
 * Not exposed over HTTP and not scheduled yet: running it on a timer needs a job runner dependency, which goes through
 * the AGENTS.md section 6 gate in Phase 5. Until then it is invoked explicitly (tests, an operator script).
 */
@Injectable()
export class AccountPurgeService {
  private readonly logger = new Logger(AccountPurgeService.name);

  constructor(private readonly prisma: PrismaService) {}

  async purgeAccount(accountId: string) {
    const account = await this.prisma.account.findUnique({ where: { id: accountId } });
    if (!account) throw new NotFoundException({ code: 'RESOURCE_NOT_FOUND', message: 'Account not found.' });
    if (account.offboardingState !== AccountOffboardingState.PENDING) {
      throw new ConflictException({ code: 'ACCOUNT_NOT_OFFBOARDING', message: 'Only an account in offboarding can be purged.' });
    }

    const workspaceIds = (await this.prisma.workspace.findMany({ where: { accountId }, select: { id: true } })).map((w) => w.id);
    const projectIds = (await this.prisma.project.findMany({ where: { workspaceId: { in: workspaceIds } }, select: { id: true } })).map((p) => p.id);
    const counts = { comments: 0, tasks: 0, projects: 0, workspaces: workspaceIds.length };

    // 1. Task comments and tasks in bounded batches (the only unbounded tables).
    for (;;) {
      const tasks = await this.prisma.task.findMany({ where: { projectId: { in: projectIds } }, select: { id: true }, take: BATCH });
      if (tasks.length === 0) break;
      const ids = tasks.map((t) => t.id);
      await this.prisma.$transaction(async (tx) => {
        counts.comments += (await tx.taskComment.deleteMany({ where: { taskId: { in: ids } } })).count;
        counts.tasks += (await tx.task.deleteMany({ where: { id: { in: ids } } })).count;
      });
    }

    // 2. Everything else is small (plan caps bound projects, workspaces and members) and goes in one transaction.
    await this.prisma.$transaction(
      async (tx) => {
        await tx.workspaceInvitationProject.deleteMany({ where: { projectId: { in: projectIds } } });
        await tx.workspaceInvitation.deleteMany({ where: { workspaceId: { in: workspaceIds } } });
        await tx.projectMember.deleteMany({ where: { projectId: { in: projectIds } } });
        counts.projects = (await tx.project.deleteMany({ where: { id: { in: projectIds } } })).count;
        // AI conversations scoped to this account or its workspaces (messages and proposals cascade).
        await tx.aiMutationProposal.deleteMany({ where: { conversation: { OR: [{ accountId }, { workspaceId: { in: workspaceIds } }] } } });
        await tx.aiConversation.deleteMany({ where: { OR: [{ accountId }, { workspaceId: { in: workspaceIds } }] } });
        await tx.workspaceMember.deleteMany({ where: { workspaceId: { in: workspaceIds } } });
        await tx.workspace.deleteMany({ where: { id: { in: workspaceIds } } });
        await tx.billingEvent.deleteMany({ where: { accountSubscription: { accountId } } });
        await tx.accountSubscription.deleteMany({ where: { accountId } });
        await tx.account.delete({ where: { id: accountId } });
        await tx.auditLog.create({
          data: {
            accountId,
            action: 'ACCOUNT_PURGED',
            metadata: { workspaces: counts.workspaces, projects: counts.projects, tasks: counts.tasks, comments: counts.comments } as Prisma.InputJsonValue,
          },
        });
      },
      { timeout: 30_000 },
    );

    this.logger.log(`Account ${accountId} purged: ${JSON.stringify(counts)}`);
    return counts;
  }
}
