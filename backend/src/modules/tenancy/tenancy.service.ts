import {
  Injectable,
  ConflictException,
  ForbiddenException,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import * as crypto from 'crypto';
import { PrismaService } from '../../prisma/prisma.service';
import { AtomicOnboardingDto } from './dto/atomic-onboarding.dto';
import { CreateWorkspaceDto } from './dto/create-workspace.dto';
import { InviteMemberDto } from './dto/invite-member.dto';
import { AcceptInvitationDto } from './dto/accept-invitation.dto';
import {
  WorkspaceRole,
  InvitationStatus,
  SubscriptionPlanTier,
  SubscriptionPaymentStatus,
  AccountOffboardingState,
} from '@prisma/client';

@Injectable()
export class TenancyService {
  private readonly logger = new Logger(TenancyService.name);
  private readonly inviteDurationDays = 7;

  constructor(private readonly prisma: PrismaService) {}

  hashToken(token: string): string {
    return crypto.createHash('sha256').update(token).digest('hex');
  }

  generateRawToken(): string {
    return crypto.randomBytes(48).toString('hex');
  }

  async atomicOnboarding(userId: string, dto: AtomicOnboardingDto) {
    // 1. Verify slug uniqueness
    const existingAccountSlug = await this.prisma.account.findUnique({
      where: { slug: dto.accountSlug },
    });
    if (existingAccountSlug) {
      throw new ConflictException({
        code: 'ACCOUNT_SLUG_TAKEN',
        message: 'This account slug is already in use.',
      });
    }

    const existingWorkspaceSlug = await this.prisma.workspace.findUnique({
      where: { slug: dto.workspaceSlug },
    });
    if (existingWorkspaceSlug) {
      throw new ConflictException({
        code: 'WORKSPACE_SLUG_TAKEN',
        message: 'This workspace slug is already in use.',
      });
    }

    // 2. Atomic initialization inside a database transaction
    return this.prisma.$transaction(async (tx) => {
      const account = await tx.account.create({
        data: {
          name: dto.accountName,
          slug: dto.accountSlug,
          ownerId: userId,
          offboardingState: AccountOffboardingState.NONE,
          subscription: {
            create: {
              tier: SubscriptionPlanTier.FREE,
              status: SubscriptionPaymentStatus.ACTIVE,
            },
          },
        },
      });

      const workspace = await tx.workspace.create({
        data: {
          accountId: account.id,
          name: dto.workspaceName,
          slug: dto.workspaceSlug,
          members: {
            create: {
              userId,
              role: WorkspaceRole.ADMIN,
            },
          },
        },
      });

      await tx.auditLog.create({
        data: {
          actorUserId: userId,
          accountId: account.id,
          workspaceId: workspace.id,
          action: 'ACCOUNT_ONBOARDED',
          metadata: {
            accountSlug: account.slug,
            workspaceSlug: workspace.slug,
          },
        },
      });

      return {
        account: {
          id: account.id,
          name: account.name,
          slug: account.slug,
          ownerId: account.ownerId,
        },
        workspace: {
          id: workspace.id,
          name: workspace.name,
          slug: workspace.slug,
        },
      };
    });
  }

  async createWorkspace(userId: string, accountId: string, dto: CreateWorkspaceDto) {
    const account = await this.prisma.account.findUnique({
      where: { id: accountId },
      include: { subscription: true, workspaces: true },
    });

    if (!account) {
      throw new NotFoundException({
        code: 'RESOURCE_NOT_FOUND',
        message: 'Account not found.',
      });
    }

    // Option A rule: Restricted strictly to Account Owner
    if (account.ownerId !== userId) {
      throw new ForbiddenException({
        code: 'PERMISSION_DENIED',
        message: 'Only the Account Owner can create additional workspaces.',
      });
    }

    if (account.offboardingState === AccountOffboardingState.PENDING) {
      throw new ForbiddenException({
        code: 'ACCOUNT_OFFBOARDING_LOCKED',
        message: 'Cannot create workspaces while account is undergoing offboarding.',
      });
    }

    const existingSlug = await this.prisma.workspace.findUnique({
      where: { slug: dto.slug },
    });
    if (existingSlug) {
      throw new ConflictException({
        code: 'WORKSPACE_SLUG_TAKEN',
        message: 'This workspace slug is already in use.',
      });
    }

    return this.prisma.$transaction(async (tx) => {
      const workspace = await tx.workspace.create({
        data: {
          accountId,
          name: dto.name,
          slug: dto.slug,
          members: {
            create: {
              userId,
              role: WorkspaceRole.ADMIN,
            },
          },
        },
      });

      await tx.auditLog.create({
        data: {
          actorUserId: userId,
          accountId,
          workspaceId: workspace.id,
          action: 'WORKSPACE_CREATED',
          metadata: { name: workspace.name, slug: workspace.slug },
        },
      });

      return workspace;
    });
  }

  async listUserWorkspaces(userId: string) {
    const memberships = await this.prisma.workspaceMember.findMany({
      where: { userId },
      include: {
        workspace: {
          include: {
            account: {
              select: { id: true, name: true, slug: true, ownerId: true },
            },
          },
        },
      },
    });

    return memberships.map((m) => ({
      id: m.workspace.id,
      name: m.workspace.name,
      slug: m.workspace.slug,
      lifecycleStatus: m.workspace.lifecycleStatus,
      role: m.role,
      isAccountOwner: m.workspace.account.ownerId === userId,
      account: m.workspace.account,
      joinedAt: m.joinedAt,
    }));
  }

  async getWorkspaceDetails(workspaceId: string) {
    const workspace = await this.prisma.workspace.findUnique({
      where: { id: workspaceId },
      include: {
        account: {
          select: { id: true, name: true, slug: true, ownerId: true },
        },
        _count: {
          select: { members: true, projects: true },
        },
      },
    });

    if (!workspace) {
      throw new NotFoundException({
        code: 'RESOURCE_NOT_FOUND',
        message: 'Workspace not found.',
      });
    }

    return workspace;
  }

  async inviteMember(inviterId: string, workspaceId: string, dto: InviteMemberDto) {
    const workspace = await this.prisma.workspace.findUnique({
      where: { id: workspaceId },
      include: { account: true },
    });

    if (!workspace) {
      throw new NotFoundException({
        code: 'RESOURCE_NOT_FOUND',
        message: 'Workspace not found.',
      });
    }

    // Check if user is already a member
    const existingUser = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });

    if (existingUser) {
      const existingMember = await this.prisma.workspaceMember.findUnique({
        where: {
          workspaceId_userId: {
            workspaceId,
            userId: existingUser.id,
          },
        },
      });

      if (existingMember) {
        throw new ConflictException({
          code: 'USER_ALREADY_MEMBER',
          message: 'This user is already a member of this workspace.',
        });
      }
    }

    const rawToken = this.generateRawToken();
    const hashedToken = this.hashToken(rawToken);
    const expiresAt = new Date(Date.now() + this.inviteDurationDays * 24 * 60 * 60 * 1000);

    const invitation = await this.prisma.workspaceInvitation.create({
      data: {
        workspaceId,
        inviterId,
        email: dto.email,
        role: dto.role,
        hashedToken,
        expiresAt,
        status: InvitationStatus.PENDING,
      },
    });

    const appUrl = process.env.APP_URL || 'http://localhost:3000';
    const inviteLink = `${appUrl}/invitations/accept?token=${rawToken}`;

    await this.prisma.auditLog.create({
      data: {
        actorUserId: inviterId,
        accountId: workspace.accountId,
        workspaceId,
        action: 'WORKSPACE_INVITATION_ISSUED',
        metadata: { recipientEmail: dto.email, role: dto.role },
      },
    });

    return {
      invitationId: invitation.id,
      email: invitation.email,
      role: invitation.role,
      expiresAt: invitation.expiresAt,
      inviteLink,
      rawToken,
    };
  }

  async acceptInvitation(userId: string, userEmail: string, dto: AcceptInvitationDto) {
    const hashedToken = this.hashToken(dto.token);

    const invitation = await this.prisma.workspaceInvitation.findUnique({
      where: { hashedToken },
      include: { workspace: true },
    });

    if (!invitation) {
      throw new NotFoundException({
        code: 'RESOURCE_NOT_FOUND',
        message: 'Invalid invitation token.',
      });
    }

    if (invitation.status !== InvitationStatus.PENDING) {
      throw new BadRequestException({
        code: 'INVITATION_ALREADY_RESOLVED',
        message: `This invitation has already been ${invitation.status.toLowerCase()}.`,
      });
    }

    if (invitation.expiresAt < new Date()) {
      await this.prisma.workspaceInvitation.update({
        where: { id: invitation.id },
        data: { status: InvitationStatus.EXPIRED },
      });

      throw new BadRequestException({
        code: 'INVITATION_EXPIRED',
        message: 'This invitation link has expired (7-day validity window).',
      });
    }

    // Strict Email Lock (DEC-09 / BR-WS-02.6)
    if (invitation.email.toLowerCase() !== userEmail.toLowerCase()) {
      throw new ForbiddenException({
        code: 'INVITATION_EMAIL_MISMATCH',
        message: `This invitation is restricted strictly to ${invitation.email}. You are currently authenticated as ${userEmail}.`,
      });
    }

    return this.prisma.$transaction(async (tx) => {
      await tx.workspaceInvitation.update({
        where: { id: invitation.id },
        data: { status: InvitationStatus.ACCEPTED },
      });

      const member = await tx.workspaceMember.upsert({
        where: {
          workspaceId_userId: {
            workspaceId: invitation.workspaceId,
            userId,
          },
        },
        create: {
          workspaceId: invitation.workspaceId,
          userId,
          role: invitation.role,
        },
        update: {
          role: invitation.role,
        },
      });

      await tx.auditLog.create({
        data: {
          actorUserId: userId,
          accountId: invitation.workspace.accountId,
          workspaceId: invitation.workspaceId,
          action: 'WORKSPACE_INVITATION_ACCEPTED',
          metadata: { email: userEmail, role: invitation.role },
        },
      });

      return {
        workspaceId: invitation.workspaceId,
        role: member.role,
        joinedAt: member.joinedAt,
      };
    });
  }

  async listWorkspaceMembers(workspaceId: string) {
    const members = await this.prisma.workspaceMember.findMany({
      where: { workspaceId },
      include: {
        user: {
          select: { id: true, name: true, email: true, avatarUrl: true },
        },
      },
      orderBy: { joinedAt: 'asc' },
    });

    return members.map((m) => ({
      id: m.id,
      userId: m.user.id,
      name: m.user.name,
      email: m.user.email,
      avatarUrl: m.user.avatarUrl,
      role: m.role,
      joinedAt: m.joinedAt,
    }));
  }

  async initiateAccountOffboarding(userId: string, accountId: string) {
    const account = await this.prisma.account.findUnique({
      where: { id: accountId },
    });

    if (!account) {
      throw new NotFoundException({
        code: 'RESOURCE_NOT_FOUND',
        message: 'Account not found.',
      });
    }

    if (account.ownerId !== userId) {
      throw new ForbiddenException({
        code: 'PERMISSION_DENIED',
        message: 'Only the Account Owner can offboard the account.',
      });
    }

    // Set offboarding state to PENDING to lock all concurrent writes (D-13)
    const updated = await this.prisma.account.update({
      where: { id: accountId },
      data: { offboardingState: AccountOffboardingState.PENDING },
    });

    await this.prisma.auditLog.create({
      data: {
        actorUserId: userId,
        accountId,
        action: 'ACCOUNT_OFFBOARDING_INITIATED',
        metadata: { offboardingState: 'PENDING' },
      },
    });

    return {
      accountId: updated.id,
      offboardingState: updated.offboardingState,
      message: 'Account offboarding initiated. All concurrent modifications are now locked.',
    };
  }
}
