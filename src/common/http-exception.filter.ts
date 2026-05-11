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
export class GlobalExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(GlobalExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx      = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request  = ctx.getRequest<Request>();

    const status = exception instanceof HttpException
      ? exception.getStatus()
      : HttpStatus.INTERNAL_SERVER_ERROR;

    const detail = exception instanceof HttpException
      ? exception.message
      : (exception instanceof Error ? exception.message : 'Unexpected error');

    this.logger.error(`${request.method} ${request.url} → ${status}: ${detail}`);

    response.status(status).json({
      responseCode: String(status),
      responseMessage: `Something went wrong: ${detail}`,
      responseFrom: request.path,
      responseTime: new Date().toLocaleString(),
      responseData: null,
    });
  }
}
