import type { PGlite } from '@electric-sql/pglite';
import request from 'supertest';
import { afterAll, describe, expect, it, vi } from 'vitest';

/** Security-focused API tests for the mandatory SRS cases TC-005/006/007/008/014. */
const state = vi.hoisted(() => ({
  pg: null as unknown,
}));

vi.mock('../src/db/index.js', async () => {
  const [{ PGlite }, { drizzle }, schemaModule, { applyMigrations }] = await Promise.all([
    import('@electric-sql/pglite'),
    import('drizzle-orm/pglite'),
    import('../src/db/schema/index.js'),
    import('./support/migrate.js'),
  ]);

  const pg = new PGlite();
  await applyMigrations(pg);

  const db = drizzle(pg, { schema: schemaModule });
  state.pg = pg;

  return { db, schema: schemaModule };
});

const pg = (): PGlite => state.pg as PGlite;

const { createApp } = await import('../src/app.js');

const app = createApp();

const fakeId = '00000000-0000-4000-8000-000000000000';

const adminCandidate = {
  role: 'society' as const,
  name: 'Security Admin',
  email: 'security.admin@example.com',
  password: 'Society123!',
  society: {
    societyName: 'Security Admin Society',
    institution: 'Security Test University',
    contactPerson: 'Security Admin',
  },
};

const societyA = {
  role: 'society' as const,
  name: 'Society A',
  email: 'security.society-a@example.com',
  password: 'Society123!',
  society: {
    societyName: 'Society A',
    institution: 'Security Test University',
    contactPerson: 'Society A',
  },
};

const societyB = {
  role: 'society' as const,
  name: 'Society B',
  email: 'security.society-b@example.com',
  password: 'Society123!',
  society: {
    societyName: 'Society B',
    institution: 'Security Test University',
    contactPerson: 'Society B',
  },
};

function vendor(email: string, businessName: string) {
  return {
    role: 'vendor' as const,
    name: businessName,
    email,
    password: 'Vendor123!',
    vendor: {
      businessName,
      description: 'A sufficiently detailed description of the event service business.',
      city: 'Karachi',
      serviceArea: 'Karachi',
      contactPerson: businessName,
    },
  };
}

const vendorA = vendor('security.vendor-a@example.com', 'Vendor A Catering');
const vendorB = vendor('security.vendor-b@example.com', 'Vendor B Catering');

async function login(email: string, password: string): Promise<string> {
  const response = await request(app)
    .post('/api/v1/auth/login')
    .send({ email, password })
    .expect(200);
  return response.body.data.accessToken as string;
}

async function verifyVendor(email: string): Promise<void> {
  await pg().query(
    `update vendors set verification_status = 'verified', verified_at = now()
     where user_id = (select id from users where email = $1)`,
    [email],
  );
}

