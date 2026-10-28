import { Logger } from '@nestjs/common';
import type { WorkspaceRole } from '@prisma/client';
import type { PrismaService } from '../../prisma/prisma.service';
import type { EmailService } from '../email/email.service';
import { invitationEmail } from '../email/email.templates';

const logger = new Logger('InvitationEmail');

/**
 * Emails an invitation (new or resent). Called without await: the invitation is already saved and the admin also gets the link
 * to share, so a failed email never fails the request. The language is the invitee's own if they already have an account,
 * otherwise the inviter's.
 */
export async function sendInvitationEmail(
  prisma: PrismaService,
  email: EmailService,
  a: { inviterId: string; workspaceName: string; to: string; role: WorkspaceRole; url: string; days: number },
): Promise<void> {
  try {
    const [inviter, invitee] = await Promise.all([
      prisma.user.findUnique({ where: { id: a.inviterId }, select: { name: true, locale: true } }),
      prisma.user.findUnique({ where: { email: a.to }, select: { locale: true } }),
    ]);
    const locale = (invitee ?? inviter)?.locale === 'AR' ? 'ar' : 'en';
    await email.send({
      to: a.to,
      ...invitationEmail({ inviterName: inviter?.name ?? 'A teammate', workspaceName: a.workspaceName, role: a.role, url: a.url, days: a.days, locale }),
    });
  } catch (e) {
    logger.error(`Invitation email failed: ${e instanceof Error ? e.message : String(e)}`);
  }
}
