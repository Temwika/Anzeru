import { Controller, Get, Inject } from '@nestjs/common';
import { sql } from 'drizzle-orm';
import { Public } from './common/auth';
import { DB, InjectDb } from './db/database';

@Controller('health')
export class HealthController {
  constructor(
    @InjectDb() private readonly db: DB,
    @Inject('DB_CONNECTION') private readonly connection: { driver: string },
  ) {}

  @Public()
  @Get()
  async check() {
    await this.db.execute(sql`select 1`);
    return { status: 'ok', database: this.connection.driver, time: new Date().toISOString() };
  }
}
