import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { Logger, ValidationPipe } from '@nestjs/common';
import { setupSwagger } from './config/swagger.config';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.enableShutdownHooks();

  app.useGlobalPipes(
    new ValidationPipe({
      transform: true,
      whitelist: true,
      forbidNonWhitelisted: true,
    }),
  );

  setupSwagger(app);

  const port = Number(process.env.BACKEND_PORT ?? 3000);

  await app.listen(port);

  const logger = new Logger('Bootstrap');

  logger.log('Application successfully started');
  logger.log(`API:      http://localhost:${port}`);
  logger.log(`Swagger:  http://localhost:${port}/api/docs`);
}
void bootstrap();
