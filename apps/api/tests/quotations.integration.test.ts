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

const otherCategoryVendorPayload = {
  role: 'vendor' as const,
  name: 'Hamza Raza',
  email: 'quotes.decor@example.com',
  password: 'Vendor123!',
  vendor: {
    businessName: 'Decor Studio',
    description: 'Decorations and stage setup for conferences and formal dinners.',
    city: 'Karachi',
    serviceArea: 'Karachi',
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
  let otherCategoryId = '';
  let requestId = '';
  let societyToken = '';
  let vendorToken = '';
  let outsiderToken = '';
  let otherCategoryVendorToken = '';
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

    const otherCategory = await pg().query<{ id: string }>(
      `insert into categories (name, slug, description)
       values ('Decor', 'decor-quote-test', 'Event decoration')
       returning id`,
    );
    otherCategoryId = otherCategory.rows[0]?.id ?? '';

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
    await request(app)
      .post('/api/v1/auth/register')
      .send({
        ...otherCategoryVendorPayload,
        vendor: {
          ...otherCategoryVendorPayload.vendor,
          categoryIds: [otherCategoryId],
        },
      })
      .expect(201);

    await verifyVendor(vendorPayload.email);
    await verifyVendor(outsiderPayload.email);
    await verifyVendor(otherCategoryVendorPayload.email);

    societyToken = await login(societyPayload.email, societyPayload.password);
    vendorToken = await login(vendorPayload.email, vendorPayload.password);
    outsiderToken = await login(outsiderPayload.email, outsiderPayload.password);
    otherCategoryVendorToken = await login(
      otherCategoryVendorPayload.email,
      otherCategoryVendorPayload.password,
    );

    expect(categoryId).not.toBe('');
    expect(otherCategoryId).not.toBe('');
  });

  it('publishes a request and invites every verified vendor in the category', async () => {
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
    expect(response.body.data.counts.invitedVendors).toBe(2);

    for (const token of [vendorToken, outsiderToken]) {
      const board = await request(app)
        .get('/api/v1/vendor/requests')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(board.body.data.items).toHaveLength(1);
      expect(board.body.data.items[0].id).toBe(requestId);
      expect(board.body.data.items[0].hasQuoted).toBe(false);
      expect(board.body.data.items[0].description).toContain('full catering for 250 guests');
      expect(board.body.data.items[0].quantity).toBe(250);
      expect(board.body.data.items[0].event.expectedAttendance).toBe(250);
    }
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

  it('rejects a verified vendor outside the request category', async () => {
    const response = await request(app)
      .post(`/api/v1/requests/${requestId}/quotations`)
      .set('Authorization', `Bearer ${otherCategoryVendorToken}`)
      .send({
        totalPrice: 70_000,
        description: 'A quote from a vendor in a different service category.',
      })
      .expect(403);

    expect(response.body.error.code).toBe('FORBIDDEN');
  });

  async function currentQuotationId(): Promise<string> {
    const response = await request(app)
      .get(`/api/v1/requests/${requestId}/quotations`)
      .set('Authorization', `Bearer ${societyToken}`)
      .expect(200);
    return response.body.data.items[0].id as string;
  }

  it('refuses to select from a request that is not in a reviewable state', async () => {
    const quoteId = await currentQuotationId();

    await pg().query(`update service_requests set status = 'open' where id = $1`, [requestId]);
    const open = await request(app)
      .post(`/api/v1/requests/${requestId}/quotations/${quoteId}/select`)
      .set('Authorization', `Bearer ${societyToken}`)
      .expect(409);
    expect(open.body.error.code).toBe('CONFLICT');

    await pg().query(`update service_requests set status = 'partially_quoted' where id = $1`, [
      requestId,
    ]);
  });

  it('refuses to select withdrawn or expired quotations', async () => {
    const quoteId = await currentQuotationId();

    for (const status of ['withdrawn', 'expired']) {
      await pg().query(`update quotations set status = $1 where id = $2`, [status, quoteId]);
      const response = await request(app)
        .post(`/api/v1/requests/${requestId}/quotations/${quoteId}/select`)
        .set('Authorization', `Bearer ${societyToken}`)
        .expect(409);
      expect(response.body.error.code).toBe('CONFLICT');
    }

    await pg().query(`update quotations set status = 'updated' where id = $1`, [quoteId]);
  });

  it('prefers a quotation without losing the marker when it is revised', async () => {
    const quoteId = await currentQuotationId();

    const preferred = await request(app)
      .post(`/api/v1/requests/${requestId}/quotations/${quoteId}/prefer`)
      .set('Authorization', `Bearer ${societyToken}`)
      .expect(200);
    expect(preferred.body.data.status).toBe('preferred');

    await request(app)
      .post(`/api/v1/requests/${requestId}/quotations`)
      .set('Authorization', `Bearer ${vendorToken}`)
      .send({
        totalPrice: 95_000,
        description: 'Final revision of the dinner buffet for 250 guests.',
      })
      .expect(200);

    const list = await request(app)
      .get(`/api/v1/requests/${requestId}/quotations`)
      .set('Authorization', `Bearer ${societyToken}`)
      .expect(200);
    expect(list.body.data.items[0].status).toBe('preferred');
  });

  it('moves a request into the quoted review state', async () => {
    const response = await request(app)
      .post(`/api/v1/requests/${requestId}/close-quoting`)
      .set('Authorization', `Bearer ${societyToken}`)
      .expect(200);

    expect(response.body.data.status).toBe('quoted');
  });

  it('selects a quotation, demotes rivals and notifies the vendor', async () => {
    const quoteId = await currentQuotationId();

    const selected = await request(app)
      .post(`/api/v1/requests/${requestId}/quotations/${quoteId}/select`)
      .set('Authorization', `Bearer ${societyToken}`)
      .expect(200);
    expect(selected.body.data.status).toBe('selected');

    const requests = await request(app)
      .get('/api/v1/requests')
      .set('Authorization', `Bearer ${societyToken}`)
      .expect(200);
    const published = requests.body.data.items.find(
      (item: { id: string }) => item.id === requestId,
    );
    expect(published?.status).toBe('selected');

    const stored = await pg().query<{ selected_quotation_id: string }>(
      `select selected_quotation_id from service_requests where id = $1`,
      [requestId],
    );
    expect(stored.rows[0]?.selected_quotation_id).toBe(quoteId);

    const vendorNotifications = await request(app)
      .get('/api/v1/notifications')
      .set('Authorization', `Bearer ${vendorToken}`)
      .expect(200);
    expect(
      vendorNotifications.body.data.items.some(
        (item: { type: string }) => item.type === 'quotation_selected',
      ),
    ).toBe(true);
  });

  it('rejects a second selection and a withdrawal after selection', async () => {
    const quoteId = await currentQuotationId();

    await request(app)
      .post(`/api/v1/requests/${requestId}/quotations/${quoteId}/select`)
      .set('Authorization', `Bearer ${societyToken}`)
      .expect(409);

    const withdrawn = await request(app)
      .post(`/api/v1/quotations/${quoteId}/withdraw`)
      .set('Authorization', `Bearer ${vendorToken}`)
      .expect(409);
    expect(withdrawn.body.error.code).toBe('CONFLICT');
  });

  it('enforces the one-selected-quotation rule at database level', async () => {
    const { rows } = await pg().query<{ id: string }>(`select id from users where email = $1`, [
      outsiderPayload.email,
    ]);
    const outsiderVendorId = (
      await pg().query<{ id: string }>(`select id from vendors where user_id = $1`, [rows[0]?.id])
    ).rows[0]?.id;

    expect(outsiderVendorId).toBeTruthy();

    const inserted = await pg().query<{ id: string }>(
      `insert into quotations (reference, request_id, vendor_id, total_price, description, status)
       values ('Q-LIFECYCLE-TEST', $1, $2, 50000, 'Rival quotation', 'not_selected')
       returning id`,
      [requestId, outsiderVendorId],
    );

    await expect(
      pg().query(`update quotations set status = 'selected' where id = $1`, [inserted.rows[0]?.id]),
    ).rejects.toThrow(/unique|duplicate/i);
  });

  it('returns a normalised comparison payload only to the request owner', async () => {
    const response = await request(app)
      .get(`/api/v1/requests/${requestId}/compare`)
      .set('Authorization', `Bearer ${societyToken}`)
      .expect(200);

    expect(response.body.data.request.id).toBe(requestId);
    expect(response.body.data.items.length).toBeGreaterThanOrEqual(2);
    expect(response.body.data.items[0].totalWithExtras).toBeGreaterThanOrEqual(
      response.body.data.items[0].totalPrice,
    );
    expect(response.body.data.summary.count).toBeGreaterThanOrEqual(1);
    expect(response.body.data.summary.lowestTotal).toBeLessThanOrEqual(
      response.body.data.summary.highestTotal,
    );

    await request(app)
      .post('/api/v1/auth/register')
      .send({
        role: 'society',
        name: 'Compare Outsider',
        email: 'quotes.compare-outsider@example.com',
        password: 'Society123!',
        society: {
          societyName: 'Compare Outsider',
          institution: 'Other University',
          contactPerson: 'Compare Outsider',
        },
      })
      .expect(201);

    const otherToken = await login('quotes.compare-outsider@example.com', 'Society123!');
    await request(app)
      .get(`/api/v1/requests/${requestId}/compare`)
      .set('Authorization', `Bearer ${otherToken}`)
      .expect(404);
  });

  it('does not let another society select a quotation by guessing the request id', async () => {
    const quoteId = await currentQuotationId();

    await request(app)
      .post('/api/v1/auth/register')
      .send({
        role: 'society',
        name: 'Other Society',
        email: 'quotes.other-society@example.com',
        password: 'Society123!',
        society: {
          societyName: 'Other Society',
          institution: 'Other University',
          contactPerson: 'Other Society',
        },
      })
      .expect(201);

    const otherToken = await login('quotes.other-society@example.com', 'Society123!');
    const response = await request(app)
      .post(`/api/v1/requests/${requestId}/quotations/${quoteId}/select`)
      .set('Authorization', `Bearer ${otherToken}`)
      .expect(404);

    expect(response.body.error.code).toBe('NOT_FOUND');
  });

  it('does not expose the account email on an anonymous vendor profile', async () => {
    const { rows } = await pg().query<{ id: string }>(
      'select id from vendors where user_id = (select id from users where email = $1)',
      [vendorPayload.email],
    );

    const response = await request(app).get(`/api/v1/vendors/${rows[0]?.id}`).expect(200);
    expect(response.body.data.contactPhone).toBe(vendorPayload.vendor.contactPhone);
    expect(response.body.data.contactEmail).toBeUndefined();
  });

  it('rejects portfolio uploads that are not image data URLs', async () => {
    const response = await request(app)
      .post('/api/v1/vendors/me/portfolio')
      .set('Authorization', `Bearer ${vendorToken}`)
      .send({
        dataUrl: `data:text/plain;base64,${Buffer.from('not an image').toString('base64')}`,
      })
      .expect(400);

    expect(response.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('requires completion before a review can be left', async () => {
    const tooEarly = await request(app)
      .post(`/api/v1/requests/${requestId}/review`)
      .set('Authorization', `Bearer ${societyToken}`)
      .send({ rating: 5 })
      .expect(409);
    expect(tooEarly.body.error.code).toBe('CONFLICT');

    const otherToken = await login('quotes.other-society@example.com', 'Society123!');
    await request(app)
      .post(`/api/v1/requests/${requestId}/complete`)
      .set('Authorization', `Bearer ${otherToken}`)
      .expect(404);

    const completed = await request(app)
      .post(`/api/v1/requests/${requestId}/complete`)
      .set('Authorization', `Bearer ${societyToken}`)
      .expect(200);
    expect(completed.body.data.status).toBe('completed');

    const notifications = await request(app)
      .get('/api/v1/notifications')
      .set('Authorization', `Bearer ${vendorToken}`)
      .expect(200);
    expect(
      notifications.body.data.items.some(
        (item: { type: string }) => item.type === 'request_completed',
      ),
    ).toBe(true);

    const review = await request(app)
      .post(`/api/v1/requests/${requestId}/review`)
      .set('Authorization', `Bearer ${societyToken}`)
      .send({ rating: 5, comment: 'Excellent work.' })
      .expect(201);
    expect(review.body.data.rating).toBe(5);

    await request(app)
      .post(`/api/v1/requests/${requestId}/review`)
      .set('Authorization', `Bearer ${societyToken}`)
      .send({ rating: 4 })
      .expect(409);
  });

  it('lazily expires quotations whose validity window has passed', async () => {
    const { rows } = await pg().query<{ id: string }>(
      `select id from quotations where reference = 'Q-LIFECYCLE-TEST'`,
    );
    const rivalId = rows[0]?.id;
    expect(rivalId).toBeTruthy();

    await pg().query(
      `update quotations set status = 'submitted', valid_until = now() - interval '1 day' where id = $1`,
      [rivalId],
    );

    const list = await request(app)
      .get(`/api/v1/requests/${requestId}/quotations`)
      .set('Authorization', `Bearer ${societyToken}`)
      .expect(200);

    const rival = list.body.data.items.find((item: { id: string }) => item.id === rivalId);
    expect(rival?.status).toBe('expired');
  });
});
