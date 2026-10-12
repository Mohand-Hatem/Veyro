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
import {
  TaskStatus,
  ProjectLifecycleStatus,
} from '@prisma/client';

export const ALLOWED_TRANSITIONS: Record<TaskStatus, TaskStatus[]> = {
  [TaskStatus.TODO]: [TaskStatus.IN_PROGRESS, TaskStatus.CANCELLED],
  [TaskStatus.IN_PROGRESS]: [TaskStatus.IN_REVIEW, TaskStatus.TODO, TaskStatus.CANCELLED],
  [TaskStatus.IN_REVIEW]: [TaskStatus.DONE, TaskStatus.IN_PROGRESS, TaskStatus.CANCELLED],
  [TaskStatus.DONE]: [],      // Dedicated /reopen endpoint required (BR-TSK-01.1)
  [TaskStatus.CANCELLED]: [], // Dedicated /reopen endpoint required (BR-TSK-01.1)
};

@Injectable()
export class TasksService {
  constructor(private readonly prisma: PrismaService) {}

  async createTask(userId: string, projectId: string, dto: CreateTaskDto) {
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

      return task;
    });
  }

  async listProjectTasks(projectId: string, query: QueryTasksDto) {
    const page = query.page || 1;
    const limit = query.limit || 20;
    const skip = (page - 1) * limit;

    const whereClause: any = {
      projectId,
      deletedAt: null,
    };

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
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.task.count({ where: whereClause }),
    ]);

    return {
      tasks,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async getTaskDetails(taskId: string) {
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

    if (!task || task.deletedAt !== null || task.project.lifecycleStatus === ProjectLifecycleStatus.ARCHIVED && task.deletedAt !== null) {
      throw new NotFoundException({
        code: 'RESOURCE_NOT_FOUND',
        message: 'The requested task does not exist.',
      });
    }

    return task;
  }

  async updateTask(userId: string, taskId: string, dto: UpdateTaskDto) {
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
          assigneeId: dto.assigneeId,
          dueDate: dto.dueDate !== undefined ? (dto.dueDate ? new Date(dto.dueDate) : null) : undefined,
          status: dto.status,
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

    // Role check: Strictly Author, Workspace Admin, or Account Owner (BR-TSK-01.1)
    const isAuthor = task.authorId === userId;
    if (!isAuthor && !isPrivilegedAdmin) {
      throw new ForbiddenException({
        code: 'PERMISSION_DENIED',
        message: 'Only the original task author, workspace administrators, or the account owner can reopen tasks.',
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
}
