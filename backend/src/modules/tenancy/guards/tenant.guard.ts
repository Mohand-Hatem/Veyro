import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { WorkspaceRole, AccountOffboardingState } from '@prisma/client';

@Injectable()
export class TenantGuard implements CanActivate {
  constructor(private readonly prisma: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const user = request.user;

    if (!user || !user.id) {
      throw new ForbiddenException('User authentication required before tenant evaluation.');
    }

    const workspaceId =
      request.params?.workspaceId ||
      request.params?.id ||
      request.headers?.['x-workspace-id'] ||
      request.body?.workspaceId;

    if (!workspaceId) {
      throw new ForbiddenException('Workspace identifier is missing from request context.');
    }

    const workspace = await this.prisma.workspace.findUnique({
      where: { id: workspaceId },
      include: {
        account: true,
        members: {
          where: { userId: user.id },
        },
      },
    });

    if (!workspace) {
      throw new NotFoundException({
        code: 'RESOURCE_NOT_FOUND',
        message: 'The requested workspace does not exist.',
      });
    }

    // Defense-in-depth: Block writes if account is undergoing offboarding (D-13)
    if (
      workspace.account.offboardingState === AccountOffboardingState.PENDING &&
      request.method !== 'GET'
    ) {
      throw new ForbiddenException({
        code: 'ACCOUNT_OFFBOARDING_LOCKED',
        message: 'This account is undergoing offboarding. All workspace modifications are locked.',
      });
    }

    const isAccountOwner = workspace.account.ownerId === user.id;
    const memberRecord = workspace.members[0];

    if (!isAccountOwner && !memberRecord) {
      throw new ForbiddenException({
        code: 'PERMISSION_DENIED',
        message: 'You are not a member of this workspace.',
      });
    }

    // Attach contextual tenancy metadata to request
    request.workspace = workspace;
    request.workspaceRole = isAccountOwner ? WorkspaceRole.ADMIN : memberRecord.role;
    request.isAccountOwner = isAccountOwner;

    return true;
  }
}
