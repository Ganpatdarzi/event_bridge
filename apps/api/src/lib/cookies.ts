import type { Response } from 'express';
import { env } from '../config/env.js';
import {
  refreshCookieName,
  refreshCookiePath,
  refreshCookieSecure,
  refreshTokenTtlMs,
} from '../lib/tokens.js';

export function setRefreshCookie(res: Response, token: string): void {
  res.cookie(refreshCookieName, token, {
    httpOnly: true,
    secure: refreshCookieSecure,
    sameSite: 'lax',
    path: refreshCookiePath,
    maxAge: refreshTokenTtlMs,
    ...(env.COOKIE_DOMAIN ? { domain: env.COOKIE_DOMAIN } : {}),
  });
}

export function clearRefreshCookie(res: Response): void {
  res.clearCookie(refreshCookieName, {
    httpOnly: true,
    secure: refreshCookieSecure,
    sameSite: 'lax',
    path: refreshCookiePath,
    ...(env.COOKIE_DOMAIN ? { domain: env.COOKIE_DOMAIN } : {}),
  });
}
