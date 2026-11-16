import { rateLimit } from 'express-rate-limit';
import { env, isTest } from '../config/env.js';

const base = {
  standardHeaders: 'draft-8' as const,
  legacyHeaders: false,
  skip: () => isTest,
  message: {
    error: { code: 'RATE_LIMITED', message: 'Too many requests. Please try again later.' },
  },
};

/** Broad protection for the whole API. */
export const globalLimiter = rateLimit({
  ...base,
  windowMs: env.RATE_LIMIT_WINDOW_MS,
  limit: env.RATE_LIMIT_MAX,
});

/** Tighter limits for credential and reset endpoints. */
export const authLimiter = rateLimit({
  ...base,
  windowMs: 15 * 60 * 1000,
  limit: 20,
});
