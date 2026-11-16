import 'dotenv/config';
import { defineConfig } from 'drizzle-kit';

const url = process.env.DIRECT_URL ?? process.env.DATABASE_URL;

if (!url) {
  throw new Error(
    'Set DATABASE_URL (and preferably DIRECT_URL) in apps/api/.env before running drizzle-kit.',
  );
}

export default defineConfig({
  dialect: 'postgresql',
  schema: './src/db/schema/index.ts',
  out: './src/db/migrations',
  dbCredentials: { url },
  strict: true,
  verbose: true,
});
