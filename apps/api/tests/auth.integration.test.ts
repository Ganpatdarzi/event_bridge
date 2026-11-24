import type { PGlite } from '@electric-sql/pglite';
import request from 'supertest';
import { afterAll, describe, expect, it, vi } from 'vitest';

/**
 * The auth module talks to the Drizzle instance exported by `db/index.ts`.
 * For this suite we replace it with the same schema running on PGlite, so the
 * real migration and the real Express handlers are exercised without Neon.
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
  name: 'Ayesha Khan',
  email: 'integration.society@example.com',
  password: 'Society123',
  society: {
    societyName: 'Integration Test Society',
    institution: 'Test University',
    contactPerson: 'Ayesha Khan',
  },
};

function refreshCookieFrom(response: request.Response): string {
  const raw = response.headers['set-cookie'];
  const cookies = Array.isArray(raw) ? raw : raw ? [raw] : [];
  const cookie = cookies.find((value) => value.startsWith('eb_rt='));
  if (!cookie) throw new Error('Refresh cookie was not set');
  return cookie.split(';')[0] ?? '';
}

describe('authentication API', () => {
  let accessToken = '';
  let loginCookie = '';

  afterAll(async () => {
    await pg().close();
  });

  it('registers a society and stores an Argon2id hash', async () => {
    const response = await request(app)
      .post('/api/v1/auth/register')
      .send(societyPayload)
      .expect(201);

    expect(response.body.data.user.email).toBe(societyPayload.email);
    expect(response.body.data.user.role).toBe('society');
    expect(response.body.data.user).not.toHaveProperty('passwordHash');

    const { rows } = await pg().query<{ password_hash: string }>(
      'select password_hash from users where email = $1',
      [societyPayload.email],
    );

    expect(rows[0]?.password_hash.startsWith('$argon2id$')).toBe(true);
  });

  it('rejects a duplicate email with 409', async () => {
    const response = await request(app)
      .post('/api/v1/auth/register')
      .send(societyPayload)
      .expect(409);

    expect(response.body.error.code).toBe('DUPLICATE');
  });

  it('rejects malformed registration data with field details', async () => {
    const response = await request(app)
      .post('/api/v1/auth/register')
      .send({ ...societyPayload, email: 'not-an-email', password: 'short' })
      .expect(400);

    expect(response.body.error.code).toBe('VALIDATION_ERROR');
    expect(response.body.error.details.length).toBeGreaterThan(0);
    expect(response.body.error.message).not.toBe('Validation failed');
    expect(response.body.error.message).toMatch(
      /Enter a valid email address|Password must be at least 8 characters/,
    );
    expect(
      response.body.error.details.map((detail: { message: string }) => detail.message),
    ).toEqual(
      expect.arrayContaining([
        'Enter a valid email address',
        'Password must be at least 8 characters',
      ]),
    );
  });

  it('registers a vendor as pending_review', async () => {
    const response = await request(app)
      .post('/api/v1/auth/register')
      .send({
        role: 'vendor',
        name: 'Adil Khan',
        email: 'integration.vendor@example.com',
        password: 'Vendor123',
        vendor: {
          businessName: 'Integration Events',
          description: 'A vendor description long enough to pass validation.',
          city: 'Karachi',
        },
      })
      .expect(201);

    const { rows } = await pg().query<{ verification_status: string }>(
      `select v.verification_status from vendors v
       join users u on u.id = v.user_id
       where u.email = $1`,
      ['integration.vendor@example.com'],
    );

    expect(response.body.data.user.role).toBe('vendor');
    expect(rows[0]?.verification_status).toBe('pending_review');
  });

  it('rejects a wrong password without revealing whether the account exists', async () => {
    const wrongPassword = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: societyPayload.email, password: 'Wrong1234' })
      .expect(401);

    const unknownEmail = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'missing@example.com', password: 'Wrong1234' })
      .expect(401);

    expect(wrongPassword.body.error.message).toBe(unknownEmail.body.error.message);
  });

  it('logs in, sets an httpOnly refresh cookie and returns an access token', async () => {
    const agent = request.agent(app);
    const response = await agent
      .post('/api/v1/auth/login')
      .send({ email: societyPayload.email, password: societyPayload.password })
      .expect(200);

    accessToken = response.body.data.accessToken as string;
    loginCookie = refreshCookieFrom(response);

    expect(accessToken.split('.')).toHaveLength(3);
    expect(response.body.data.profile.type).toBe('society');
    expect(loginCookie.startsWith('eb_rt=')).toBe(true);

    const rawCookies = response.headers['set-cookie'] as unknown as string[];
    expect(rawCookies.some((value) => value.toLowerCase().includes('httponly'))).toBe(true);
  });

  it('returns the current session for a valid bearer token', async () => {
    const response = await request(app)
      .get('/api/v1/auth/me')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);

    expect(response.body.data.user.email).toBe(societyPayload.email);
    expect(response.body.data.profile.name).toBe(societyPayload.society.societyName);
  });

  it('rejects a missing or malformed bearer token', async () => {
    await request(app).get('/api/v1/auth/me').expect(401);
    await request(app).get('/api/v1/auth/me').set('Authorization', 'Bearer nonsense').expect(401);
  });

  it('rotates the refresh token and rejects reuse of the old one', async () => {
    const agent = request.agent(app);

    // Log in again so this test owns a known cookie pair.
    const login = await agent
      .post('/api/v1/auth/login')
      .send({ email: societyPayload.email, password: societyPayload.password })
      .expect(200);

    const oldCookie = refreshCookieFrom(login);

    const { rows: before } = await pg().query<{ count: number }>(
      'select count(*)::int as count from refresh_tokens where revoked_at is null',
    );

    const refreshed = await agent.post('/api/v1/auth/refresh').expect(200);
    expect(refreshed.body.data.accessToken).toBeTruthy();
    expect(refreshCookieFrom(refreshed)).not.toBe(oldCookie);

    // Replaying the revoked cookie must fail.
    await request(app).post('/api/v1/auth/refresh').set('Cookie', oldCookie).expect(401);

    // Rotation issues one replacement, but replaying the old token revokes
    // that replacement too because both belong to the same session family.
    const { rows: after } = await pg().query<{ count: number }>(
      'select count(*)::int as count from refresh_tokens where revoked_at is null',
    );
    expect(after[0]?.count).toBe((before[0]?.count ?? 0) - 1);
  });

  it('revokes the whole rotation family when a consumed token is replayed', async () => {
    const agent = request.agent(app);

    const login = await agent
      .post('/api/v1/auth/login')
      .send({ email: societyPayload.email, password: societyPayload.password })
      .expect(200);

    const originalCookie = refreshCookieFrom(login);
    const refreshed = await agent.post('/api/v1/auth/refresh').expect(200);
    const currentCookie = refreshCookieFrom(refreshed);

    // Replaying the consumed token from another client is a theft signal.
    await request(app).post('/api/v1/auth/refresh').set('Cookie', originalCookie).expect(401);

    // The token issued moments earlier in the same chain must now be dead too.
    await request(app).post('/api/v1/auth/refresh').set('Cookie', currentCookie).expect(401);
  });

  it('logs out by revoking the refresh token and clearing the cookie', async () => {
    const agent = request.agent(app);

    await agent
      .post('/api/v1/auth/login')
      .send({ email: societyPayload.email, password: societyPayload.password })
      .expect(200);

    const logout = await agent.post('/api/v1/auth/logout').expect(204);
    const rawCookies = logout.headers['set-cookie'] as unknown as string[] | undefined;
    expect(rawCookies?.some((value) => value.startsWith('eb_rt=;'))).toBe(true);

    await agent.post('/api/v1/auth/refresh').expect(401);
  });

  it('rejects a suspended account at login', async () => {
    await pg().query("update users set status = 'suspended' where email = $1", [
      societyPayload.email,
    ]);

    await request(app)
      .post('/api/v1/auth/login')
      .send({ email: societyPayload.email, password: societyPayload.password })
      .expect(403);

    await pg().query("update users set status = 'active' where email = $1", [societyPayload.email]);
  });

  it('persists the account only once even under concurrent duplicate registration', async () => {
    const results = await Promise.all([
      request(app)
        .post('/api/v1/auth/register')
        .send({ ...societyPayload, email: 'race@example.com' }),
      request(app)
        .post('/api/v1/auth/register')
        .send({ ...societyPayload, email: 'race@example.com' }),
    ]);

    const statuses = results.map((result) => result.status).sort();
    expect(statuses).toEqual([201, 409]);

    const { rows } = await pg().query<{ count: number }>(
      "select count(*)::int as count from users where email = 'race@example.com'",
    );
    expect(rows[0]?.count).toBe(1);
  });
});
