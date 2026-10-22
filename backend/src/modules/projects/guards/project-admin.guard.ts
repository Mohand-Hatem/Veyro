import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';

@Injectable()
export class ProjectAdminGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();

    if (!request.isProjectAdmin) {
      throw new ForbiddenException({
        code: 'PERMISSION_DENIED',
        message: 'Only project administrators, workspace administrators or the account owner can perform this operation.',
      });
    }

    return true;
  }
}
