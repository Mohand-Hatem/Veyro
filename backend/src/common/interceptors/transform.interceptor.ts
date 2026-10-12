import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

export interface ResponseEnvelope<T> {
  success: boolean;
  data: T;
  meta: {
    requestId: string;
    timestamp: string;
  };
}

@Injectable()
export class TransformInterceptor<T>
  implements NestInterceptor<T, ResponseEnvelope<T>>
{
  intercept(
    context: ExecutionContext,
    next: CallHandler,
  ): Observable<ResponseEnvelope<T>> {
    const request = context.switchToHttp().getRequest();
    const requestId = request.headers['x-request-id'] || `req_${Date.now()}`;

    return next.handle().pipe(
      map((data) => ({
        success: true,
        data: data ?? {},
        meta: {
          requestId: String(requestId),
          timestamp: new Date().toISOString(),
        },
      })),
    );
  }
}
