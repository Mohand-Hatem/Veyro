import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';

@Injectable()
export class AccountOwnerGuard implements CanActivate {
  constructor(private readonly prisma: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const user = request.user;

    if (!user || !user.id) {
      throw new ForbiddenException('Authentication required.');
    }

    const accountId = request.params?.id || request.params?.accountId || request.body?.accountId;

    if (!accountId) {
      throw new ForbiddenException('Account identifier is missing from request.');
    }

    const account = await this.prisma.account.findUnique({
      where: { id: accountId },
    });

    if (!account) {
      throw new NotFoundException({
        code: 'RESOURCE_NOT_FOUND',
        message: 'The requested account does not exist.',
      });
    }

    if (account.ownerId !== user.id) {
      throw new ForbiddenException({
        code: 'PERMISSION_DENIED',
        message: 'This operation is restricted exclusively to the Account Owner.',
      });
    }

    request.account = account;
    return true;
  }
}
