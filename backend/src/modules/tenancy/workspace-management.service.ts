import {
  Injectable,
  ConflictException,
  ForbiddenException,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { Prisma, InvitationStatus, WorkspaceRole } from '@prisma/client';
import * as crypto from 'crypto';
import { PrismaService } from '../../prisma/prisma.service';
import { UpdateWorkspaceDto } from './dto/update-workspace.dto';
import { ChangeMemberRoleDto } from './dto/change-member-role.dto';

const INVITE_DAYS = 7;
const INVITATION_LIST_LIMIT = 100;

/**
 * Workspace administration (CS-02): settings, member roles, member removal, pending invitations.
 * Every method re-resolves the caller's authority from the database (Admin of the workspace or the
 * Account Owner). Members are addressed by WorkspaceMember.id and always looked up *inside* the
 * workspace from the URL, so an id from another tenant answers 404 (anti-IDOR).
 */
@Injectable()
export class WorkspaceManagementService {
  constructor(private readonly prisma: PrismaService) {}

  /* ------------------------------------------------------------------ helpers */

  private async requireManager(workspaceId: string, actorId: string) {
    const workspace = await this.prisma.workspace.findUnique({
      where: { id: workspaceId },
      include: { account: { select: { id: true, ownerId: true } } },
    });
    if (!workspace) {
      throw new NotFoundException({ code: 'RESOURCE_NOT_FOUND', message: 'Workspace not found.' });
    }
    const membership = await this.prisma.workspaceMember.findUnique({
      where: { workspaceId_userId: { workspaceId, userId: actorId } },
    });
    const isOwner = workspace.account.ownerId === actorId;
    if (!isOwner && membership?.role !== WorkspaceRole.ADMIN) {
      throw new ForbiddenException({
        code: 'PERMISSION_DENIED',
        message: 'Only workspace admins or the account owner can manage this workspace.',
      });
    }
    return workspace;
  }

  private async findMemberOr404(workspaceId: string, memberId: string) {
    const member = await this.prisma.workspaceMember.findFirst({
      where: { id: memberId, workspaceId },
      include: { user: { select: { id: true, name: true, email: true, avatarUrl: true } } },
    });
    if (!member) {
      throw new NotFoundException({ code: 'RESOURCE_NOT_FOUND', message: 'Member not found in this workspace.' });
    }
    return member;
  }

  private async findInvitationOr404(workspaceId: string, invitationId: string) {
    const invitation = await this.prisma.workspaceInvitation.findFirst({
      where: { id: invitationId, workspaceId },
      include: { projects: { select: { projectId: true } } },
    });
    if (!invitation) {
      throw new NotFoundException({ code: 'RESOURCE_NOT_FOUND', message: 'Invitation not found in this workspace.' });
    }
    return invitation;
  }

  private memberView(m: { id: string; role: WorkspaceRole; joinedAt: Date; user: { id: string; name: string; email: string; avatarUrl: string | null } }, ownerId: string) {
    return {
      id: m.id,
      userId: m.user.id,
      name: m.user.name,
      email: m.user.email,
      avatarUrl: m.user.avatarUrl,
      role: m.role,
      isAccountOwner: m.user.id === ownerId,
      joinedAt: m.joinedAt,
    };
  }

  /* ----------------------------------------------------------------- settings */

  async updateWorkspace(actorId: string, workspaceId: string, dto: UpdateWorkspaceDto) {
    const workspace = await this.requireManager(workspaceId, actorId);

    if (dto.name === undefined && dto.slug === undefined) {
      throw new UnprocessableEntityException({
        code: 'EMPTY_UPDATE',
        message: 'Provide at least one of name or slug.',
      });
    }

    const changes: Record<string, { from: string; to: string }> = {};
    const data: Prisma.WorkspaceUpdateInput = {};
    if (dto.name !== undefined && dto.name !== workspace.name) {
      data.name = dto.name;
      changes.name = { from: workspace.name, to: dto.name };
    }
    if (dto.slug !== undefined && dto.slug !== workspace.slug) {
      const taken = await this.prisma.workspace.findUnique({ where: { slug: dto.slug }, select: { id: true } });
      if (taken) this.slugTaken();
      data.slug = dto.slug;
      changes.slug = { from: workspace.slug, to: dto.slug };
    }

    if (Object.keys(changes).length > 0) {
      try {
        await this.prisma.$transaction([
          this.prisma.workspace.update({ where: { id: workspaceId }, data }),
          this.prisma.auditLog.create({
            data: { actorUserId: actorId, accountId: workspace.accountId, workspaceId, action: 'WORKSPACE_UPDATED', metadata: { changes } },
          }),
        ]);
      } catch (e) {
        // Two admins racing for the same slug: the unique index decides.
        if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') this.slugTaken();
        throw e;
      }
    }

    return this.prisma.workspace.findUnique({
      where: { id: workspaceId },
      include: {
        account: { select: { id: true, name: true, slug: true, ownerId: true } },
        _count: { select: { members: true, projects: true } },
      },
    });
  }

  private slugTaken(): never {
    throw new ConflictException({ code: 'WORKSPACE_SLUG_TAKEN', message: 'This workspace slug is already in use.' });
  }

  /* ------------------------------------------------------------------ members */

  async changeMemberRole(actorId: string, workspaceId: string, memberId: string, dto: ChangeMemberRoleDto) {
    const workspace = await this.requireManager(workspaceId, actorId);
    const target = await this.findMemberOr404(workspaceId, memberId);
    const ownerId = workspace.account.ownerId;

    if (target.user.id === ownerId) {
      throw new ForbiddenException({ code: 'OWNER_ROLE_IMMUTABLE', message: 'The account owner is always a workspace admin and cannot be changed.' });
    }
    if (target.user.id === actorId) {
      throw new UnprocessableEntityException({ code: 'CANNOT_CHANGE_OWN_ROLE', message: 'You cannot change your own role. Ask another admin or the account owner.' });
    }
    if (target.role === dto.role) return this.memberView(target, ownerId);

    const updated = await this.prisma.$transaction(async (tx) => {
      const m = await tx.workspaceMember.update({
        where: { id: target.id },
        data: { role: dto.role },
        include: { user: { select: { id: true, name: true, email: true, avatarUrl: true } } },
      });
      await tx.auditLog.create({
        data: {
          actorUserId: actorId, accountId: workspace.accountId, workspaceId, action: 'MEMBER_ROLE_CHANGED',
          metadata: { memberUserId: target.user.id, from: target.role, to: dto.role },
        },
      });
      return m;
    });
    return this.memberView(updated, ownerId);
  }

  async removeMember(actorId: string, workspaceId: string, memberId: string) {
    const workspace = await this.requireManager(workspaceId, actorId);
    const target = await this.findMemberOr404(workspaceId, memberId);

    if (target.user.id === workspace.account.ownerId) {
      throw new ForbiddenException({ code: 'OWNER_NOT_REMOVABLE', message: 'The account owner cannot be removed from a workspace.' });
    }
    if (target.user.id === actorId) {
      throw new UnprocessableEntityException({ code: 'CANNOT_REMOVE_SELF', message: 'You cannot remove yourself. Ask another admin or the account owner.' });
    }

    return this.prisma.$transaction(async (tx) => {
      const projects = await tx.project.findMany({ where: { workspaceId }, select: { id: true } });
      const projectIds = projects.map((p) => p.id);

      // Business rule (docs/02 edge cases): tasks stay, the assignee is cleared and the event is logged.
      const assigned = await tx.task.findMany({
        where: { projectId: { in: projectIds }, assigneeId: target.user.id },
        select: { id: true, projectId: true },
      });
      if (assigned.length > 0) {
        await tx.task.updateMany({ where: { id: { in: assigned.map((t) => t.id) } }, data: { assigneeId: null } });
        await tx.auditLog.createMany({
          data: assigned.map((t) => ({
            actorUserId: actorId, accountId: workspace.accountId, workspaceId, projectId: t.projectId, taskId: t.id,
            action: 'TASK_UNASSIGNED', metadata: { reason: 'MEMBER_REMOVED', memberUserId: target.user.id },
          })),
        });
      }
      const removedProjects = await tx.projectMember.deleteMany({ where: { projectId: { in: projectIds }, userId: target.user.id } });
      await tx.workspaceMember.delete({ where: { id: target.id } });
      await tx.auditLog.create({
        data: {
          actorUserId: actorId, accountId: workspace.accountId, workspaceId, action: 'MEMBER_REMOVED',
          metadata: { memberUserId: target.user.id, role: target.role, unassignedTasks: assigned.length, removedProjectAssignments: removedProjects.count },
        },
      });
      return { removedMemberId: target.id, unassignedTasks: assigned.length, removedProjectAssignments: removedProjects.count };
    });
  }

  /* -------------------------------------------------------------- invitations */

  async listInvitations(actorId: string, workspaceId: string) {
    await this.requireManager(workspaceId, actorId);
    const rows = await this.prisma.workspaceInvitation.findMany({
      where: { workspaceId, status: InvitationStatus.PENDING },
      orderBy: { createdAt: 'desc' },
      take: INVITATION_LIST_LIMIT,
      include: {
        inviter: { select: { id: true, name: true } },
        projects: { select: { project: { select: { id: true, key: true, name: true, deletedAt: true } } } },
      },
    });
    const now = Date.now();
    return rows.map((i) => ({
      id: i.id,
      email: i.email,
      role: i.role,
      status: i.status,
      isExpired: i.expiresAt.getTime() < now,
      expiresAt: i.expiresAt,
      createdAt: i.createdAt,
      inviter: i.inviter,
      projects: i.projects.map((p) => p.project).filter((p) => !p.deletedAt).map(({ id, key, name }) => ({ id, key, name })),
    }));
  }

  async revokeInvitation(actorId: string, workspaceId: string, invitationId: string) {
    const workspace = await this.requireManager(workspaceId, actorId);
    const invitation = await this.findInvitationOr404(workspaceId, invitationId);

    // Conditional update: a concurrent accept or revoke wins exactly once.
    const res = await this.prisma.workspaceInvitation.updateMany({
      where: { id: invitation.id, status: InvitationStatus.PENDING },
      data: { status: InvitationStatus.REVOKED },
    });
    if (res.count === 0) {
      throw new ConflictException({ code: 'INVITATION_NOT_PENDING', message: 'Only pending invitations can be revoked.' });
    }
    await this.prisma.auditLog.create({
      data: { actorUserId: actorId, accountId: workspace.accountId, workspaceId, action: 'WORKSPACE_INVITATION_REVOKED', metadata: { recipientEmail: invitation.email } },
    });
    return { id: invitation.id, status: InvitationStatus.REVOKED };
  }

  async resendInvitation(actorId: string, workspaceId: string, invitationId: string) {
    const workspace = await this.requireManager(workspaceId, actorId);
    const invitation = await this.findInvitationOr404(workspaceId, invitationId);

    const user = await this.prisma.user.findUnique({ where: { email: invitation.email }, select: { id: true } });
    if (user) {
      const already = await this.prisma.workspaceMember.findUnique({ where: { workspaceId_userId: { workspaceId, userId: user.id } } });
      if (already) {
        throw new ConflictException({ code: 'USER_ALREADY_MEMBER', message: 'This user is already a member of this workspace.' });
      }
    }

    // The raw token is never stored, so "resend" issues a fresh secret and invalidates the old link.
    const rawToken = crypto.randomBytes(48).toString('hex');
    const hashedToken = crypto.createHash('sha256').update(rawToken).digest('hex');
    const expiresAt = new Date(Date.now() + INVITE_DAYS * 24 * 60 * 60 * 1000);

    const res = await this.prisma.workspaceInvitation.updateMany({
      where: { id: invitation.id, status: { in: [InvitationStatus.PENDING, InvitationStatus.EXPIRED] } },
      data: { hashedToken, expiresAt, status: InvitationStatus.PENDING },
    });
    if (res.count === 0) {
      throw new ConflictException({ code: 'INVITATION_NOT_RESENDABLE', message: 'Only pending or expired invitations can be resent.' });
    }
    await this.prisma.auditLog.create({
      data: { actorUserId: actorId, accountId: workspace.accountId, workspaceId, action: 'WORKSPACE_INVITATION_RESENT', metadata: { recipientEmail: invitation.email } },
    });

    const appUrl = process.env.APP_URL || 'http://localhost:3000';
    return {
      invitationId: invitation.id,
      email: invitation.email,
      role: invitation.role,
      projectIds: invitation.projects.map((p) => p.projectId),
      expiresAt,
      inviteLink: `${appUrl}/invitations/accept?token=${rawToken}`,
      rawToken,
    };
  }
}