describe('mandatory security test cases', () => {
  let categoryId = '';
  let requestId = '';
  let adminToken = '';
  let societyAToken = '';
  let societyBToken = '';
  let vendorAToken = '';
  let vendorBToken = '';
  let vendorBQuotationId = '';

  afterAll(async () => {
    await pg().close();
  });

  it('sets up admin, societies and two verified vendors in one category', async () => {
    const category = await pg().query<{ id: string }>(
      `insert into categories (name, slug, description)
       values ('Security Catering', 'security-catering', 'Catering for security tests')
       returning id`,
    );
    categoryId = category.rows[0]?.id ?? '';

    for (const payload of [adminCandidate, societyA, societyB, vendorA, vendorB]) {
      await request(app)
        .post('/api/v1/auth/register')
        .send(
          'vendor' in payload
            ? { ...payload, vendor: { ...payload.vendor, categoryIds: [categoryId] } }
            : payload,
        )
        .expect(201);
    }

    await pg().query(`update users set role = 'admin' where email = $1`, [adminCandidate.email]);
    await verifyVendor(vendorA.email);
    await verifyVendor(vendorB.email);

    adminToken = await login(adminCandidate.email, adminCandidate.password);
    societyAToken = await login(societyA.email, societyA.password);
    societyBToken = await login(societyB.email, societyB.password);
    vendorAToken = await login(vendorA.email, vendorA.password);
    vendorBToken = await login(vendorB.email, vendorB.password);

    expect(categoryId).not.toBe('');
  });

  it('publishes a request that invites both vendors', async () => {
    const eventDate = new Date(Date.now() + 30 * 86_400_000).toISOString().slice(0, 10);
    const responseDeadline = new Date(Date.now() + 10 * 86_400_000).toISOString();

    const response = await request(app)
      .post('/api/v1/requests')
      .set('Authorization', `Bearer ${societyAToken}`)
      .send({
        event: {
          name: 'Security Test Gala',
          eventDate,
          location: 'Karachi Expo Centre',
          expectedAttendance: 200,
        },
        categoryId,
        title: 'Catering for security test gala',
        description: 'We need full catering for 200 guests including dinner and refreshments.',
        budgetMin: 50_000,
        budgetMax: 150_000,
        quantity: 200,
        responseDeadline,
        submit: true,
      })
      .expect(201);

    requestId = response.body.data.id as string;
    expect(response.body.data.counts.invitedVendors).toBe(2);
  });

  it('TC-005: rejects a negative quotation price', async () => {
    const response = await request(app)
      .post(`/api/v1/requests/${requestId}/quotations`)
      .set('Authorization', `Bearer ${vendorAToken}`)
      .send({ totalPrice: -1, description: 'Catering for the full event.' })
      .expect(400);

    expect(response.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('TC-007: does not let another society read the request by id', async () => {
    const response = await request(app)
      .get(`/api/v1/requests/${requestId}`)
      .set('Authorization', `Bearer ${societyBToken}`)
      .expect(404);

    expect(response.body.error.code).toBe('NOT_FOUND');
  });

  it('lets both invited vendors submit quotations', async () => {
    const payload = {
      totalPrice: 80_000,
      description: 'Full catering service for the gala.',
      additionalCharges: 2_500,
    };

    await request(app)
      .post(`/api/v1/requests/${requestId}/quotations`)
      .set('Authorization', `Bearer ${vendorAToken}`)
      .send({ ...payload, totalPrice: 75_000 })
      .expect(201);

    const response = await request(app)
      .post(`/api/v1/requests/${requestId}/quotations`)
      .set('Authorization', `Bearer ${vendorBToken}`)
      .send(payload)
      .expect(201);

    vendorBQuotationId = response.body.data.id as string;
    expect(vendorBQuotationId).not.toBe('');
  });

  it('TC-008: vendors cannot read another vendor’s quotation', async () => {
    const list = await request(app)
      .get(`/api/v1/requests/${requestId}/quotations`)
      .set('Authorization', `Bearer ${vendorAToken}`)
      .expect(403);
    expect(list.body.error.code).toBe('FORBIDDEN');

    const compare = await request(app)
      .get(`/api/v1/requests/${requestId}/compare`)
      .set('Authorization', `Bearer ${vendorAToken}`)
      .expect(403);
    expect(compare.body.error.code).toBe('FORBIDDEN');

    const mine = await request(app)
      .get(`/api/v1/requests/${requestId}/quotations/mine`)
      .set('Authorization', `Bearer ${vendorAToken}`)
      .expect(200);

    expect(mine.body.data.id).not.toBe(vendorBQuotationId);
    expect(JSON.stringify(mine.body.data)).not.toContain(vendorBQuotationId);
  });

  it('TC-006: rejects a quotation on a closed request', async () => {
    await request(app)
      .post(`/api/v1/requests/${requestId}/close`)
      .set('Authorization', `Bearer ${societyAToken}`)
      .send({ reason: 'Security test closure' })
      .expect(200);

    const response = await request(app)
      .post(`/api/v1/requests/${requestId}/quotations`)
      .set('Authorization', `Bearer ${vendorAToken}`)
      .send({ totalPrice: 90_000, description: 'An attempted late quotation.' })
      .expect(409);

    expect(response.body.error.code).toBe('CONFLICT');
  });

  it('TC-014: non-admin accounts cannot reach any admin endpoint', async () => {
    const readRoutes = [
      '/admin/stats',
      '/admin/audit-logs',
      '/admin/categories',
      '/admin/vendors',
      '/admin/users',
      '/admin/reviews',
      '/admin/settings',
    ];

    const writeRoutes: Array<[string, string]> = [
      ['post', `/admin/vendors/${fakeId}/approve`],
      ['post', `/admin/vendors/${fakeId}/reject`],
      ['post', `/admin/vendors/${fakeId}/request-changes`],
      ['post', `/admin/vendors/${fakeId}/suspend`],
      ['post', `/admin/vendors/${fakeId}/restore`],
      ['post', `/admin/users/${fakeId}/suspend`],
      ['post', `/admin/users/${fakeId}/reactivate`],
      ['post', `/admin/users/${fakeId}/deactivate`],
      ['post', `/admin/reviews/${fakeId}/hide`],
      ['post', `/admin/reviews/${fakeId}/unhide`],
      ['put', '/admin/settings/security.test'],
    ];

    for (const token of [societyAToken, vendorAToken]) {
      for (const route of readRoutes) {
        const response = await request(app)
          .get(`/api/v1${route}`)
          .set('Authorization', `Bearer ${token}`)
          .expect(403);
        expect(response.body.error.code).toBe('FORBIDDEN');
      }

      for (const [method, route] of writeRoutes) {
        const url = `/api/v1${route}`;
        const call = method === 'post' ? request(app).post(url) : request(app).put(url);
        const response = await call
          .set('Authorization', `Bearer ${token}`)
          .send({ reason: 'Security test', value: 'no' })
          .expect(403);
        expect(response.body.error.code).toBe('FORBIDDEN');
      }
    }

    await request(app)
      .get('/api/v1/admin/stats')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);
  });
});
