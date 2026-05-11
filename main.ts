import 'reflect-metadata';
import * as dotenv from 'dotenv';
dotenv.config();

import { NestFactory } from '@nestjs/core';
import { Logger } from '@nestjs/common';

import { AppModule } from './src/app.module';
import { ResponseInterceptor } from './src/common/response.interceptor';
import { GlobalExceptionFilter } from './src/common/http-exception.filter';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    logger: ['log', 'warn', 'error', 'debug'],
  });

  app.useGlobalFilters(new GlobalExceptionFilter());
  app.useGlobalInterceptors(new ResponseInterceptor());

  const port = process.env.PORT || 3000;
  await app.listen(port);

  Logger.log(`Processor Service started at ${port}`, 'Index');
}

bootstrap().catch((err) => {
  Logger.log(`Processor Service stopped with error: ${err.message}`, 'Index');
  console.error('Fatal bootstrap error:', err);
  process.exit(1);
});
