import { randomBytes, createHash } from 'node:crypto';
import jwt, { type SignOptions } from 'jsonwebtoken';
import { env, isProduction } from '../config/env.js';
import type { UserRole } from '@event-bridge/shared';

export interface AccessTokenPayload {
  sub: string;
  role: UserRole;
}

export function signAccessToken(userId: string, role: UserRole): string {
  return jwt.sign({ role }, env.JWT_SECRET, {
    subject: userId,
    expiresIn: env.JWT_EXPIRES_IN as SignOptions['expiresIn'],
    issuer: 'event-bridge',
    audience: 'event-bridge-web',
  });
}

export function verifyAccessToken(token: string): AccessTokenPayload {
  const decoded = jwt.verify(token, env.JWT_SECRET, {
    issuer: 'event-bridge',
    audience: 'event-bridge-web',
  });

  if (typeof decoded === 'string' || !decoded.sub || !decoded.role) {
    throw new Error('Malformed access token');
  }

  return { sub: decoded.sub, role: decoded.role as UserRole };
}

/** Opaque refresh token: high-entropy, stored only as a SHA-256 hash. */
export function generateRefreshToken(): string {
  return randomBytes(48).toString('base64url');
}

export function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

export function parseDuration(value: string): number {
  const match = /^(\d+)([smhd])$/.exec(value.trim());
  if (!match) {
    throw new Error(`Unsupported duration "${value}". Use values such as 15m, 12h or 7d.`);
  }
  const amount = Number(match[1] ?? 0);
  const unit = match[2] ?? 'd';
  const multipliers: Record<string, number> = { s: 1000, m: 60_000, h: 3_600_000, d: 86_400_000 };
  return amount * (multipliers[unit] ?? 0);
}

export const refreshTokenTtlMs = parseDuration(env.REFRESH_EXPIRES_IN);
export const refreshCookieName = 'eb_rt';
export const refreshCookiePath = '/api/v1/auth';
export const refreshCookieSecure = env.COOKIE_SECURE || isProduction;
