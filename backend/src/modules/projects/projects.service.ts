import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateProjectDto } from './dto/create-project.dto';
import { UpdateProjectDto } from './dto/update-project.dto';
import {
  ProjectLifecycleStatus,
  SubscriptionPlanTier,
} from '@prisma/client';

export const TIER_PROJECT_LIMITS: Record<SubscriptionPlanTier, number> = {
  [SubscriptionPlanTier.FREE]: 3,
  [SubscriptionPlanTier.PRO]: 7,
  [SubscriptionPlanTier.ENTERPRISE]: 15,
  [SubscriptionPlanTier.EPIC]: 25,
};

@Injectable()
export class ProjectsService {
  constructor(private readonly prisma: PrismaService) {}

  async createProject(userId: string, workspaceId: string, dto: CreateProjectDto) {
    const workspace = await this.prisma.workspace.findUnique({
      where: { id: workspaceId },
      include: {
        account: {
          include: {
            subscription: true,
          },
        },
      },
    });

    if (!workspace) {
      throw new NotFoundException({
        code: 'RESOURCE_NOT_FOUND',
        message: 'Workspace not found.',
      });
    }

    // Capacity enforcement (BR-SUB-02):
    // Count active and archived projects across all workspaces owned by the account.
    // Soft-deleted projects do not count toward the limit.
    const tier = workspace.account.subscription?.tier || SubscriptionPlanTier.FREE;
    const maxProjects = TIER_PROJECT_LIMITS[tier];

    const currentProjectCount = await this.prisma.project.count({
      where: {
        workspace: {
          accountId: workspace.accountId,
        },
        deletedAt: null,
      },
    });

    if (currentProjectCount >= maxProjects) {
      throw new ForbiddenException({
        code: 'PROJECT_CAPACITY_EXCEEDED',
        message: `Account project capacity of ${maxProjects} projects reached for the ${tier} subscription tier.`,
      });
    }

    // Atomic creation and creator assignment
    return this.prisma.$transaction(async (tx) => {
      const project = await tx.project.create({
        data: {
          workspaceId,
          name: dto.name,
          description: dto.description,
          lifecycleStatus: ProjectLifecycleStatus.ACTIVE,
        },
      });

      // Automatically assign creator as initial project member
      await tx.projectMember.create({
        data: {
          projectId: project.id,
          userId,
        },
      });

      await tx.auditLog.create({
        data: {
          actorUserId: userId,
          accountId: workspace.accountId,
          workspaceId,
          projectId: project.id,
          action: 'PROJECT_CREATED',
          metadata: {
            name: project.name,
          },
        },
      });

      return project;
    });
  }

  async listWorkspaceProjects(userId: string, workspaceId: string, isPrivileged: boolean) {
    // Privacy and auto-filtering (BR-PRJ-01):
    // Admins and Account Owners view all workspace projects.
    // Standard members only view projects they are explicitly assigned to.
    const whereClause: any = {
      workspaceId,
      deletedAt: null,
    };

    if (!isPrivileged) {
      whereClause.members = {
        some: {
          userId,
        },
      };
    }

    return this.prisma.project.findMany({
      where: whereClause,
      include: {
        _count: {
          select: {
            members: true,
            tasks: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getProjectDetails(projectId: string) {
    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
      include: {
        workspace: {
          select: {
            id: true,
            name: true,
            slug: true,
            accountId: true,
          },
        },
        members: {
          include: {
            user: {
              select: {
                id: true,
                name: true,
                email: true,
                avatarUrl: true,
              },
            },
          },
        },
        _count: {
          select: {
            tasks: true,
          },
        },
      },
    });

    if (!project || project.deletedAt !== null) {
      throw new NotFoundException({
        code: 'RESOURCE_NOT_FOUND',
        message: 'The requested project does not exist.',
      });
    }

    return project;
  }

  async updateProject(userId: string, projectId: string, dto: UpdateProjectDto) {
    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
      include: { workspace: true },
    });

    if (!project || project.deletedAt !== null) {
      throw new NotFoundException({
        code: 'RESOURCE_NOT_FOUND',
        message: 'The requested project does not exist.',
      });
    }

    // Billing hold check (BR-SUB-03, D-3)
    if (project.isBillingReadOnly) {
      throw new ForbiddenException({
        code: 'PROJECT_BILLING_READ_ONLY',
        message: 'This project is in read-only mode due to subscription capacity constraints.',
      });
    }

    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.project.update({
        where: { id: projectId },
        data: {
          name: dto.name,
          description: dto.description,
          lifecycleStatus: dto.lifecycleStatus,
        },
      });

      let action = 'PROJECT_UPDATED';
      if (dto.lifecycleStatus && dto.lifecycleStatus !== project.lifecycleStatus) {
        action =
          dto.lifecycleStatus === ProjectLifecycleStatus.ARCHIVED
            ? 'PROJECT_ARCHIVED'
            : 'PROJECT_UNARCHIVED';
      }

      await tx.auditLog.create({
        data: {
          actorUserId: userId,
          accountId: project.workspace.accountId,
          workspaceId: project.workspaceId,
          projectId: project.id,
          action,
          metadata: JSON.parse(JSON.stringify({ changes: dto })),
        },
      });

      return updated;
    });
  }

