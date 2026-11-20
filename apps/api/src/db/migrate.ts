import { fileURLToPath, pathToFileURL } from 'node:url';
import { Pool } from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { env } from '../config/env.js';
import { logger } from '../config/logger.js';

/**
 * Migrations run against the direct (non-pooled) connection. Pooled
 * connections are for the application runtime only.
 */
export async function runMigrations(): Promise<void> {
  // Use `||` so an empty DIRECT_URL cannot produce a bogus connection string.
  const connectionString = env.DIRECT_URL || env.DATABASE_URL;
  const needsSsl =
    connectionString.includes('sslmode=require') || connectionString.includes('neon.tech');

  const migrationPool = new Pool({
    connectionString,
    max: 1,
    ...(needsSsl ? { ssl: { rejectUnauthorized: true } } : {}),
  });

  try {
    const migrationsFolder = fileURLToPath(new URL('./migrations', import.meta.url));
    logger.info({ migrationsFolder }, 'Applying database migrations');
    await migrate(drizzle(migrationPool), { migrationsFolder });
    logger.info('Migrations applied');
  } finally {
    await migrationPool.end();
  }
}

const invokedDirectly =
  process.argv[1] !== undefined && pathToFileURL(process.argv[1]).href === import.meta.url;

if (invokedDirectly) {
  runMigrations()
    .then(() => process.exit(0))
    .catch((error: unknown) => {
      logger.error({ err: error }, 'Migration failed');
      process.exit(1);
    });
}
