import { Global, Inject, Logger, Module, OnApplicationShutdown } from '@nestjs/common';
import { mkdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { PGlite } from '@electric-sql/pglite';
import { drizzle as drizzlePg, type NodePgDatabase } from 'drizzle-orm/node-postgres';
import { migrate as migratePg } from 'drizzle-orm/node-postgres/migrator';
import { drizzle as drizzlePglite } from 'drizzle-orm/pglite';
import { migrate as migratePglite } from 'drizzle-orm/pglite/migrator';
import { Pool } from 'pg';
import * as schema from './schema';

export type DB = NodePgDatabase<typeof schema>;
export type Tx = Parameters<Parameters<DB['transaction']>[0]>[0];
/** Either the root database handle or an open transaction. */
export type Executor = DB | Tx;

export const DB_TOKEN = Symbol('DB');
export const InjectDb = () => Inject(DB_TOKEN);

const MIGRATIONS = resolve(__dirname, '../../drizzle');
const logger = new Logger('Database');

interface Connection {
  db: DB;
  driver: 'postgres' | 'pglite';
  close: () => Promise<void>;
}

/**
 * Connects to PostgreSQL when DATABASE_URL is set. Otherwise starts an embedded
 * PGlite (real PostgreSQL compiled to WASM) so the platform runs locally with
 * no database install. `memory://` gives a throwaway database for tests.
 */
export async function connect(url = process.env.DATABASE_URL): Promise<Connection> {
  if (url && /^postgres(ql)?:\/\//.test(url)) {
    const pool = new Pool({ connectionString: url, max: 10 });
    const db = drizzlePg(pool, { schema });
    await migratePg(db, { migrationsFolder: MIGRATIONS });
    logger.log('Connected to PostgreSQL');
    return { db, driver: 'postgres', close: () => pool.end() };
  }

  let dataDir: string | undefined;
  if (url !== 'memory://') {
    dataDir = resolve(process.env.PGLITE_DIR ?? join(process.cwd(), '.data', 'pglite'));
    mkdirSync(dataDir, { recursive: true });
  }
  const client = new PGlite(dataDir);
  const db = drizzlePglite({ client, schema });
  await migratePglite(db, { migrationsFolder: MIGRATIONS });
  logger.log(`Using embedded PGlite ${dataDir ? `at ${dataDir}` : '(in memory)'} — set DATABASE_URL for PostgreSQL`);
  return { db: db as unknown as DB, driver: 'pglite', close: () => client.close() };
}

@Global()
@Module({
  providers: [
    {
      provide: 'DB_CONNECTION',
      useFactory: () => connect(),
    },
    {
      provide: DB_TOKEN,
      inject: ['DB_CONNECTION'],
      useFactory: (c: Connection) => c.db,
    },
  ],
  exports: [DB_TOKEN, 'DB_CONNECTION'],
})
export class DatabaseModule implements OnApplicationShutdown {
  constructor(@Inject('DB_CONNECTION') private readonly connection: Connection) {}

  async onApplicationShutdown() {
    await this.connection.close();
  }
}
