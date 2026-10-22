import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    const requestId =
      request.headers['x-request-id'] || `req_${Date.now()}`;

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let errorCode = 'INTERNAL_SERVER_ERROR';
    let message = 'An unexpected server error occurred.';
    let details: any = undefined;

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const res = exception.getResponse();

      if (typeof res === 'string') {
        message = res;
      } else if (typeof res === 'object' && res !== null) {
        const resObj = res as Record<string, any>;
        message = resObj.message || exception.message;
        // Domain exceptions carry a machine-readable `code` (docs/06 §1.4). The Nest `error` string
        // (e.g. "Not Found") is not part of the contract, so fall back to the catalog default instead.
        errorCode = resObj.code || this.getDefaultErrorCode(status);

        if (Array.isArray(resObj.message)) {
          details = resObj.message;
          message = 'Validation failed for incoming payload.';
          errorCode = 'VALIDATION_FAILED';
        } else if (resObj.details) {
          details = resObj.details;
        }
      }
    } else {
      this.logger.error(
        `Unhandled exception on ${request.method} ${request.url}`,
        exception instanceof Error ? exception.stack : String(exception),
      );
    }

    response.status(status).json({
      success: false,
      error: {
        code: errorCode,
        message,
        ...(details ? { details } : {}),
      },
      meta: {
        requestId: String(requestId),
        timestamp: new Date().toISOString(),
      },
    });
  }

  private getDefaultErrorCode(status: number): string {
    switch (status) {
      case HttpStatus.BAD_REQUEST:
        return 'BAD_REQUEST';
      case HttpStatus.UNAUTHORIZED:
        return 'AUTHENTICATION_REQUIRED';
      case HttpStatus.FORBIDDEN:
        return 'PERMISSION_DENIED';
      case HttpStatus.NOT_FOUND:
        return 'RESOURCE_NOT_FOUND';
      case HttpStatus.CONFLICT:
        return 'CONFLICT_STATE';
      case HttpStatus.UNPROCESSABLE_ENTITY:
        return 'UNPROCESSABLE_ENTITY';
      case HttpStatus.TOO_MANY_REQUESTS:
        return 'RATE_LIMIT_EXCEEDED';
      default:
        return 'INTERNAL_SERVER_ERROR';
    }
  }
}
