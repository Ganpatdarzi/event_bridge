import type { PGlite } from '@electric-sql/pglite';
import request from 'supertest';
import { afterAll, describe, expect, it, vi } from 'vitest';

/**
 * End-to-end coverage for the quotation/notification flow. The API modules use
 * the Drizzle instance exported by `db/index.ts`, so we swap it for PGlite with
 * the real migrations applied and exercise the real Express handlers.
 */
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

const societyPayload = {
  role: 'society' as const,
  name: 'Hira Malik',
  email: 'quotes.society@example.com',
  password: 'Society123!',
  society: {
    societyName: 'Quote Flow Society',
    institution: 'Quote Flow University',
    contactPerson: 'Hira Malik',
  },
};

const vendorPayload = {
  role: 'vendor' as const,
  name: 'Bilal Ahmed',
  email: 'quotes.vendor@example.com',
  password: 'Vendor123!',
  vendor: {
    businessName: 'Bilal Catering',
    description: 'Full-service catering for university events and formal dinners.',
    city: 'Karachi',
    serviceArea: 'Karachi',
    contactPerson: 'Bilal Ahmed',
    contactPhone: '03001234567',
  },
};

const outsiderPayload = {
  role: 'vendor' as const,
  name: 'Sana Iqbal',
  email: 'quotes.outsider@example.com',
  password: 'Vendor123!',
  vendor: {
    businessName: 'Lahore Event Co',
    description: 'Event services based in Lahore for conferences and dinners.',
    city: 'Lahore',
    serviceArea: 'Lahore',
  },
};

async function verifyVendor(email: string): Promise<void> {
  await pg().query(
    `update vendors set verification_status = 'verified', verified_at = now()
     where user_id = (select id from users where email = $1)`,
    [email],
  );
}

async function login(email: string, password: string): Promise<string> {
  const response = await request(app)
    .post('/api/v1/auth/login')
    .send({ email, password })
    .expect(200);
  return response.body.data.accessToken as string;
}

