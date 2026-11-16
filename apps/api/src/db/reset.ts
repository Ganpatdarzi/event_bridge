import { pool, closePool } from './pool.js';
import { runMigrations } from './migrate.js';
import { seed } from './seed.js';
import { logger } from '../config/logger.js';
import { isProduction } from '../config/env.js';

async function reset(): Promise<void> {
  if (isProduction) {
    throw new Error('Refusing to reset a production database');
  }

  logger.warn('Dropping public and drizzle schemas, then re-running migrations and seed');
  await pool.query('DROP SCHEMA IF EXISTS public CASCADE');
  await pool.query('DROP SCHEMA IF EXISTS drizzle CASCADE');
  await pool.query('CREATE SCHEMA public');

  await runMigrations();
  await seed();
  logger.info('Database reset complete');
}

reset()
  .then(() => closePool())
  .then(() => process.exit(0))
  .catch(async (error: unknown) => {
    logger.error({ err: error }, 'Database reset failed');
    await closePool();
    process.exit(1);
  });
