import { readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import type { PGlite } from '@electric-sql/pglite';

const migrationsDir = fileURLToPath(new URL('../../src/db/migrations', import.meta.url));

/**
 * Applies every generated migration in order. New stages add migrations, so the
 * tests must not hard-code the initial filename.
 */
export async function applyMigrations(pg: PGlite): Promise<void> {
  const files = readdirSync(migrationsDir)
    .filter((file) => file.endsWith('.sql'))
    .sort();

  for (const file of files) {
    const migrationSql = readFileSync(`${migrationsDir}/${file}`, 'utf8');
    const statements = migrationSql
      .split('--> statement-breakpoint')
      .map((statement) => statement.trim())
      .filter(Boolean);

    for (const statement of statements) {
      await pg.exec(statement);
    }
  }
}
