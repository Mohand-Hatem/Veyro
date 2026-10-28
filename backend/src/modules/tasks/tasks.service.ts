import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateTaskDto } from './dto/create-task.dto';
import { UpdateTaskDto } from './dto/update-task.dto';
import { ReopenTaskDto } from './dto/reopen-task.dto';
import { CreateCommentDto } from './dto/create-comment.dto';
import { QueryTasksDto } from './dto/query-tasks.dto';
import { QueryMyTasksDto, MyTasksView, MyTasksBucket } from './dto/query-my-tasks.dto';
import { completedAtPatch } from './task-completion';
import {
  TaskStatus,
  ProjectLifecycleStatus,
  NotificationType,
} from '@prisma/client';
import { NotificationsService } from '../notifications/notifications.service';

/** Business rule: a soft-deleted task can be restored for 30 days (docs/03, STATE-TSK-RESTORE). */
export const TASK_RESTORE_WINDOW_DAYS = 30;
const purgeAtOf = (deletedAt: Date | null) => (deletedAt ? new Date(deletedAt.getTime() + TASK_RESTORE_WINDOW_DAYS * 86400000) : null);

export const ALLOWED_TRANSITIONS: Record<TaskStatus, TaskStatus[]> = {
  [TaskStatus.TODO]: [TaskStatus.IN_PROGRESS, TaskStatus.CANCELLED],
  [TaskStatus.IN_PROGRESS]: [TaskStatus.IN_REVIEW, TaskStatus.TODO, TaskStatus.CANCELLED],
  [TaskStatus.IN_REVIEW]: [TaskStatus.DONE, TaskStatus.IN_PROGRESS, TaskStatus.CANCELLED],
  [TaskStatus.DONE]: [],      // Dedicated /reopen endpoint required (BR-TSK-01.1)
  [TaskStatus.CANCELLED]: [], // Dedicated /reopen endpoint required (BR-TSK-01.1)
};

