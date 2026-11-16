import { PGlite } from '@electric-sql/pglite';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { applyMigrations } from './support/migrate.js';

/**
 * Neon is not available in CI, so every migration is executed against PGlite
 * (PostgreSQL compiled to WASM). This catches SQL errors, bad enum values,
 * missing indexes and broken check constraints before deployment.
 */
let pg: PGlite;

beforeAll(async () => {
  pg = new PGlite();
  await applyMigrations(pg);
}, 120_000);

afterAll(async () => {
  await pg.close();
});

describe('initial migration', () => {
  it('creates every table', async () => {
    const { rows } = await pg.query<{ tablename: string }>(
      "select tablename from pg_tables where schemaname = 'public' order by tablename",
    );

    expect(rows.map((row) => row.tablename)).toEqual([
      'approval_records',
      'audit_logs',
      'categories',
      'events',
      'notifications',
      'quotations',
      'refresh_tokens',
      'request_vendors',
      'reviews',
      'service_requests',
      'societies',
      'users',
      'vendor_categories',
      'vendors',
    ]);
  });

  it('creates every enum type', async () => {
    const { rows } = await pg.query<{ typname: string }>(
      "select typname from pg_type where typtype = 'e' order by typname",
    );

    expect(rows.map((row) => row.typname)).toEqual([
      'account_status',
      'distribution_status',
      'notification_type',
      'quotation_status',
      'request_status',
      'user_role',
      'vendor_status',
    ]);
  });

  it('generates UUID primary keys by default', async () => {
    const { rows } = await pg.query<{ id: string }>(
      `insert into users (name, email, password_hash, role)
       values ('Test User', 'uuid@example.com', 'hash', 'society')
       returning id`,
    );

    expect(rows[0]?.id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/);
  });

  it('rejects duplicate emails and unknown roles', async () => {
    await expect(
      pg.exec(
        `insert into users (name, email, password_hash, role)
         values ('Duplicate', 'uuid@example.com', 'hash', 'society')`,
      ),
    ).rejects.toThrow();

    await expect(
      pg.exec(
        `insert into users (name, email, password_hash, role)
         values ('Bad Role', 'bad-role@example.com', 'hash', 'superadmin')`,
      ),
    ).rejects.toThrow();
  });

  it('supports the ON CONFLICT (user_id) pattern used by the seed', async () => {
    const { rows } = await pg.query<{ id: string }>(
      "select id from users where email = 'uuid@example.com'",
    );
    const userId = rows[0]?.id;
    expect(userId).toBeTruthy();

    const insertSociety = `insert into societies (user_id, name, institution, contact_person)
      values ('${userId}', 'Test Society', 'Test University', 'Test User')
      on conflict (user_id) do nothing`;

    await pg.exec(insertSociety);
    await pg.exec(insertSociety);

    const { rows: societies } = await pg.query<{ count: number }>(
      'select count(*)::int as count from societies',
    );
    expect(societies[0]?.count).toBe(1);
  });

  it('enforces the review rating check constraint', async () => {
    const { rows: societyRows } = await pg.query<{ id: string }>(
      'select id from societies limit 1',
    );
    const { rows: categoryRows } = await pg.query<{ id: string }>(
      `insert into categories (name, slug) values ('Catering', 'catering') returning id`,
    );
    const { rows: vendorUserRows } = await pg.query<{ id: string }>(
      `insert into users (name, email, password_hash, role)
       values ('Vendor User', 'vendor-check@example.com', 'hash', 'vendor') returning id`,
    );
    const { rows: vendorRows } = await pg.query<{ id: string }>(
      `insert into vendors (user_id, business_name, description, city)
       values ('${vendorUserRows[0]?.id}', 'Vendor', 'Description long enough to pass.', 'Karachi')
       returning id`,
    );
    const { rows: eventRows } = await pg.query<{ id: string }>(
      `insert into events (society_id, name, event_date, location)
       values ('${societyRows[0]?.id}', 'Event', '2026-12-01', 'Karachi') returning id`,
    );
    const { rows: requestRows } = await pg.query<{ id: string }>(
      `insert into service_requests (reference, society_id, event_id, category_id, title, description, status)
       values ('EB-R-TEST01', '${societyRows[0]?.id}', '${eventRows[0]?.id}', '${categoryRows[0]?.id}',
               'Catering request', 'Description', 'open')
       returning id`,
    );

    await expect(
      pg.exec(
        `insert into reviews (society_id, vendor_id, request_id, rating)
         values ('${societyRows[0]?.id}', '${vendorRows[0]?.id}', '${requestRows[0]?.id}', 6)`,
      ),
    ).rejects.toThrow();

    await pg.exec(
      `insert into reviews (society_id, vendor_id, request_id, rating)
       values ('${societyRows[0]?.id}', '${vendorRows[0]?.id}', '${requestRows[0]?.id}', 5)`,
    );

    const { rows: reviewRows } = await pg.query<{ count: number }>(
      'select count(*)::int as count from reviews',
    );
    expect(reviewRows[0]?.count).toBe(1);
  });
});
