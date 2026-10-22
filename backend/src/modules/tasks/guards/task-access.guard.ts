import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { WorkspaceRole, AccountOffboardingState, ProjectRole } from '@prisma/client';

@Injectable()
export class TaskAccessGuard implements CanActivate {
  constructor(private readonly prisma: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const user = request.user;

    if (!user || !user.id) {
      throw new ForbiddenException('User authentication required before task evaluation.');
    }

    const taskId = request.params?.id || request.params?.taskId;
    if (!taskId) {
      throw new BadRequestException('Task identifier is missing from request parameters.');
    }

    const task = await this.prisma.task.findUnique({
      where: { id: taskId },
      include: {
        project: {
          include: {
            workspace: {
              include: {
                account: true,
                members: {
                  where: { userId: user.id },
                },
              },
            },
            members: {
              where: { userId: user.id },
            },
          },
        },
      },
    });

    // Anti-Enumeration & Privacy (BR-PRJ-01, DEC-05):
    // If task or parent project does not exist, or is soft-deleted, return 404 Not Found.
    // Exception: If this is an authorized restoration request, permit soft-deleted tasks to evaluate permissions.
    const isRestoreRequest = request.url?.includes('/restore') || request.path?.includes('/restore');

    if (!task || task.project.deletedAt !== null) {
      throw new NotFoundException({
        code: 'RESOURCE_NOT_FOUND',
        message: 'The requested task does not exist.',
      });
    }

    // CS-04: the detail route may open a soft-deleted task so the restore window can be shown;
    // the service then answers 404 unless the caller is the author or an administrator.
    const path = String(request.originalUrl || request.url || '').split('?')[0];
    const isDetailRead = request.method === 'GET' && /\/tasks\/[^/]+\/?$/.test(path);

    if (task.deletedAt !== null && !isRestoreRequest && !isDetailRead) {
      throw new NotFoundException({
        code: 'RESOURCE_NOT_FOUND',
        message: 'The requested task does not exist.',
      });
    }

    const isAccountOwner = task.project.workspace.account.ownerId === user.id;
    const workspaceMember = task.project.workspace.members[0];
    const isWorkspaceAdmin = workspaceMember?.role === WorkspaceRole.ADMIN;
    const isProjectMember = task.project.members.length > 0;

    // Defense-in-depth Anti-Enumeration:
    // Unauthorized members or outside callers must strictly receive 404 Not Found.
    if (!isAccountOwner && !isWorkspaceAdmin && !isProjectMember) {
      throw new NotFoundException({
        code: 'RESOURCE_NOT_FOUND',
        message: 'The requested task does not exist.',
      });
    }

    // Defense-in-depth: Block writes if account is undergoing offboarding
    if (
      task.project.workspace.account.offboardingState === AccountOffboardingState.PENDING &&
      request.method !== 'GET'
    ) {
      throw new ForbiddenException({
        code: 'ACCOUNT_OFFBOARDING_LOCKED',
        message: 'This account is undergoing offboarding. All workspace modifications are locked.',
      });
    }

    // Attach contextual task and authorization metadata to request
    request.task = task;
    request.project = task.project;
    // CS-05 / ADR-012: workspace override or project ADMIN role.
    request.isProjectAdmin = isAccountOwner || isWorkspaceAdmin || task.project.members[0]?.role === ProjectRole.ADMIN;
    request.isTaskAuthor = task.authorId === user.id;

    return true;
  }
}
