import { Pool } from 'pg';
import { env, isProduction } from '../config/env.js';

const needsSsl =
  env.DATABASE_URL.includes('sslmode=require') || env.DATABASE_URL.includes('neon.tech');

export const pool = new Pool({
  connectionString: env.DATABASE_URL,
  max: isProduction ? 10 : 5,
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 10_000,
  ...(needsSsl ? { ssl: { rejectUnauthorized: true } } : {}),
});

pool.on('error', (error) => {
  // Idle client errors must not crash the process.
  console.error('Unexpected PostgreSQL pool error', error);
});

export async function closePool(): Promise<void> {
  await pool.end();
}
