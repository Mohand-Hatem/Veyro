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
export class ProjectAccessGuard implements CanActivate {
  constructor(private readonly prisma: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const user = request.user;

    if (!user || !user.id) {
      throw new ForbiddenException('User authentication required before project evaluation.');
    }

    const projectId = request.params?.id || request.params?.projectId;
    if (!projectId) {
      throw new BadRequestException('Project identifier is missing from request parameters.');
    }

    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
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
    });

    // Anti-Enumeration & Privacy (BR-PRJ-01, DEC-05):
    // If project does not exist, or is soft-deleted, return 404 Not Found.
    if (!project || project.deletedAt !== null) {
      throw new NotFoundException({
        code: 'RESOURCE_NOT_FOUND',
        message: 'The requested project does not exist.',
      });
    }

    const isAccountOwner = project.workspace.account.ownerId === user.id;
    const workspaceMember = project.workspace.members[0];
    const isWorkspaceAdmin = workspaceMember?.role === WorkspaceRole.ADMIN;
    const isProjectMember = project.members.length > 0;

    // Defense-in-depth Anti-Enumeration:
    // If the caller is an unassigned workspace member or completely outside the tenant,
    // they MUST receive 404 Not Found to prevent leaking the existence of private projects.
    if (!isAccountOwner && !isWorkspaceAdmin && !isProjectMember) {
      throw new NotFoundException({
        code: 'RESOURCE_NOT_FOUND',
        message: 'The requested project does not exist.',
      });
    }

    // Defense-in-depth: Block writes if account is undergoing offboarding
    if (
      project.workspace.account.offboardingState === AccountOffboardingState.PENDING &&
      request.method !== 'GET'
    ) {
      throw new ForbiddenException({
        code: 'ACCOUNT_OFFBOARDING_LOCKED',
        message: 'This account is undergoing offboarding. All workspace modifications are locked.',
      });
    }

    // Attach contextual project and authorization metadata to request
    request.project = project;
    request.workspace = project.workspace;
    // CS-05 / ADR-012: workspace admins and the account owner override everywhere; otherwise the project role decides.
    const isWorkspaceOverride = isAccountOwner || isWorkspaceAdmin;
    request.isWorkspaceOverride = isWorkspaceOverride;
    request.projectRole = isWorkspaceOverride ? ProjectRole.ADMIN : project.members[0]?.role ?? ProjectRole.MEMBER;
    request.isProjectAdmin = isWorkspaceOverride || project.members[0]?.role === ProjectRole.ADMIN;
    request.isAccountOwner = isAccountOwner;

    return true;
  }
}