  async softDeleteProject(userId: string, projectId: string) {
    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
      include: { workspace: true },
    });

    if (!project || project.deletedAt !== null) {
      throw new NotFoundException({
        code: 'RESOURCE_NOT_FOUND',
        message: 'The requested project does not exist.',
      });
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.project.update({
        where: { id: projectId },
        data: { deletedAt: new Date() },
      });

      await tx.auditLog.create({
        data: {
          actorUserId: userId,
          accountId: project.workspace.accountId,
          workspaceId: project.workspaceId,
          projectId: project.id,
          action: 'PROJECT_DELETED',
        },
      });
    });
  }

  async assignMember(userId: string, projectId: string, targetUserId: string) {
    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
      include: { workspace: true },
    });

    if (!project || project.deletedAt !== null) {
      throw new NotFoundException({
        code: 'RESOURCE_NOT_FOUND',
        message: 'The requested project does not exist.',
      });
    }

    if (project.isBillingReadOnly) {
      throw new ForbiddenException({
        code: 'PROJECT_BILLING_READ_ONLY',
        message: 'This project is in read-only mode due to subscription capacity constraints.',
      });
    }

    if (project.lifecycleStatus === ProjectLifecycleStatus.ARCHIVED) {
      throw new BadRequestException({
        code: 'PROJECT_ARCHIVED',
        message: 'Cannot assign members to an archived project.',
      });
    }

    // Verify target user is a member of the containing workspace (BR-TSK-03.2)
    const workspaceMember = await this.prisma.workspaceMember.findUnique({
      where: {
        workspaceId_userId: {
          workspaceId: project.workspaceId,
          userId: targetUserId,
        },
      },
    });

    if (!workspaceMember) {
      throw new BadRequestException({
        code: 'USER_NOT_WORKSPACE_MEMBER',
        message: 'The specified user is not a member of this workspace.',
      });
    }

    // Check if already assigned
    const existing = await this.prisma.projectMember.findUnique({
      where: {
        projectId_userId: {
          projectId,
          userId: targetUserId,
        },
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            avatarUrl: true,
          },
        },
      },
    });

    if (existing) {
      return existing;
    }

    return this.prisma.$transaction(async (tx) => {
      const member = await tx.projectMember.create({
        data: {
          projectId,
          userId: targetUserId,
        },
        include: {
          user: {
            select: {
              id: true,
              name: true,
              email: true,
              avatarUrl: true,
            },
          },
        },
      });

      await tx.auditLog.create({
        data: {
          actorUserId: userId,
          accountId: project.workspace.accountId,
          workspaceId: project.workspaceId,
          projectId: project.id,
          action: 'MEMBER_ASSIGNED_TO_PROJECT',
          metadata: {
            assignedUserId: targetUserId,
          },
        },
      });

      return member;
    });
  }

  async removeMember(userId: string, projectId: string, targetUserId: string) {
    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
      include: { workspace: true },
    });

    if (!project || project.deletedAt !== null) {
      throw new NotFoundException({
        code: 'RESOURCE_NOT_FOUND',
        message: 'The requested project does not exist.',
      });
    }

    const member = await this.prisma.projectMember.findUnique({
      where: {
        projectId_userId: {
          projectId,
          userId: targetUserId,
        },
      },
    });

    if (!member) {
      throw new NotFoundException({
        code: 'RESOURCE_NOT_FOUND',
        message: 'User is not assigned to this project.',
      });
    }

    // Invariant (BR-TSK-03.4): When an assignee is removed from a project,
    // all their assigned tasks in this project have assigneeId set to null.
    await this.prisma.$transaction(async (tx) => {
      await tx.projectMember.delete({
        where: {
          projectId_userId: {
            projectId,
            userId: targetUserId,
          },
        },
      });

      await tx.task.updateMany({
        where: {
          projectId,
          assigneeId: targetUserId,
        },
        data: {
          assigneeId: null,
        },
      });

      await tx.auditLog.create({
        data: {
          actorUserId: userId,
          accountId: project.workspace.accountId,
          workspaceId: project.workspaceId,
          projectId: project.id,
          action: 'MEMBER_REMOVED_FROM_PROJECT',
          metadata: {
            removedUserId: targetUserId,
          },
        },
      });
    });
  }

  async listProjectMembers(projectId: string) {
    return this.prisma.projectMember.findMany({
      where: { projectId },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            avatarUrl: true,
          },
        },
      },
      orderBy: { assignedAt: 'asc' },
    });
  }
}
