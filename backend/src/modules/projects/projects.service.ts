import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
  ConflictException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateProjectDto } from './dto/create-project.dto';
import { UpdateProjectDto } from './dto/update-project.dto';
import { QueryProjectsDto } from './dto/query-projects.dto';
import { generateProjectKey } from './project-key';
import {
  AccountOffboardingState,
  ProjectLifecycleStatus,
  ProjectRole,
  SubscriptionPlanTier,
  TaskStatus,
  WorkspaceRole,
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

  private keyTaken(key: string) {
    return new ConflictException({
      code: 'PROJECT_KEY_TAKEN',
      message: `Another project in this workspace already uses the key "${key}".`,
    });
  }

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

    // Project key (ADR-003): explicit keys are validated by the DTO; otherwise derive one from the name.
    // Soft-deleted projects keep their key reserved, so the lookup deliberately includes them.
    const takenKeys = new Set(
      (await this.prisma.project.findMany({ where: { workspaceId }, select: { key: true } })).map((p) => p.key),
    );
    if (dto.key && takenKeys.has(dto.key)) {
      throw this.keyTaken(dto.key);
    }
    const key = dto.key ?? generateProjectKey(dto.name, takenKeys);

    // Atomic creation and creator assignment
    return this.prisma.$transaction(async (tx) => {
      let project;
      try {
        project = await tx.project.create({
          data: {
            workspaceId,
            name: dto.name,
            key,
            description: dto.description,
            lifecycleStatus: ProjectLifecycleStatus.ACTIVE,
            createdById: userId,
          },
        });
      } catch (err: any) {
        // The unique index (workspaceId, key) is the final arbiter under concurrent creation.
        if (err?.code === 'P2002') throw this.keyTaken(key);
        throw err;
      }

      // The creator becomes the project's protected owner and a project admin (CS-05, ADR-012).
      await tx.projectMember.create({
        data: {
          projectId: project.id,
          userId,
          role: ProjectRole.ADMIN,
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
            key: project.key,
          },
        },
      });

      return project;
    });
  }

  /**
   * Project catalog (CS-08, ADR-015). Additive over the original list: optional filters, plus per-row creator,
   * per-status task counts and `viewer` capabilities so the UI never guesses what to show.
   * Soft-deleted projects are listed only on request and only for workspace admins / the account owner (the trash view).
   */
  async listWorkspaceProjects(userId: string, workspaceId: string, isPrivileged: boolean, query: QueryProjectsDto = {}) {
    if (query.deleted && !isPrivileged) {
      throw new ForbiddenException({
        code: 'PERMISSION_DENIED',
        message: 'Only workspace administrators or the account owner can see deleted projects.',
      });
    }
    const showDeleted = Boolean(query.deleted);
    const whereClause: any = {
      workspaceId,
      deletedAt: showDeleted ? { not: null } : null,
    };

    // Privacy (BR-PRJ-01): standard members only see projects they are assigned to.
    if (!isPrivileged) {
      whereClause.members = { some: { userId } };
    }
    if (query.status) whereClause.lifecycleStatus = query.status;
    if (query.q) {
      whereClause.OR = [
        { name: { contains: query.q, mode: 'insensitive' } },
        { key: { contains: query.q, mode: 'insensitive' } },
      ];
    }

    const projects = await this.prisma.project.findMany({
      where: whereClause,
      include: {
        _count: { select: { members: true, tasks: { where: { deletedAt: null } } } },
        createdBy: { select: { id: true, name: true, avatarUrl: true } },
        // The viewer's own role and the avatar stack both come from this relation (CS-12): oldest assignments first.
        members: {
          orderBy: { assignedAt: 'asc' },
          select: { userId: true, role: true, user: { select: { name: true, avatarUrl: true } } },
        },
      },
      orderBy: showDeleted ? { deletedAt: 'desc' } : { createdAt: 'desc' },
      take: 100, // plan caps keep live projects at 25; this only bounds the trash view
    });

    const groups = projects.length
      ? await this.prisma.task.groupBy({
          by: ['projectId', 'status'],
          where: { projectId: { in: projects.map((p) => p.id) }, deletedAt: null },
          _count: { _all: true },
        })
      : [];
    const counts = new Map<string, { todo: number; inProgress: number; inReview: number; done: number; cancelled: number }>();
    for (const g of groups) {
      const c = counts.get(g.projectId) ?? { todo: 0, inProgress: 0, inReview: 0, done: 0, cancelled: 0 };
      const n = g._count._all;
      if (g.status === TaskStatus.TODO) c.todo += n;
      else if (g.status === TaskStatus.IN_PROGRESS) c.inProgress += n;
      else if (g.status === TaskStatus.IN_REVIEW) c.inReview += n;
      else if (g.status === TaskStatus.DONE) c.done += n;
      else c.cancelled += n;
      counts.set(g.projectId, c);
    }

    return projects.map(({ members, ...p }) => {
      const mine = members.find((m) => m.userId === userId);
      const isProjectAdmin = isPrivileged || mine?.role === ProjectRole.ADMIN;
      return {
        ...p,
        members: members.slice(0, 4).map((m) => ({ userId: m.userId, name: m.user.name, avatarUrl: m.user.avatarUrl })),
        taskCounts: counts.get(p.id) ?? { todo: 0, inProgress: 0, inReview: 0, done: 0, cancelled: 0 },
        viewer: {
          projectRole: isPrivileged ? ProjectRole.ADMIN : mine?.role ?? ProjectRole.MEMBER,
          canEdit: !showDeleted && isProjectAdmin && !p.isBillingReadOnly,
          // BR matrix: archive, unarchive and delete are workspace-level powers.
          canArchive: !showDeleted && isPrivileged && !p.isBillingReadOnly,
          canDelete: !showDeleted && isPrivileged,
          canRestore: showDeleted && isPrivileged,
        },
      };
    });
  }

  async getProjectDetails(projectId: string, viewer: { userId: string; isAdmin: boolean; isOverride: boolean; projectRole: ProjectRole }) {
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
          orderBy: { assignedAt: 'asc' },
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
        // Soft-deleted tasks are not part of the project's task count (CS-04).
        _count: {
          select: {
            tasks: { where: { deletedAt: null } },
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

    // Per-status counts for the completion gauge, computed in the database so they stay exact for any
    // project size (a task page is capped at 100 rows). CANCELLED is reported but never counted as progress.
    const grouped = await this.prisma.task.groupBy({
      by: ['status'],
      where: { projectId, deletedAt: null },
      _count: { _all: true },
    });
    const n = (s: string) => grouped.find((g) => g.status === s)?._count._all ?? 0;

    return {
      ...project,
      taskCounts: { todo: n('TODO'), inProgress: n('IN_PROGRESS'), inReview: n('IN_REVIEW'), done: n('DONE'), cancelled: n('CANCELLED') },
      // isAdmin = project admin (project role ADMIN, or workspace admin / account owner). canCreateTask and
      // canManageMembers follow it; the server stays the authority.
      viewer: {
        userId: viewer.userId,
        isAdmin: viewer.isAdmin,
        projectRole: viewer.projectRole,
        isWorkspaceOverride: viewer.isOverride,
        canCreateTask: viewer.isAdmin,
        canManageMembers: viewer.isAdmin,
      },
    };
  }

  async updateProject(userId: string, projectId: string, dto: UpdateProjectDto, isOverride = false) {
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

    // BR matrix (CS-08): archive / unarchive are workspace-level powers; project admins may only edit the details.
    if (dto.lifecycleStatus !== undefined && dto.lifecycleStatus !== project.lifecycleStatus && !isOverride) {
      throw new ForbiddenException({
        code: 'PERMISSION_DENIED',
        message: 'Only workspace administrators or the account owner can archive or unarchive a project.',
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

  async softDeleteProject(userId: string, projectId: string, isOverride = false) {
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

    // BR matrix (CS-08): deleting a project is a workspace-level power. Billing read-only does NOT block it:
    // a downgraded owner must be able to delete projects to free capacity.
    if (!isOverride) {
      throw new ForbiddenException({
        code: 'PERMISSION_DENIED',
        message: 'Only workspace administrators or the account owner can delete a project.',
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

  /**
   * Restores a soft-deleted project (BR-DEL-02.3, CS-08). Workspace admins and the account owner only; everyone else gets
   * 404, so deleted projects stay invisible. Needs free plan capacity (archived projects count, deleted ones do not).
   * The project returns in the lifecycle state it had; the key was reserved the whole time.
   */
  async restoreProject(userId: string, projectId: string) {
    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
      include: { workspace: { include: { account: { include: { subscription: true } }, members: { where: { userId } } } } },
    });
    const notFound = () =>
      new NotFoundException({ code: 'RESOURCE_NOT_FOUND', message: 'The requested project does not exist.' });
    if (!project || project.deletedAt === null) throw notFound();

    const account = project.workspace.account;
    const isPrivileged = account.ownerId === userId || project.workspace.members[0]?.role === WorkspaceRole.ADMIN;
    if (!isPrivileged) throw notFound();

    if (account.offboardingState === AccountOffboardingState.PENDING) {
      throw new ForbiddenException({
        code: 'ACCOUNT_OFFBOARDING_LOCKED',
        message: 'This account is undergoing offboarding. All workspace modifications are locked.',
      });
    }

    const tier = account.subscription?.tier || SubscriptionPlanTier.FREE;
    const live = await this.prisma.project.count({ where: { workspace: { accountId: account.id }, deletedAt: null } });
    if (live >= TIER_PROJECT_LIMITS[tier]) {
      throw new ConflictException({
        code: 'PROJECT_CAPACITY_EXCEEDED',
        message: 'Project limit reached for your account plan. Free up capacity or upgrade to restore.',
      });
    }

    return this.prisma.$transaction(async (tx) => {
      const restored = await tx.project.update({ where: { id: projectId }, data: { deletedAt: null } });
      await tx.auditLog.create({
        data: {
          actorUserId: userId,
          accountId: account.id,
          workspaceId: project.workspaceId,
          projectId,
          action: 'PROJECT_RESTORED',
          metadata: { name: project.name, key: project.key },
        },
      });
      return restored;
    });
  }

  async assignMember(userId: string, projectId: string, targetUserId: string, role: ProjectRole = ProjectRole.MEMBER) {
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
          role,
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

  async removeMember(userId: string, projectId: string, targetUserId: string, isOverride = false) {
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

    // The creator is the project's protected owner: only workspace admins or the account owner can remove them.
    if (project.createdById === targetUserId && !isOverride) {
      throw new ForbiddenException({
        code: 'PROJECT_OWNER_PROTECTED',
        message: 'The project creator cannot be removed by other project admins.',
      });
    }
    if (targetUserId === userId && !isOverride) {
      throw new UnprocessableEntityException({
        code: 'CANNOT_REMOVE_SELF',
        message: 'You cannot remove yourself from a project. Ask another project admin.',
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

  /**
   * Promote to / demote from project admin (CS-05). The creator stays protected, nobody changes their own role
   * (a workspace admin or the account owner always can step in), and the change is audited.
   */
  async updateMemberRole(actorId: string, projectId: string, targetUserId: string, role: ProjectRole, isOverride: boolean) {
    const project = await this.prisma.project.findUnique({ where: { id: projectId }, include: { workspace: true } });
    if (!project || project.deletedAt !== null) {
      throw new NotFoundException({ code: 'RESOURCE_NOT_FOUND', message: 'The requested project does not exist.' });
    }
    const member = await this.prisma.projectMember.findUnique({
      where: { projectId_userId: { projectId, userId: targetUserId } },
      include: { user: { select: { id: true, name: true, email: true, avatarUrl: true } } },
    });
    if (!member) {
      throw new NotFoundException({ code: 'RESOURCE_NOT_FOUND', message: 'User is not assigned to this project.' });
    }
    if (project.createdById === targetUserId && !isOverride) {
      throw new ForbiddenException({ code: 'PROJECT_OWNER_PROTECTED', message: 'The project creator keeps their role unless a workspace admin or the account owner changes it.' });
    }
    if (targetUserId === actorId && !isOverride) {
      throw new UnprocessableEntityException({ code: 'CANNOT_CHANGE_OWN_ROLE', message: 'You cannot change your own role. Ask another project admin.' });
    }
    if (member.role === role) return member;

    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.projectMember.update({
        where: { id: member.id },
        data: { role },
        include: { user: { select: { id: true, name: true, email: true, avatarUrl: true } } },
      });
      await tx.auditLog.create({
        data: {
          actorUserId: actorId,
          accountId: project.workspace.accountId,
          workspaceId: project.workspaceId,
          projectId,
          action: 'PROJECT_MEMBER_ROLE_CHANGED',
          metadata: { memberUserId: targetUserId, from: member.role, to: role },
        },
      });
      return updated;
    });
  }
}
