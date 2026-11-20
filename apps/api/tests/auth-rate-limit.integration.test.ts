import request from 'supertest';
import { describe, expect, it, vi } from 'vitest';

/**
 * Keeps the broad limiter out of the way so the tighter credential limiter can
 * be verified on its own 20-request window.
 */
vi.mock('../src/config/env.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../src/config/env.js')>();
  return {
    ...actual,
    env: {
      ...actual.env,
      NODE_ENV: 'production',
      RATE_LIMIT_WINDOW_MS: 60_000,
      RATE_LIMIT_MAX: 100,
    },
    isTest: false,
    isProduction: true,
    isDevelopment: false,
  };
});

const { createApp } = await import('../src/app.js');
const app = createApp();

const invalidLogin = { email: 'not-an-email' };

describe('authentication rate limiting', () => {
  it('blocks the twenty-first credential attempt in a window', async () => {
    for (let attempt = 0; attempt < 20; attempt += 1) {
      await request(app).post('/api/v1/auth/login').send(invalidLogin).expect(400);
    }

    const blocked = await request(app).post('/api/v1/auth/login').send(invalidLogin).expect(429);

    expect(blocked.body.error.code).toBe('RATE_LIMITED');
    expect(blocked.headers.ratelimit).toMatch(/r=0;/);
    expect(blocked.headers['ratelimit-policy']).toContain('q=20');
  });
});