describe('quotation and notification flow', () => {
  let categoryId = '';
  let requestId = '';
  let societyToken = '';
  let vendorToken = '';
  let outsiderToken = '';
  let notificationId = '';

  afterAll(async () => {
    await pg().close();
  });

  it('sets up a category, accounts, and a verified vendor', async () => {
    const { rows } = await pg().query<{ id: string }>(
      `insert into categories (name, slug, description)
       values ('Catering', 'catering-quote-test', 'Food and beverage')
       returning id`,
    );
    categoryId = rows[0]?.id ?? '';

    await request(app).post('/api/v1/auth/register').send(societyPayload).expect(201);
    await request(app)
      .post('/api/v1/auth/register')
      .send({ ...vendorPayload, vendor: { ...vendorPayload.vendor, categoryIds: [categoryId] } })
      .expect(201);
    await request(app)
      .post('/api/v1/auth/register')
      .send({
        ...outsiderPayload,
        vendor: { ...outsiderPayload.vendor, categoryIds: [categoryId] },
      })
      .expect(201);

    await verifyVendor(vendorPayload.email);
    await verifyVendor(outsiderPayload.email);

    societyToken = await login(societyPayload.email, societyPayload.password);
    vendorToken = await login(vendorPayload.email, vendorPayload.password);
    outsiderToken = await login(outsiderPayload.email, outsiderPayload.password);

    expect(categoryId).not.toBe('');
  });

  it('publishes a request and invites only the matching vendor', async () => {
    const eventDate = new Date(Date.now() + 30 * 86_400_000).toISOString().slice(0, 10);
    const responseDeadline = new Date(Date.now() + 10 * 86_400_000).toISOString();

    const response = await request(app)
      .post('/api/v1/requests')
      .set('Authorization', `Bearer ${societyToken}`)
      .send({
        event: {
          name: 'Quote Flow Gala',
          eventDate,
          location: 'Karachi Expo Centre',
          expectedAttendance: 250,
        },
        categoryId,
        title: 'Catering for quote flow gala',
        description: 'We need full catering for 250 guests including dinner and refreshments.',
        budgetMin: 50_000,
        budgetMax: 150_000,
        quantity: 250,
        responseDeadline,
        submit: true,
      })
      .expect(201);

    requestId = response.body.data.id as string;

    expect(response.body.data.status).toBe('open');
    expect(response.body.data.counts.invitedVendors).toBe(1);

    const board = await request(app)
      .get('/api/v1/vendor/requests')
      .set('Authorization', `Bearer ${vendorToken}`)
      .expect(200);

    expect(board.body.data.items).toHaveLength(1);
    expect(board.body.data.items[0].id).toBe(requestId);
    expect(board.body.data.items[0].hasQuoted).toBe(false);
  });

  it('returns null for the vendor before they have quoted', async () => {
    const response = await request(app)
      .get(`/api/v1/requests/${requestId}/quotations/mine`)
      .set('Authorization', `Bearer ${vendorToken}`)
      .expect(200);

    expect(response.body.data).toBeNull();
  });

  it('lets the invited vendor submit a quotation', async () => {
    const response = await request(app)
      .post(`/api/v1/requests/${requestId}/quotations`)
      .set('Authorization', `Bearer ${vendorToken}`)
      .send({
        totalPrice: 87_500,
        description: 'Dinner buffet for 250 guests with service staff and crockery.',
        inclusions: 'Main course, dessert, soft drinks, serving staff',
        exclusions: 'Live cooking stations',
        additionalCharges: 2_500,
        availableOnDate: true,
        notes: 'Setup can start two hours before the event.',
      })
      .expect(201);

    expect(response.body.data.status).toBe('submitted');
    expect(response.body.data.totalPrice).toBe(87_500);
    expect(response.body.data.vendor.businessName).toBe(vendorPayload.vendor.businessName);

    const mine = await request(app)
      .get(`/api/v1/requests/${requestId}/quotations/mine`)
      .set('Authorization', `Bearer ${vendorToken}`)
      .expect(200);

    expect(mine.body.data.reference).toBe(response.body.data.reference);
  });

  it('moves the request to partially_quoted and notifies the society', async () => {
    const requests = await request(app)
      .get('/api/v1/requests')
      .set('Authorization', `Bearer ${societyToken}`)
      .expect(200);

    const published = requests.body.data.items.find(
      (item: { id: string }) => item.id === requestId,
    );

    expect(published?.status).toBe('partially_quoted');
    expect(published?.quotationCount).toBe(1);

    const notifications = await request(app)
      .get('/api/v1/notifications')
      .set('Authorization', `Bearer ${societyToken}`)
      .expect(200);

    expect(notifications.body.data.unreadCount).toBe(1);
    expect(notifications.body.data.items).toHaveLength(1);
    expect(notifications.body.data.items[0].type).toBe('new_quotation');
    expect(notifications.body.data.items[0].link).toBe('/society');

    notificationId = notifications.body.data.items[0].id as string;
  });

  it('lets the society review the applications for their request', async () => {
    const response = await request(app)
      .get(`/api/v1/requests/${requestId}/quotations`)
      .set('Authorization', `Bearer ${societyToken}`)
      .expect(200);

    expect(response.body.data.items).toHaveLength(1);
    expect(response.body.data.items[0].vendor.businessName).toBe(vendorPayload.vendor.businessName);
    expect(response.body.data.items[0].vendor.contactEmail).toBe(vendorPayload.email);
    expect(response.body.data.items[0].totalPrice).toBe(87_500);
    expect(response.body.data.pagination.total).toBe(1);
  });

  it('marks the society notification as read', async () => {
    const read = await request(app)
      .post(`/api/v1/notifications/${notificationId}/read`)
      .set('Authorization', `Bearer ${societyToken}`)
      .expect(200);

    expect(read.body.data.readAt).toBeTruthy();

    const notifications = await request(app)
      .get('/api/v1/notifications')
      .set('Authorization', `Bearer ${societyToken}`)
      .expect(200);

    expect(notifications.body.data.unreadCount).toBe(0);
  });

  it('updates the existing quotation instead of creating a duplicate', async () => {
    await request(app)
      .post(`/api/v1/requests/${requestId}/quotations`)
      .set('Authorization', `Bearer ${vendorToken}`)
      .send({
        totalPrice: 92_000,
        description: 'Revised dinner buffet for 250 guests with extra dessert options.',
        additionalCharges: null,
      })
      .expect(200);

    const list = await request(app)
      .get(`/api/v1/requests/${requestId}/quotations`)
      .set('Authorization', `Bearer ${societyToken}`)
      .expect(200);

    expect(list.body.data.items).toHaveLength(1);
    expect(list.body.data.items[0].totalPrice).toBe(92_000);
    expect(list.body.data.items[0].status).toBe('updated');

    const mine = await request(app)
      .get(`/api/v1/requests/${requestId}/quotations/mine`)
      .set('Authorization', `Bearer ${vendorToken}`)
      .expect(200);

    expect(mine.body.data.totalPrice).toBe(92_000);
  });

  it('marks every unread notification as read', async () => {
    const readAll = await request(app)
      .post('/api/v1/notifications/read-all')
      .set('Authorization', `Bearer ${societyToken}`)
      .expect(200);

    expect(readAll.body.data.updated).toBeGreaterThan(0);

    const notifications = await request(app)
      .get('/api/v1/notifications')
      .set('Authorization', `Bearer ${societyToken}`)
      .expect(200);

    expect(notifications.body.data.unreadCount).toBe(0);
  });

  it('rejects a verified vendor who was not invited', async () => {
    const response = await request(app)
      .post(`/api/v1/requests/${requestId}/quotations`)
      .set('Authorization', `Bearer ${outsiderToken}`)
      .send({
        totalPrice: 70_000,
        description: 'A quote from a vendor outside the invited service area.',
      })
      .expect(403);

    expect(response.body.error.code).toBe('FORBIDDEN');
  });
});
