import { NestFactory } from '@nestjs/core';
import { ValidationPipe, Logger } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { ConfigService } from '@nestjs/config';
import { AppModule } from './app.module';
import { config as dotenvConfig } from 'dotenv';
import { join } from 'path';

async function bootstrap() {
  const env = process.env.NODE_ENV || 'development';
  if (env === 'staging') {
    dotenvConfig({ path: join(process.cwd(), 'api', '.env.staging'), override: true });
    dotenvConfig({ path: join(process.cwd(), '.env.staging'), override: true });
  } else if (env === 'production') {
    // In production (Railway), environment variables are injected by the platform
    // so we skip loading .env files.
  } else {
    dotenvConfig({ path: join(process.cwd(), 'api', '.env'), override: true });
    dotenvConfig({ path: join(process.cwd(), '.env'), override: true });
  }
  const app = await NestFactory.create(AppModule);
  const configService = app.get(ConfigService);
  const logger = new Logger('Bootstrap');

  // Global validation pipe
  app.useGlobalPipes(new ValidationPipe({
    transform: true,
    whitelist: true,
    forbidNonWhitelisted: true,
  }));

  // CORS configuration
  app.enableCors({
    origin: true, // Allow all origins in development
    credentials: true,
  });

  // Swagger documentation
  const config = new DocumentBuilder()
    .setTitle('Video Processing API')
    .setDescription('API for processing videos with Submagic integration')
    .setVersion('1.0')
    .addTag('Health', 'Health check endpoints')
    .addTag('Submagic', 'Single video processing endpoints')
    .addTag('Batch Processing', 'Batch video processing endpoints')
    .addTag('Webhooks', 'Webhook handling endpoints')
    .addTag('Projects', 'Project status and completion endpoints')
    .addTag('OpenAI', 'AI-powered media matching endpoints')
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('swagger', app, document, {
    swaggerOptions: {
      persistAuthorization: true,
    },
  });

  const port = configService.get<number>('PORT', 3000);
  console.log('PORT:', port)
  await app.listen(port);

  console.log("PUBLIC_BASE_URL: ", process.env.PUBLIC_BASE_URL);

  logger.log(`🚀 Application is running on: http://localhost:${port}`);
  logger.log(`📚 Swagger documentation: http://localhost:${port}/swagger`);
}

bootstrap().catch((error) => {
  console.error('Failed to start application:', error);
  process.exit(1);
});
