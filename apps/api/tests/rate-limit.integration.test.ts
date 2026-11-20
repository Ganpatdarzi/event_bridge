import request from 'supertest';
import { describe, expect, it, vi } from 'vitest';

/**
 * The shipped limiters skip requests when NODE_ENV=test. This suite overrides
 * that flag before the app is imported so the real global limiter can be
 * exercised without changing production code for tests.
 */
vi.mock('../src/config/env.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../src/config/env.js')>();
  return {
    ...actual,
    env: {
      ...actual.env,
      NODE_ENV: 'production',
      RATE_LIMIT_WINDOW_MS: 60_000,
      RATE_LIMIT_MAX: 2,
    },
    isTest: false,
    isProduction: true,
    isDevelopment: false,
  };
});

const { createApp } = await import('../src/app.js');
const app = createApp();

describe('global rate limiting', () => {
  it('returns RATE_LIMITED with standard headers after the configured limit', async () => {
    const first = await request(app).get('/health').expect(200);
    const second = await request(app).get('/health').expect(200);
    const blocked = await request(app).get('/health').expect(429);

    expect(first.headers.ratelimit).toMatch(/r=1;/);
    expect(second.headers.ratelimit).toMatch(/r=0;/);
    expect(blocked.headers['ratelimit-policy']).toContain('q=2');
    expect(blocked.body.error.code).toBe('RATE_LIMITED');
    expect(blocked.body.error.message).toMatch(/too many/i);
  });
});
