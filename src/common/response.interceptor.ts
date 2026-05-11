import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

@Injectable()
export class ResponseInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const controllerName = context.getClass().name;
    const res = context.switchToHttp().getResponse();

    return next.handle().pipe(
      map((data) => ({
        responseCode: String(res.statusCode),
        responseMessage: 'Success',
        responseFrom: controllerName,
        responseTime: new Date().toLocaleString(),
        responseData: data||{},
      })),
    );
  }
}
