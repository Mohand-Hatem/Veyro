import { Injectable, Logger } from '@nestjs/common';
import { AccountOffboardingState, InvitationStatus } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { AvatarService } from '../users/avatar.service';
import { NotificationsService } from '../notifications/notifications.service';
import { AccountPurgeService } from '../tenancy/account-purge.service';
import { CloudinaryService, type AttachmentResource } from '../storage/cloudinary.service';
import { TASK_RESTORE_WINDOW_DAYS } from '../tasks/tasks.service';

const ACCOUNT_BATCH = 5; // an account purge is the heavy one; more than this waits for the next run
const PURGE_BATCH = 500;
const PURGE_MAX_BATCHES = 20; // at most 10,000 rows per table and run; the rest waits for the next day
/** Expired or revoked invitations, sessions, sign-up codes and reset links are kept this long after expiry, then deleted (docs/03 §5). */
export const EXPIRED_RETENTION_DAYS = 30;
const daysBefore = (now: Date, days: number) => new Date(now.getTime() - days * 86_400_000);

/**
 * The daily cleanup (step 6.4). Every job is safe to run twice, because Vercel Cron delivery is best effort and can repeat or miss a
 * run: each one selects what is due now, so a missed day is simply caught up the next day. One failing job never stops the others.
 */
@Injectable()
export class JobsService {
  private readonly log = new Logger(JobsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly avatars: AvatarService,
    private readonly notifications: NotificationsService,
    private readonly accountPurge: AccountPurgeService,
    private readonly storage: CloudinaryService,
  ) {}

  async runDaily() {
    const jobs: [string, () => Promise<object>][] = [
      ['avatars', () => this.avatars.purgeRemoved()],
      ['notifications', () => this.notifications.purgeOlderThan()],
      ['accounts', () => this.purgeOffboardedAccounts()],
      ['tasks', () => this.purgeDeletedTasks()],
      ['expired', () => this.purgeExpired()],
    ];
    const result: Record<string, object> = {};
    for (const [name, job] of jobs) {
      try {
        result[name] = await job();
      } catch (e) {
        const message = e instanceof Error ? e.message : String(e);
        this.log.error(`Daily job "${name}" failed: ${message}`);
        result[name] = { error: message };
      }
    }
    this.log.log(`Daily jobs finished: ${JSON.stringify(result)}`);
    return result;
  }

  /** Accounts deleted from Billing are purged here (docs/05 D-5, ADR-014); the purge itself is the existing, resumable AccountPurgeService. */
  private async purgeOffboardedAccounts() {
    const due = await this.prisma.account.findMany({ where: { offboardingState: AccountOffboardingState.PENDING }, select: { id: true }, take: ACCOUNT_BATCH });
    let purged = 0;
    let failed = 0;
    for (const { id } of due) {
      try {
        await this.accountPurge.purgeAccount(id);
        purged++;
      } catch (e) {
        failed++;
        this.log.warn(`Account purge failed for one account, will retry tomorrow: ${(e as Error)?.message}`);
      }
    }
    return { purged, failed };
  }

  /**
   * Tasks soft-deleted longer ago than the restore window are deleted for good (docs/03 §5): comments first (their foreign key is
   * RESTRICT), attachment rows cascade, and a TASK_PURGED audit row keeps the history. The files on Cloudinary go after the commit,
   * best effort like the account purge: a failed delete is logged and never puts a task back.
   */
  async purgeDeletedTasks(now = new Date()) {
    const cutoff = daysBefore(now, TASK_RESTORE_WINDOW_DAYS);
    let purged = 0;
    let files = 0;
    for (let i = 0; i < PURGE_MAX_BATCHES; i++) {
      const batch = await this.prisma.$transaction(async (tx) => {
        // Cron delivery can repeat: the run holding the lock does the batch, and it reads the batch only once it holds it, so a
        // second run never audits tasks the first one already purged (docs/03 §5).
        const [{ locked }] = await tx.$queryRaw<{ locked: boolean }[]>`SELECT pg_try_advisory_xact_lock(hashtext('veyro_daily_purge_lock')) AS locked`;
        if (!locked) return null;
        const due = await tx.task.findMany({
          where: { deletedAt: { lt: cutoff } },
          select: { id: true, title: true, projectId: true, project: { select: { workspaceId: true } } },
          take: PURGE_BATCH,
        });
        const ids = due.map((t) => t.id);
        const attachments = await tx.taskAttachment.findMany({ where: { taskId: { in: ids } }, select: { publicId: true, resourceType: true } });
        await tx.taskComment.deleteMany({ where: { taskId: { in: ids } } });
        purged += (await tx.task.deleteMany({ where: { id: { in: ids } } })).count;
        await tx.auditLog.createMany({
          data: due.map((t) => ({ workspaceId: t.project.workspaceId, projectId: t.projectId, taskId: t.id, action: 'TASK_PURGED', metadata: { title: t.title } })),
        });
        return { count: due.length, attachments };
      }, { timeout: 30_000 });
      if (!batch || batch.count === 0) break;
      for (const f of batch.attachments) {
        await this.storage
          .destroyAttachment(f.publicId, f.resourceType as AttachmentResource)
          .then(() => files++)
          .catch((e: Error) => this.log.warn(`Attachment ${f.publicId} not deleted: ${e.message}`));
      }
    }
    return { purged, files };
  }

  /** Invitations that were never accepted, sessions, sign-up codes and reset links, once they expired more than 30 days ago. */
  async purgeExpired(now = new Date()) {
    const cutoff = daysBefore(now, EXPIRED_RETENTION_DAYS);
    const expired = { expiresAt: { lt: cutoff } };
    const tables = {
      invitations: (take: number) => this.prisma.workspaceInvitation.findMany({ where: { ...expired, status: { not: InvitationStatus.ACCEPTED } }, select: { id: true }, take }),
      sessions: (take: number) => this.prisma.userSession.findMany({ where: expired, select: { id: true }, take }),
      signupCodes: (take: number) => this.prisma.userOtpVerification.findMany({ where: expired, select: { id: true }, take }),
      resetLinks: (take: number) => this.prisma.userPasswordResetToken.findMany({ where: expired, select: { id: true }, take }),
    };
    const remove = {
      invitations: (ids: string[]) => this.prisma.workspaceInvitation.deleteMany({ where: { id: { in: ids } } }), // project links cascade
      sessions: (ids: string[]) => this.prisma.userSession.deleteMany({ where: { id: { in: ids } } }),
      signupCodes: (ids: string[]) => this.prisma.userOtpVerification.deleteMany({ where: { id: { in: ids } } }),
      resetLinks: (ids: string[]) => this.prisma.userPasswordResetToken.deleteMany({ where: { id: { in: ids } } }),
    };
    const deleted: Record<keyof typeof tables, number> = { invitations: 0, sessions: 0, signupCodes: 0, resetLinks: 0 };
    for (const name of Object.keys(tables) as (keyof typeof tables)[]) {
      for (let i = 0; i < PURGE_MAX_BATCHES; i++) {
        const due = await tables[name](PURGE_BATCH);
        if (due.length === 0) break;
        deleted[name] += (await remove[name](due.map((r) => r.id))).count;
      }
    }
    return deleted;
  }
}
