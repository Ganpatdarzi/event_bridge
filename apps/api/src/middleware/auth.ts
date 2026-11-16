import type { RequestHandler } from 'express';
import { eq } from 'drizzle-orm';
import type { UserRole } from '@event-bridge/shared';
import { db } from '../db/index.js';
import { users } from '../db/schema/index.js';
import { AppError } from '../lib/errors.js';
import { verifyAccessToken } from '../lib/tokens.js';

export const authenticate: RequestHandler = async (req, _res, next) => {
  try {
    const header = req.headers.authorization;
    if (!header || !header.startsWith('Bearer ')) {
      throw AppError.unauthenticated();
    }

    const token = header.slice('Bearer '.length).trim();

    let userId: string;
    try {
      userId = verifyAccessToken(token).sub;
    } catch {
      throw AppError.unauthenticated('Your session has expired. Please sign in again.');
    }

    const [user] = await db
      .select({
        id: users.id,
        name: users.name,
        email: users.email,
        role: users.role,
        status: users.status,
      })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    if (!user) {
      throw AppError.unauthenticated('Session is no longer valid');
    }

    if (user.status !== 'active') {
      throw AppError.forbidden('This account is not active. Contact the platform administrator.');
    }

    req.user = user;
    next();
  } catch (error) {
    next(error);
  }
};

export function authorize(...roles: UserRole[]): RequestHandler {
  return (req, _res, next) => {
    if (!req.user) {
      next(AppError.unauthenticated());
      return;
    }
    if (!roles.includes(req.user.role)) {
      next(AppError.forbidden());
      return;
    }
    next();
  };
}
