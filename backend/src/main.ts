import { NestFactory } from '@nestjs/core';
import { ValidationPipe, Logger } from '@nestjs/common';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import { AppModule } from './app.module';
import { TransformInterceptor } from './common/interceptors/transform.interceptor';
import { AllExceptionsFilter } from './common/filters/http-exception.filter';

async function bootstrap() {
  const logger = new Logger('Bootstrap');
  const app = await NestFactory.create(AppModule);

  // Security headers & cookie parsing
  app.use(helmet());
  app.use(cookieParser());

  // Enable CORS
  app.enableCors({
    origin: process.env.APP_URL || 'http://localhost:3000',
    credentials: true,
  });

  // Global API prefix
  app.setGlobalPrefix('api/v1');

  // Global validation pipe
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );

  // Global response & error envelopes
  app.useGlobalInterceptors(new TransformInterceptor());
  app.useGlobalFilters(new AllExceptionsFilter());

  const port = process.env.PORT || 5000;
  const server = await app.listen(port);
  // Node closes idle connections after 5s by default, while the Next.js proxy reuses them for longer: the race shows up as ECONNRESET and a 500. Stay open longer than any proxy or load balancer in front.
  server.keepAliveTimeout = 65_000;
  server.headersTimeout = 66_000;
  logger.log(`Veyro Modular Monolith API running on http://localhost:${port}/api/v1`);
}

bootstrap();
