import { ConflictException, Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';
import { AiPlanTier } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { CloudinaryService } from '../storage/cloudinary.service';
import { DELETED_USER_NAME } from '../../common/validators/reserved-name';


/**
 * A person deletes their own account (step G2, BR-USR-DEL). The user row is anonymized, not removed: tasks, comments, invitations and
 * the append-only audit trail (BR-AUD-01) all point at it with RESTRICT keys, and the team's history must stay readable. Everything
 * personal or sign-in related goes in one transaction, so the account is either fully deleted or untouched.
 */
@Injectable()
export class UserDeletionService {
  private readonly log = new Logger(UserDeletionService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: CloudinaryService,
  ) {}

  async deleteAccount(userId: string, password: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, email: true, passwordHash: true, avatarUrl: true, avatarRemovedAt: true, deletedAt: true, aiSubscription: { select: { tier: true, providerCustomerId: true } } },
    });
    if (!user || user.deletedAt) throw new UnauthorizedException({ code: 'INVALID_CREDENTIALS', message: 'Authentication required.' });
    if (!(await bcrypt.compare(password, user.passwordHash))) {
      throw new UnauthorizedException({ code: 'INVALID_CURRENT_PASSWORD', message: 'The password is incorrect.' });
    }

    // Rule 4 of docs/03: the sole owner of an account cannot delete themselves. They delete the account (offboarding) first.
    const owned = await this.prisma.account.count({ where: { ownerId: userId } });
    if (owned > 0) {
      throw new ConflictException({ code: 'USER_OWNS_ACCOUNT', message: 'You own an account. Delete the account first, then delete your user.' });
    }
    // A paid personal plan would keep billing a person who no longer exists.
    if (user.aiSubscription && (user.aiSubscription.tier !== AiPlanTier.FREE || user.aiSubscription.providerCustomerId)) {
      throw new ConflictException({ code: 'USER_HAS_PAID_PLAN', message: 'Cancel your paid plan first.' });
    }

    const unusablePasswordHash = await bcrypt.hash(crypto.randomBytes(32).toString('hex'), 4); // nobody knows it, so nobody can sign in
    await this.prisma.$transaction(async (tx) => {
      const mine = { userId };
      // Personal data and sign-in
      await tx.userSession.deleteMany({ where: mine });
      await tx.userOtpVerification.deleteMany({ where: mine });
      await tx.userPasswordResetToken.deleteMany({ where: mine });
      await tx.notification.deleteMany({ where: { recipientId: userId } });
      // The names copied into other people's notifications when this person acted.
      await tx.$executeRaw`UPDATE notifications SET data = jsonb_set(data, '{actorName}', to_jsonb(${DELETED_USER_NAME}::text)) WHERE "actorId" = ${userId} AND data ? 'actorName'`;
      await tx.aiMutationProposal.deleteMany({ where: { conversation: { userId } } });
      await tx.aiConversation.deleteMany({ where: mine });
      await tx.aiUsageReservation.deleteMany({ where: mine });
      await tx.aiDailyUsage.deleteMany({ where: mine });
      await tx.userAiSubscription.deleteMany({ where: mine });
      // Invitations addressed to their email are personal data too. Ones they sent stay (the workspace still owns them).
      await tx.workspaceInvitationProject.deleteMany({ where: { invitation: { email: user.email } } });
      await tx.workspaceInvitation.deleteMany({ where: { email: user.email } });
      // Leave every workspace and project; the work they were given goes back to unassigned.
      await tx.task.updateMany({ where: { assigneeId: userId }, data: { assigneeId: null } });
      await tx.projectMember.deleteMany({ where: mine });
      await tx.workspaceMember.deleteMany({ where: mine });
      await tx.user.update({
        where: { id: userId },
        data: {
          name: DELETED_USER_NAME,
          email: `deleted-${userId}@deleted.invalid`,
          passwordHash: unusablePasswordHash,
          avatarUrl: null,
          avatarType: 'INITIALS',
          avatarPresetKey: null,
          avatarRemovedAt: null,
          isEmailVerified: false,
          emailVerifiedAt: null,
          deletedAt: new Date(),
        },
      });
      await tx.auditLog.create({ data: { actorUserId: userId, action: 'USER_DELETED' } });
    });

    // After the commit: a failed photo delete must not undo the deletion, so it is logged and the 30-day purge can still catch it.
    if (this.storage.isConfigured() && (this.storage.ownsAvatar(user.avatarUrl, userId) || user.avatarRemovedAt)) {
      await this.storage.destroyAvatar(userId).catch((e) => this.log.warn(`Could not delete the avatar of a deleted user: ${e?.message}`));
      await this.storage.destroyHiddenAvatar(userId).catch((e) => this.log.warn(`Could not delete the hidden avatar of a deleted user: ${e?.message}`));
    }
    return { success: true };
  }
}
