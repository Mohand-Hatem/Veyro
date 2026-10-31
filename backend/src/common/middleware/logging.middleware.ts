import { Injectable, NestMiddleware, Logger } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';

// A caller may pass its own id to follow one request across services; anything else is replaced so it cannot pollute the logs.
const SAFE_ID = /^[\w-]{1,64}$/;

@Injectable()
export class LoggingMiddleware implements NestMiddleware {
  private readonly logger = new Logger('HTTP');

  use(req: Request, res: Response, next: NextFunction): void {
    const startTime = Date.now();
    const given = req.headers['x-request-id'];
    const requestId = typeof given === 'string' && SAFE_ID.test(given) ? given : `req_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    req.headers['x-request-id'] = requestId;
    res.setHeader('x-request-id', requestId);

    res.on('finish', () => {
      const entry = {
        requestId,
        method: req.method,
        // The path only: query strings can carry one-time codes (the OAuth callback's `code`), which never belong in logs.
        path: req.originalUrl.split('?')[0],
        status: res.statusCode,
        ms: Date.now() - startTime,
        userId: (req.user as { id?: string } | undefined)?.id,
      };
      if (res.statusCode >= 500) this.logger.error(entry);
      else this.logger.log(entry);
    });

    next();
  }
}
