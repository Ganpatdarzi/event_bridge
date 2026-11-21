import type { PGlite } from '@electric-sql/pglite';
import request from 'supertest';
import { afterAll, describe, expect, it, vi } from 'vitest';

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

const firstSociety = {
  role: 'society' as const,
  name: 'Booking Society One',
  email: 'booking.society1@example.com',
  password: 'Society123!',
  society: {
    societyName: 'Booking One Society',
    institution: 'Booking One University',
    contactPerson: 'Booking Society One',
  },
};

const secondSociety = {
  role: 'society' as const,
  name: 'Booking Society Two',
  email: 'booking.society2@example.com',
  password: 'Society123!',
  society: {
    societyName: 'Booking Two Society',
    institution: 'Booking Two University',
    contactPerson: 'Booking Society Two',
  },
};

const vendor = {
  role: 'vendor' as const,
  name: 'Booking Vendor',
  email: 'booking.vendor@example.com',
  password: 'Vendor123!',
  vendor: {
    businessName: 'Booking Catering Co',
    description: 'Catering for society dinners, galas and university events.',
    city: 'Karachi',
    serviceArea: 'Karachi',
    contactPerson: 'Booking Vendor',
    contactPhone: '03001234567',
  },
};

async function login(email: string, password: string): Promise<string> {
  const response = await request(app)
    .post('/api/v1/auth/login')
    .send({ email, password })
    .expect(200);
  return response.body.data.accessToken as string;
}

async function createRequest(token: string, title: string, categoryId: string): Promise<string> {
  const eventDate = new Date(Date.now() + 45 * 86_400_000).toISOString().slice(0, 10);
  const response = await request(app)
    .post('/api/v1/requests')
    .set('Authorization', `Bearer ${token}`)
    .send({
      event: {
        name: `${title} event`,
        eventDate,
        location: 'Karachi Expo Centre',
        expectedAttendance: 200,
      },
      categoryId,
      title,
      description: 'We need full catering and service staff for a university event.',
      budgetMin: 50_000,
      budgetMax: 150_000,
      quantity: 200,
      responseDeadline: new Date(Date.now() + 10 * 86_400_000).toISOString(),
      submit: true,
    })
    .expect(201);

  return response.body.data.id as string;
}

async function submitQuote(token: string, requestId: string): Promise<string> {
  const response = await request(app)
    .post(`/api/v1/requests/${requestId}/quotations`)
    .set('Authorization', `Bearer ${token}`)
    .send({
      totalPrice: 85_000,
      description: 'Dinner buffet with service staff, crockery and cleanup.',
      additionalCharges: 2_000,
      availableOnDate: true,
    })
    .expect(201);

  return response.body.data.id as string;
}

async function selectQuote(token: string, requestId: string, quotationId: string): Promise<void> {
  await request(app)
    .post(`/api/v1/requests/${requestId}/quotations/${quotationId}/select`)
    .set('Authorization', `Bearer ${token}`)
    .expect(200);
}

