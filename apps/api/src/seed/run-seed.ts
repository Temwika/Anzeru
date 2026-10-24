import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../app.module';
import { DB, DB_TOKEN } from '../db/database';
import { tenants } from '../db/schema';
import { seedDemo } from './seed';

/** Seeds the demo institution into an empty database: `npm run seed`. */
async function main() {
  const app = await NestFactory.createApplicationContext(AppModule, { logger: ['log', 'error', 'warn'] });
  const db = app.get<DB>(DB_TOKEN);
  const [existing] = await db.select({ id: tenants.id }).from(tenants).limit(1);
  if (existing) console.log('Database already has data; nothing seeded.');
  else await seedDemo(app);
  await app.close();
}

void main();
