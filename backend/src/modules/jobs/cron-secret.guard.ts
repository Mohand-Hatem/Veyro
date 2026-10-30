import { CanActivate, ExecutionContext, Injectable, ServiceUnavailableException, UnauthorizedException } from '@nestjs/common';
import * as crypto from 'crypto';
import type { Request } from 'express';

const MIN_SECRET_LENGTH = 16;
const digest = (v: string) => crypto.createHash('sha256').update(v).digest();

/**
 * Protects the scheduled-jobs endpoint, which has no user. Vercel Cron sends `Authorization: Bearer <CRON_SECRET>` when the project
 * has that variable. Without a configured secret the endpoint is closed to everyone, never open.
 */
@Injectable()
export class CronSecretGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const secret = process.env.CRON_SECRET;
    if (!secret || secret.length < MIN_SECRET_LENGTH) {
      throw new ServiceUnavailableException({ code: 'CRON_NOT_CONFIGURED', message: 'Scheduled jobs are not configured.' });
    }
    const header = context.switchToHttp().getRequest<Request>().headers.authorization ?? '';
    // Comparing digests keeps the check constant-time whatever the length of what was sent.
    if (!crypto.timingSafeEqual(digest(header), digest(`Bearer ${secret}`))) {
      throw new UnauthorizedException({ code: 'INVALID_CRON_SECRET', message: 'Not allowed.' });
    }
    return true;
  }
}