@Injectable()
export class TasksService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
  ) {}

  /** The words a task notification needs, copied now so a later rename or delete does not change it. */
  private noticeData(title: string, project: { name: string; key: string; workspace: { name: string; slug: string } }) {
    return { taskTitle: title, projectName: project.name, projectKey: project.key, workspaceName: project.workspace.name, workspaceSlug: project.workspace.slug };
  }

  async createTask(userId: string, projectId: string, dto: CreateTaskDto, isProjectAdmin: boolean) {
    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
      include: {
        workspace: true,
      },
    });

    if (!project || project.deletedAt !== null) {
      throw new NotFoundException({
        code: 'RESOURCE_NOT_FOUND',
        message: 'The requested project does not exist.',
      });
    }

    // CS-05 / ADR-012: only project admins (incl. workspace admins and the account owner) create tasks.
    if (!isProjectAdmin) {
      throw new ForbiddenException({
        code: 'PERMISSION_DENIED',
        message: 'Only project administrators can create tasks.',
      });
    }

    // Billing hold check (BR-SUB-03, D-3)
    if (project.isBillingReadOnly) {
      throw new ForbiddenException({
        code: 'PROJECT_BILLING_READ_ONLY',
        message: 'This project is in read-only mode due to subscription capacity constraints.',
      });
    }

    // Archived project lock (BR-PRJ-02)
    if (project.lifecycleStatus === ProjectLifecycleStatus.ARCHIVED) {
      throw new BadRequestException({
        code: 'PROJECT_ARCHIVED',
        message: 'Cannot create tasks in an archived project.',
      });
    }

    // Assignee validation: must be an active project member (BR-TSK-03.2)
    if (dto.assigneeId) {
      const isProjectMember = await this.prisma.projectMember.findUnique({
        where: {
          projectId_userId: {
            projectId,
            userId: dto.assigneeId,
          },
        },
      });

      if (!isProjectMember) {
        throw new BadRequestException({
          code: 'ASSIGNEE_NOT_PROJECT_MEMBER',
          message: 'The specified assignee must be an active member of the project.',
        });
      }
    }

    return this.prisma.$transaction(async (tx) => {
      const task = await tx.task.create({
        data: {
          projectId,
          title: dto.title,
          description: dto.description,
          priority: dto.priority,
          category: dto.category,
          authorId: userId,
          assigneeId: dto.assigneeId,
          dueDate: dto.dueDate ? new Date(dto.dueDate) : null,
          status: TaskStatus.TODO,
        },
        include: {
          author: {
            select: { id: true, name: true, email: true, avatarUrl: true },
          },
          assignee: {
            select: { id: true, name: true, email: true, avatarUrl: true },
          },
        },
      });

      await tx.auditLog.create({
        data: {
          actorUserId: userId,
          accountId: project.workspace.accountId,
          workspaceId: project.workspaceId,
          projectId: project.id,
          taskId: task.id,
          action: 'TASK_CREATED',
          metadata: {
            title: task.title,
            priority: task.priority,
          },
        },
      });

      if (task.assigneeId) {
        await this.notifications.notify(tx, { type: NotificationType.TASK_ASSIGNED, recipientId: task.assigneeId, actorId: userId, workspaceId: project.workspaceId, projectId: project.id, taskId: task.id, data: this.noticeData(task.title, project) });
      }

      return task;
    });
  }

  async listProjectTasks(projectId: string, query: QueryTasksDto, viewer: { userId: string; isAdmin: boolean }) {
    const page = query.page || 1;
    const limit = query.limit || 20;
    const skip = (page - 1) * limit;

    // Deleted tasks are visible only to administrators and to the task's own author (CS-04).
    // Deleted tasks (the restore window) are visible to project admins only (CS-05); others get an empty list.
    if (query.deleted && !viewer.isAdmin) {
      return { tasks: [], meta: { total: 0, page, limit, totalPages: 0 } };
    }
    const whereClause: any = query.deleted ? { projectId, deletedAt: { not: null } } : { projectId, deletedAt: null };
    if (query.category) {
      whereClause.category = query.category;
    }

    if (query.status) {
      whereClause.status = query.status;
    }
    if (query.priority) {
      whereClause.priority = query.priority;
    }
    if (query.assigneeId) {
      whereClause.assigneeId = query.assigneeId;
    }

    const [tasks, total] = await Promise.all([
      this.prisma.task.findMany({
        where: whereClause,
        include: {
          author: {
            select: { id: true, name: true, email: true, avatarUrl: true },
          },
          assignee: {
            select: { id: true, name: true, email: true, avatarUrl: true },
          },
          _count: {
            select: { comments: true },
          },
        },
        orderBy: query.deleted ? [{ deletedAt: 'desc' }, { id: 'desc' }] : [{ createdAt: 'desc' }, { id: 'desc' }],
        skip,
        take: limit,
      }),
      this.prisma.task.count({ where: whereClause }),
    ]);

    return {
      tasks: query.deleted ? tasks.map((t) => ({ ...t, purgeAt: purgeAtOf(t.deletedAt) })) : tasks,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async getTaskDetails(taskId: string, viewer: { userId: string; isAdmin: boolean; isAuthor: boolean }) {
    const task = await this.prisma.task.findUnique({
      where: { id: taskId },
      include: {
        project: {
          select: {
            id: true,
            name: true,
            lifecycleStatus: true,
            isBillingReadOnly: true,
            workspaceId: true,
          },
        },
        author: {
          select: { id: true, name: true, email: true, avatarUrl: true },
        },
        assignee: {
          select: { id: true, name: true, email: true, avatarUrl: true },
        },
        comments: {
          where: { deletedAt: null },
          include: {
            author: {
              select: { id: true, name: true, email: true, avatarUrl: true },
            },
          },
          orderBy: { createdAt: 'asc' },
        },
      },
    });

    const privileged = viewer.isAdmin;
    // A soft-deleted task is only visible to project admins; everyone else gets 404.
    // (CS-05: authors who are plain members can no longer delete or restore, so they no longer see it either.)
    if (!task || (task.deletedAt !== null && !privileged)) {
      throw new NotFoundException({
        code: 'RESOURCE_NOT_FOUND',
        message: 'The requested task does not exist.',
      });
    }

    const deleted = task.deletedAt !== null;
    const terminal = task.status === TaskStatus.DONE || task.status === TaskStatus.CANCELLED;
    const isAssignee = task.assigneeId === viewer.userId;
    return {
      ...task,
      purgeAt: purgeAtOf(task.deletedAt),
      // What this caller may do, so the UI never has to guess (the server stays the authority).
      viewer: {
        userId: viewer.userId,
        isProjectAdmin: viewer.isAdmin,
        isTaskAuthor: viewer.isAuthor,
        isAssignee,
        canEdit: privileged && !deleted,
        canAssign: privileged && !deleted,
        canReopen: privileged && terminal && !deleted,
        canDelete: privileged && !deleted,
        canRestore: privileged && deleted,
        // Statuses this caller can move the task to: admins any allowed step, an assigned member the normal
        // steps except cancelling. Terminal tasks go back only through /reopen.
        allowedStatuses: deleted || terminal ? [] : viewer.isAdmin ? ALLOWED_TRANSITIONS[task.status] : isAssignee ? ALLOWED_TRANSITIONS[task.status].filter((s) => s !== TaskStatus.CANCELLED) : [],
      },
    };
  }

  async updateTask(userId: string, taskId: string, dto: UpdateTaskDto, isProjectAdmin: boolean) {
    const task = await this.prisma.task.findUnique({
      where: { id: taskId },
      include: {
        project: {
          include: { workspace: true },
        },
      },
    });

    if (!task || task.deletedAt !== null || task.project.deletedAt !== null) {
      throw new NotFoundException({
        code: 'RESOURCE_NOT_FOUND',
        message: 'The requested task does not exist.',
      });
    }

    // Billing hold and archived project check
    if (task.project.isBillingReadOnly) {
      throw new ForbiddenException({
        code: 'PROJECT_BILLING_READ_ONLY',
        message: 'This project is in read-only mode due to subscription capacity constraints.',
      });
    }

    if (task.project.lifecycleStatus === ProjectLifecycleStatus.ARCHIVED) {
      throw new BadRequestException({
        code: 'PROJECT_ARCHIVED',
        message: 'Cannot modify tasks in an archived project.',
      });
    }

    // CS-05 / ADR-012: task information and assignment belong to project admins. An assigned member may only
    // move the status (never cancel); everyone can comment through the comments endpoint.
    if (!isProjectAdmin) {
      const infoKeys = ['title', 'description', 'priority', 'category', 'assigneeId', 'dueDate'] as const;
      if (infoKeys.some((k) => dto[k] !== undefined)) {
        throw new ForbiddenException({
          code: 'PERMISSION_DENIED',
          message: 'Only project administrators can edit task information or assign tasks.',
        });
      }
      if (dto.status && dto.status !== task.status) {
        if (task.assigneeId !== userId) {
          throw new ForbiddenException({
            code: 'PERMISSION_DENIED',
            message: 'Members can only move tasks that are assigned to them.',
          });
        }
        if (dto.status === TaskStatus.CANCELLED) {
          throw new ForbiddenException({
            code: 'PERMISSION_DENIED',
            message: 'Only project administrators can cancel a task.',
          });
        }
      }
    }

    // Assignee validation if changed
    if (dto.assigneeId !== undefined && dto.assigneeId !== null) {
      const isProjectMember = await this.prisma.projectMember.findUnique({
        where: {
          projectId_userId: {
            projectId: task.projectId,
            userId: dto.assigneeId,
          },
        },
      });

      if (!isProjectMember) {
        throw new BadRequestException({
          code: 'ASSIGNEE_NOT_PROJECT_MEMBER',
          message: 'The specified assignee must be an active member of the project.',
        });
      }
    }

    // State machine evaluation (BR-TSK-01)
    if (dto.status && dto.status !== task.status) {
      if (task.status === TaskStatus.DONE || task.status === TaskStatus.CANCELLED) {
        throw new BadRequestException({
          code: 'REOPEN_REQUIRED',
          message: 'Reopening from DONE or CANCELLED requires the dedicated /reopen endpoint with mandatory justification.',
        });
      }

      const allowed = ALLOWED_TRANSITIONS[task.status] || [];
      if (!allowed.includes(dto.status)) {
        throw new BadRequestException({
          code: 'INVALID_STATE_TRANSITION',
          message: `Direct transition from ${task.status} to ${dto.status} is disallowed. Permitted next statuses: ${allowed.join(', ')}.`,
        });
      }
    }

    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.task.update({
        where: { id: taskId },
        data: {
          title: dto.title,
          description: dto.description,
          priority: dto.priority,
          category: dto.category,
          assigneeId: dto.assigneeId,
          dueDate: dto.dueDate !== undefined ? (dto.dueDate ? new Date(dto.dueDate) : null) : undefined,
          status: dto.status,
          ...(dto.status ? completedAtPatch(task.status, dto.status) : {}),
        },
        include: {
          author: {
            select: { id: true, name: true, email: true, avatarUrl: true },
          },
          assignee: {
            select: { id: true, name: true, email: true, avatarUrl: true },
          },
        },
      });

      await tx.auditLog.create({
        data: {
          actorUserId: userId,
          accountId: task.project.workspace.accountId,
          workspaceId: task.project.workspaceId,
          projectId: task.projectId,
          taskId: task.id,
          action: dto.status && dto.status !== task.status ? 'TASK_STATUS_CHANGED' : 'TASK_UPDATED',
          metadata: JSON.parse(
            JSON.stringify({
              changes: dto,
              previousStatus: task.status,
              newStatus: dto.status || task.status,
            }),
          ),
        },
      });

      // Only a NEW assignee is told (editing other fields of an assigned task is not an assignment).
      if (updated.assigneeId && updated.assigneeId !== task.assigneeId) {
        await this.notifications.notify(tx, { type: NotificationType.TASK_ASSIGNED, recipientId: updated.assigneeId, actorId: userId, workspaceId: task.project.workspaceId, projectId: task.projectId, taskId: task.id, data: this.noticeData(updated.title, task.project) });
      }

      return updated;
    });
  }

  async reopenTask(
    userId: string,
    taskId: string,
    dto: ReopenTaskDto,
    isPrivilegedAdmin: boolean,
  ) {
    const task = await this.prisma.task.findUnique({
      where: { id: taskId },
      include: {
        project: {
          include: { workspace: true },
        },
      },
    });

    if (!task || task.deletedAt !== null || task.project.deletedAt !== null) {
      throw new NotFoundException({
        code: 'RESOURCE_NOT_FOUND',
        message: 'The requested task does not exist.',
      });
    }

    // Role check (CS-05 / ADR-012): project administrators only (this includes workspace admins and the account owner).
    if (!isPrivilegedAdmin) {
      throw new ForbiddenException({
        code: 'PERMISSION_DENIED',
        message: 'Only project administrators can reopen tasks.',
      });
    }

    // Project constraints
    if (task.project.lifecycleStatus === ProjectLifecycleStatus.ARCHIVED) {
      throw new BadRequestException({
        code: 'PROJECT_ARCHIVED',
        message: 'Cannot reopen tasks in an archived project.',
      });
    }

    if (task.project.isBillingReadOnly) {
      throw new ForbiddenException({
        code: 'PROJECT_BILLING_READ_ONLY',
        message: 'Cannot reopen tasks in a billing-locked project.',
      });
    }

    // Verify task is in a terminal state
    if (task.status !== TaskStatus.DONE && task.status !== TaskStatus.CANCELLED) {
      throw new BadRequestException({
        code: 'TASK_NOT_TERMINATED',
        message: 'Only completed (DONE) or cancelled (CANCELLED) tasks can be reopened.',
      });
    }

    // Verify target status
    const expectedTarget = task.status === TaskStatus.DONE ? TaskStatus.IN_PROGRESS : TaskStatus.TODO;
    if (dto.targetStatus !== expectedTarget) {
      throw new BadRequestException({
        code: 'INVALID_TARGET_STATUS',
        message: `Task in ${task.status} status must be transitioned to ${expectedTarget}.`,
      });
    }

    const trimmedReason = dto.reason.trim();
    if (trimmedReason.length < 5) {
      throw new BadRequestException({
        code: 'INVALID_REASON',
        message: 'Reopening reason must be at least 5 characters long.',
      });
    }

    const action = task.status === TaskStatus.DONE ? 'TASK_REOPENED' : 'TASK_REINSTATED';

    return this.prisma.$transaction(async (tx) => {
      const reopened = await tx.task.update({
        where: { id: taskId },
        data: {
          status: dto.targetStatus,
          ...completedAtPatch(task.status, dto.targetStatus),
        },
        include: {
          author: {
            select: { id: true, name: true, email: true, avatarUrl: true },
          },
          assignee: {
            select: { id: true, name: true, email: true, avatarUrl: true },
          },
        },
      });

      // Append mandatory audit comment with author attribution
      await tx.taskComment.create({
        data: {
          taskId,
          authorId: userId,
          content: `[${action}: ${task.status} ➔ ${dto.targetStatus}] ${trimmedReason}`,
        },
      });

      // Immutable audit log
      await tx.auditLog.create({
        data: {
          actorUserId: userId,
          accountId: task.project.workspace.accountId,
          workspaceId: task.project.workspaceId,
          projectId: task.projectId,
          taskId: task.id,
          action,
          metadata: {
            fromStatus: task.status,
            toStatus: dto.targetStatus,
            reason: trimmedReason,
          },
        },
      });

      return reopened;
    });
  }

  async createComment(userId: string, taskId: string, dto: CreateCommentDto) {
    const task = await this.prisma.task.findUnique({
      where: { id: taskId },
      include: {
        project: {
          include: { workspace: true },
        },
      },
    });

    if (!task || task.deletedAt !== null || task.project.deletedAt !== null) {
      throw new NotFoundException({
        code: 'RESOURCE_NOT_FOUND',
        message: 'The requested task does not exist.',
      });
    }

    if (task.project.isBillingReadOnly) {
      throw new ForbiddenException({
        code: 'PROJECT_BILLING_READ_ONLY',
        message: 'This project is in read-only mode due to subscription capacity constraints.',
      });
    }

    return this.prisma.$transaction(async (tx) => {
      const comment = await tx.taskComment.create({
        data: {
          taskId,
          authorId: userId,
          content: dto.content.trim(),
        },
        include: {
          author: {
            select: { id: true, name: true, email: true, avatarUrl: true },
          },
        },
      });

      await tx.auditLog.create({
        data: {
          actorUserId: userId,
          accountId: task.project.workspace.accountId,
          workspaceId: task.project.workspaceId,
          projectId: task.projectId,
          taskId: task.id,
          action: 'COMMENT_CREATED',
        },
      });

      // The person the task is assigned to and the person who created it hear about a comment (never the commenter).
      for (const recipientId of new Set([task.assigneeId, task.authorId])) {
        if (!recipientId) continue;
        await this.notifications.notify(tx, { type: NotificationType.TASK_COMMENTED, recipientId, actorId: userId, workspaceId: task.project.workspaceId, projectId: task.projectId, taskId: task.id, data: this.noticeData(task.title, task.project) });
      }

      return comment;
    });
  }

  async listTaskComments(taskId: string) {
    return this.prisma.taskComment.findMany({
      where: {
        taskId,
        deletedAt: null,
      },
      include: {
        author: {
          select: { id: true, name: true, email: true, avatarUrl: true },
        },
      },
      orderBy: { createdAt: 'asc' },
    });
  }

  async softDeleteTask(
    userId: string,
    taskId: string,
    isProjectAdmin: boolean,
  ) {
    const task = await this.prisma.task.findUnique({
      where: { id: taskId },
      include: {
        project: {
          include: {
            workspace: true,
          },
        },
      },
    });

    if (!task || task.deletedAt !== null || task.project.deletedAt !== null) {
      throw new NotFoundException({
        code: 'RESOURCE_NOT_FOUND',
        message: 'The requested task does not exist.',
      });
    }

    if (!isProjectAdmin) {
      throw new ForbiddenException({
        code: 'PERMISSION_DENIED',
        message: 'Only project administrators can delete this task.',
      });
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.task.update({
        where: { id: taskId },
        data: { deletedAt: new Date() },
      });

      await tx.auditLog.create({
        data: {
          actorUserId: userId,
          accountId: task.project.workspace.accountId,
          workspaceId: task.project.workspaceId,
          projectId: task.projectId,
          taskId: task.id,
          action: 'TASK_DELETED',
          metadata: {
            title: task.title,
            status: task.status,
          },
        },
      });
    });
  }

  async restoreTask(
    userId: string,
    taskId: string,
    isProjectAdmin: boolean,
  ) {
    const task = await this.prisma.task.findUnique({
      where: { id: taskId },
      include: {
        project: {
          include: {
            workspace: true,
          },
        },
      },
    });

    if (!task || task.project.deletedAt !== null) {
      throw new NotFoundException({
        code: 'RESOURCE_NOT_FOUND',
        message: 'The requested task does not exist.',
      });
    }

    if (task.deletedAt === null) {
      throw new BadRequestException({
        code: 'TASK_NOT_DELETED',
        message: 'The specified task is already active and cannot be restored.',
      });
    }

    if (!isProjectAdmin) {
      throw new ForbiddenException({
        code: 'PERMISSION_DENIED',
        message: 'Only project administrators can restore this task.',
      });
    }

    // Business Constraint: Cannot restore into an archived project
    if (task.project.lifecycleStatus === ProjectLifecycleStatus.ARCHIVED) {
      throw new BadRequestException({
        code: 'PROJECT_ARCHIVED',
        message: 'Cannot restore task into an archived project.',
      });
    }

    // Business Constraint: Cannot restore if project is in billing read-only mode
    if (task.project.isBillingReadOnly) {
      throw new ForbiddenException({
        code: 'PROJECT_BILLING_READ_ONLY',
        message: 'This project is in read-only mode due to subscription capacity constraints.',
      });
    }

    return this.prisma.$transaction(async (tx) => {
      const restored = await tx.task.update({
        where: { id: taskId },
        data: { deletedAt: null },
      });

      await tx.auditLog.create({
        data: {
          actorUserId: userId,
          accountId: task.project.workspace.accountId,
          workspaceId: task.project.workspaceId,
          projectId: task.projectId,
          taskId: task.id,
          action: 'TASK_RESTORED',
          metadata: {
            title: task.title,
            status: task.status,
          },
        },
      });

      return restored;
    });
  }

  /**
   * "My tasks" across the projects of one workspace (CS-08, ADR-015). Only tasks assigned to the caller, only in projects
   * the caller can see (members see their own projects; admins and the owner see all), never soft-deleted ones.
   * `counts` describe the whole open set (honouring `projectId`) so the bucket chips stay stable while one is selected.
   */
  async listMyTasks(userId: string, workspaceId: string, isPrivileged: boolean, query: QueryMyTasksDto) {
    const page = query.page || 1;
    const limit = query.limit || 20;
    const view = query.view || MyTasksView.OPEN;
    const now = new Date();
    const startOfDay = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
    const endOfDay = new Date(startOfDay.getTime() + 86_400_000);

    const visible: any = {
      assigneeId: userId,
      deletedAt: null,
      project: {
        workspaceId,
        deletedAt: null,
        ...(isPrivileged ? {} : { members: { some: { userId } } }),
      },
    };
    const base: any = { ...visible, ...(query.projectId ? { projectId: query.projectId } : {}) };
    const open = { status: { in: [TaskStatus.TODO, TaskStatus.IN_PROGRESS, TaskStatus.IN_REVIEW] } };

    const bucketWhere = (b?: MyTasksBucket) =>
      b === MyTasksBucket.OVERDUE ? { dueDate: { lt: startOfDay } }
        : b === MyTasksBucket.TODAY ? { dueDate: { gte: startOfDay, lt: endOfDay } }
        : b === MyTasksBucket.UPCOMING ? { dueDate: { gte: endOfDay } }
        : b === MyTasksBucket.NO_DATE ? { dueDate: null }
        : {};

    const where = view === MyTasksView.DONE
      ? { ...base, status: TaskStatus.DONE }
      : { ...base, ...open, ...bucketWhere(query.bucket) };

    const [tasks, total, overdue, today, upcoming, noDate, done, openProjects] = await Promise.all([
      this.prisma.task.findMany({
        where,
        orderBy: view === MyTasksView.DONE
          ? [{ completedAt: { sort: 'desc', nulls: 'last' } }, { id: 'desc' }]
          : [{ dueDate: { sort: 'asc', nulls: 'last' } }, { priority: 'desc' }, { createdAt: 'desc' }, { id: 'desc' }],
        skip: (page - 1) * limit,
        take: limit,
        select: {
          id: true, title: true, status: true, priority: true, category: true, dueDate: true, completedAt: true,
          project: { select: { id: true, key: true, name: true, lifecycleStatus: true, isBillingReadOnly: true } },
        },
      }),
      this.prisma.task.count({ where }),
      this.prisma.task.count({ where: { ...base, ...open, ...bucketWhere(MyTasksBucket.OVERDUE) } }),
      this.prisma.task.count({ where: { ...base, ...open, ...bucketWhere(MyTasksBucket.TODAY) } }),
      this.prisma.task.count({ where: { ...base, ...open, ...bucketWhere(MyTasksBucket.UPCOMING) } }),
      this.prisma.task.count({ where: { ...base, ...open, ...bucketWhere(MyTasksBucket.NO_DATE) } }),
      this.prisma.task.count({ where: { ...base, status: TaskStatus.DONE } }),
      // CS-12: how many projects my open tasks sit in (ignores the project filter, so the page headline stays stable)
      this.prisma.task.groupBy({ by: ['projectId'], where: { ...visible, ...open } }),
    ]);

    return {
      tasks,
      counts: { open: overdue + today + upcoming + noDate, overdue, today, upcoming, noDate, done, projects: openProjects.length },
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    };
  }
}
