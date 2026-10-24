import 'reflect-metadata';
import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import cookieParser from 'cookie-parser';
import { AppModule } from './app.module';
import { DB, DB_TOKEN } from './db/database';
import { tenants } from './db/schema';
import { seedDemo } from './seed/seed';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, { rawBody: true });
  app.setGlobalPrefix('api/v1', { exclude: ['health'] });
  app.use(cookieParser());
  app.disable('x-powered-by');
  app.enableShutdownHooks();
  app.set('trust proxy', 'loopback');

  const docs = new DocumentBuilder()
    .setTitle('Chilimbitso Lending API')
    .setDescription('Multi-tenant loan management API. All endpoints require a session cookie or bearer token unless marked public.')
    .setVersion('1.0')
    .addCookieAuth('anz_session')
    .build();
  SwaggerModule.setup('api/docs', app, SwaggerModule.createDocument(app, docs));

  const db = app.get<DB>(DB_TOKEN);
  if (process.env.SEED_DEMO !== 'false') {
    const [existing] = await db.select({ id: tenants.id }).from(tenants).limit(1);
    if (!existing) await seedDemo(app);
  }

  const port = Number(process.env.PORT ?? 4000);
  await app.listen(port);
  Logger.log(`API ready on http://localhost:${port}/api/v1 — docs at /api/docs`, 'Bootstrap');
}

void bootstrap();