describe('vendor hiring and availability', () => {
  afterAll(async () => {
    await pg().close();
  });

  let categoryId = '';
  let firstToken = '';
  let secondToken = '';
  let vendorToken = '';
  let firstRequestId = '';
  let secondRequestId = '';
  let firstQuoteId = '';
  let secondQuoteId = '';
  let vendorId = '';
  let firstBookingId = '';
  let secondBookingId = '';

  const firstWindow = {
    startsAt: '2030-06-01T10:00:00.000Z',
    endsAt: '2030-06-01T14:00:00.000Z',
  };

  it('sets up two societies, one verified vendor and two selected requests', async () => {
    const { rows } = await pg().query<{ id: string }>(
      `insert into categories (name, slug, description)
       values ('Hire Catering', 'hire-catering-test', 'Catering for hire tests')
       returning id`,
    );
    categoryId = rows[0]?.id ?? '';

    await request(app).post('/api/v1/auth/register').send(firstSociety).expect(201);
    await request(app).post('/api/v1/auth/register').send(secondSociety).expect(201);
    await request(app)
      .post('/api/v1/auth/register')
      .send({ ...vendor, vendor: { ...vendor.vendor, categoryIds: [categoryId] } })
      .expect(201);

    await pg().query(
      `update vendors set verification_status = 'verified', verified_at = now()
       where user_id = (select id from users where email = $1)`,
      [vendor.email],
    );

    firstToken = await login(firstSociety.email, firstSociety.password);
    secondToken = await login(secondSociety.email, secondSociety.password);
    vendorToken = await login(vendor.email, vendor.password);

    const vendorRow = await pg().query<{ id: string }>(
      'select id from vendors where user_id = (select id from users where email = $1)',
      [vendor.email],
    );
    vendorId = vendorRow.rows[0]?.id ?? '';

    firstRequestId = await createRequest(firstToken, 'First hire request', categoryId);
    secondRequestId = await createRequest(secondToken, 'Second hire request', categoryId);

    firstQuoteId = await submitQuote(vendorToken, firstRequestId);
    secondQuoteId = await submitQuote(vendorToken, secondRequestId);

    await request(app)
      .post(`/api/v1/requests/${firstRequestId}/close-quoting`)
      .set('Authorization', `Bearer ${firstToken}`)
      .expect(200);
    await request(app)
      .post(`/api/v1/requests/${secondRequestId}/close-quoting`)
      .set('Authorization', `Bearer ${secondToken}`)
      .expect(200);

    await selectQuote(firstToken, firstRequestId, firstQuoteId);
    await selectQuote(secondToken, secondRequestId, secondQuoteId);

    expect(categoryId).not.toBe('');
    expect(vendorId).not.toBe('');
  });

  it('creates a confirmed hire and exposes it on the society request list', async () => {
    const response = await request(app)
      .post('/api/v1/bookings')
      .set('Authorization', `Bearer ${firstToken}`)
      .send({ quotationId: firstQuoteId, ...firstWindow })
      .expect(201);

    firstBookingId = response.body.data.id as string;
    expect(response.body.data.status).toBe('confirmed');
    expect(response.body.data.amount).toBe(87_000);
    expect(response.body.data.vendor.id).toBe(vendorId);

    const list = await request(app)
      .get('/api/v1/requests')
      .set('Authorization', `Bearer ${firstToken}`)
      .expect(200);
    const item = list.body.data.items.find((entry: { id: string }) => entry.id === firstRequestId);
    expect(item?.booking?.id).toBe(firstBookingId);
    expect(item?.booking?.status).toBe('confirmed');
  });

  it('reports the hired window as unavailable to other societies', async () => {
    const response = await request(app)
      .get(
        `/api/v1/bookings/availability/${vendorId}?from=${encodeURIComponent(
          firstWindow.startsAt,
        )}&to=${encodeURIComponent(firstWindow.endsAt)}`,
      )
      .set('Authorization', `Bearer ${secondToken}`)
      .expect(200);

    expect(response.body.data.available).toBe(false);
    expect(response.body.data.busyWindows[0].id).toBe(firstBookingId);
  });

  it('blocks a second society from hiring the same vendor for an overlapping window', async () => {
    const response = await request(app)
      .post('/api/v1/bookings')
      .set('Authorization', `Bearer ${secondToken}`)
      .send({
        quotationId: secondQuoteId,
        startsAt: '2030-06-01T12:00:00.000Z',
        endsAt: '2030-06-01T16:00:00.000Z',
      })
      .expect(409);

    expect(response.body.error.code).toBe('BOOKING_CONFLICT');
  });

  it('allows a back-to-back hire because the windows do not overlap', async () => {
    const response = await request(app)
      .post('/api/v1/bookings')
      .set('Authorization', `Bearer ${secondToken}`)
      .send({
        quotationId: secondQuoteId,
        startsAt: '2030-06-01T14:00:00.000Z',
        endsAt: '2030-06-01T18:00:00.000Z',
      })
      .expect(201);

    secondBookingId = response.body.data.id as string;
    expect(response.body.data.status).toBe('confirmed');
  });

  it('blocks a vendor role from creating a hire', async () => {
    const response = await request(app)
      .post('/api/v1/bookings')
      .set('Authorization', `Bearer ${vendorToken}`)
      .send({ quotationId: firstQuoteId, ...firstWindow })
      .expect(403);

    expect(response.body.error.code).toBe('FORBIDDEN');
  });

  it("frees the vendor's time after cancellation", async () => {
    await request(app)
      .post(`/api/v1/bookings/${secondBookingId}/cancel`)
      .set('Authorization', `Bearer ${secondToken}`)
      .send({ reason: 'Plans changed' })
      .expect(200);

    const availability = await request(app)
      .get(
        `/api/v1/bookings/availability/${vendorId}?from=2030-06-01T14%3A00%3A00.000Z&to=2030-06-01T18%3A00%3A00.000Z`,
      )
      .set('Authorization', `Bearer ${firstToken}`)
      .expect(200);

    expect(availability.body.data.available).toBe(true);
  });

  it('completes the request and its active hire', async () => {
    await request(app)
      .post(`/api/v1/requests/${firstRequestId}/complete`)
      .set('Authorization', `Bearer ${firstToken}`)
      .expect(200);

    const bookings = await request(app)
      .get('/api/v1/bookings/me')
      .set('Authorization', `Bearer ${firstToken}`)
      .expect(200);

    const booking = bookings.body.data.find((entry: { id: string }) => entry.id === firstBookingId);
    expect(booking?.status).toBe('completed');
  });
});
