import { Injectable, Logger } from '@nestjs/common';
import { AccountOffboardingState } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { AvatarService } from '../users/avatar.service';
import { NotificationsService } from '../notifications/notifications.service';
import { AccountPurgeService } from '../tenancy/account-purge.service';

const ACCOUNT_BATCH = 5; // an account purge is the heavy one; more than this waits for the next run

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
  ) {}

  async runDaily() {
    const jobs: [string, () => Promise<object>][] = [
      ['avatars', () => this.avatars.purgeRemoved()],
      ['notifications', () => this.notifications.purgeOlderThan()],
      ['accounts', () => this.purgeOffboardedAccounts()],
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
}
