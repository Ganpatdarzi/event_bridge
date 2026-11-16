import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    passWithNoTests: true,
    include: ['src/**/*.test.ts', 'tests/**/*.test.ts'],
    testTimeout: 30_000,
    hookTimeout: 120_000,
    env: {
      NODE_ENV: 'test',
      DATABASE_URL: 'postgresql://user:pass@localhost:5432/eventbridge',
      JWT_SECRET: 'test-access-secret-test-access-secret-1234',
      JWT_REFRESH_SECRET: 'test-refresh-secret-test-refresh-secret-1234',
      LOG_LEVEL: 'silent',
    },
  },
});
