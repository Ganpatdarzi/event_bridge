import { randomUUID } from 'node:crypto';
import { and, eq, gt, isNull } from 'drizzle-orm';
import type { LoginInput, RegisterInput, VendorStatus } from '@event-bridge/shared';
import { db } from '../../db/index.js';
import {
  refreshTokens,
  societies,
  users,
  vendorCategories,
  vendors,
  type User,
} from '../../db/schema/index.js';
import { AppError, isForeignKeyViolation, isUniqueViolation } from '../../lib/errors.js';
import { hashPassword, verifyPassword } from '../../lib/password.js';
import {
  generateRefreshToken,
  hashToken,
  refreshTokenTtlMs,
  signAccessToken,
} from '../../lib/tokens.js';

export interface PublicUser {
  id: string;
  name: string;
  email: string;
  role: User['role'];
  status: User['status'];
  createdAt: string;
}

export interface SessionProfile {
  type: 'society' | 'vendor';
  id: string;
  name: string;
  institution?: string;
  verificationStatus?: VendorStatus;
}

export interface Session {
  user: PublicUser;
  profile: SessionProfile | null;
}

export interface SessionTokens {
  accessToken: string;
  refreshToken: string;
  refreshExpiresAt: Date;
}

export interface RequestMeta {
  userAgent?: string | undefined;
  ip?: string | undefined;
}

function toPublicUser(user: User): PublicUser {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    status: user.status,
    createdAt: user.createdAt.toISOString(),
  };
}

export async function buildSession(userId: string): Promise<Session> {
  const [user] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
  if (!user) {
    throw AppError.unauthenticated('Session is no longer valid');
  }

  if (user.role === 'society') {
    const [society] = await db
      .select()
      .from(societies)
      .where(eq(societies.userId, user.id))
      .limit(1);

    return {
      user: toPublicUser(user),
      profile: society
        ? { type: 'society', id: society.id, name: society.name, institution: society.institution }
        : null,
    };
  }

  if (user.role === 'vendor') {
    const [vendor] = await db.select().from(vendors).where(eq(vendors.userId, user.id)).limit(1);

    return {
      user: toPublicUser(user),
      profile: vendor
        ? {
            type: 'vendor',
            id: vendor.id,
            name: vendor.businessName,
            verificationStatus: vendor.verificationStatus,
          }
        : null,
    };
  }

  return { user: toPublicUser(user), profile: null };
}

export async function registerUser(input: RegisterInput): Promise<{ user: PublicUser }> {
  const passwordHash = await hashPassword(input.password);

  try {
    const user = await db.transaction(async (tx) => {
      const [created] = await tx
        .insert(users)
        .values({
          name: input.name,
          email: input.email,
          passwordHash,
          role: input.role,
        })
        .returning();

      if (!created) {
        throw new Error('User insert returned no row');
      }

      if (input.role === 'society') {
        await tx.insert(societies).values({
          userId: created.id,
          name: input.society.societyName,
          institution: input.society.institution,
          contactPerson: input.society.contactPerson,
          contactEmail: input.society.contactEmail ?? input.email,
          contactPhone: input.society.contactPhone ?? null,
          description: input.society.description ?? null,
        });
      } else {
        const [vendor] = await tx
          .insert(vendors)
          .values({
            userId: created.id,
            businessName: input.vendor.businessName,
            description: input.vendor.description,
            city: input.vendor.city,
            serviceArea: input.vendor.serviceArea ?? null,
            contactPerson: input.vendor.contactPerson ?? input.name,
            contactPhone: input.vendor.contactPhone ?? null,
            verificationStatus: 'pending_review',
          })
          .returning();

        if (vendor && input.vendor.categoryIds?.length) {
          await tx.insert(vendorCategories).values(
            [...new Set(input.vendor.categoryIds)].map((categoryId) => ({
              vendorId: vendor.id,
              categoryId,
            })),
          );
        }
      }

      return created;
    });

    return { user: toPublicUser(user) };
  } catch (error) {
    if (isUniqueViolation(error)) {
      throw AppError.conflict('DUPLICATE', 'An account with this email already exists');
    }
    if (isForeignKeyViolation(error)) {
      throw AppError.badRequest('One or more selected service categories do not exist');
    }
    throw error;
  }
}

async function issueTokens(
  userId: string,
  role: User['role'],
  meta: RequestMeta,
  familyId: string = randomUUID(),
): Promise<SessionTokens> {
  const refreshToken = generateRefreshToken();
  const refreshExpiresAt = new Date(Date.now() + refreshTokenTtlMs);

  await db.insert(refreshTokens).values({
    userId,
    familyId,
    tokenHash: hashToken(refreshToken),
    expiresAt: refreshExpiresAt,
    userAgent: meta.userAgent ?? null,
    ip: meta.ip ?? null,
  });

  return {
    accessToken: signAccessToken(userId, role),
    refreshToken,
    refreshExpiresAt,
  };
}

export async function loginUser(
  input: LoginInput,
  meta: RequestMeta,
): Promise<{ session: Session; tokens: SessionTokens }> {
  const [user] = await db.select().from(users).where(eq(users.email, input.email)).limit(1);

  // Same message for unknown email and wrong password: do not reveal account existence.
  if (!user || !(await verifyPassword(user.passwordHash, input.password))) {
    throw AppError.unauthenticated('Invalid email or password');
  }

  if (user.status !== 'active') {
    throw AppError.forbidden('This account is not active. Contact the platform administrator.');
  }

  const tokens = await issueTokens(user.id, user.role, meta);
  const session = await buildSession(user.id);

  return { session, tokens };
}

/** Reuse of an already-consumed token invalidates the entire rotation chain. */
async function revokeReusedFamily(tokenHash: string): Promise<void> {
  await db.transaction(async (tx) => {
    const [used] = await tx
      .select({ familyId: refreshTokens.familyId })
      .from(refreshTokens)
      .where(eq(refreshTokens.tokenHash, tokenHash))
      .limit(1);

    if (!used) return;

    await tx
      .update(refreshTokens)
      .set({ revokedAt: new Date() })
      .where(and(eq(refreshTokens.familyId, used.familyId), isNull(refreshTokens.revokedAt)));
  });
}

export async function rotateRefreshToken(
  rawToken: string,
  meta: RequestMeta,
): Promise<{ session: Session; tokens: SessionTokens }> {
  const tokenHash = hashToken(rawToken);

  let rotated: { user: User; refreshToken: string; refreshExpiresAt: Date };

  try {
    // Atomically consume the presented token. A single UPDATE ... RETURNING
    // ensures two concurrent refreshes cannot both mint a replacement session.
    rotated = await db.transaction(async (tx) => {
      const [stored] = await tx
        .update(refreshTokens)
        .set({ revokedAt: new Date() })
        .where(
          and(
            eq(refreshTokens.tokenHash, tokenHash),
            isNull(refreshTokens.revokedAt),
            gt(refreshTokens.expiresAt, new Date()),
          ),
        )
        .returning();

      if (!stored) {
        throw AppError.unauthenticated('Your session has expired. Please sign in again.');
      }

      const [user] = await tx.select().from(users).where(eq(users.id, stored.userId)).limit(1);
      if (!user || user.status !== 'active') {
        throw AppError.unauthenticated('Your session is no longer valid.');
      }

      const refreshToken = generateRefreshToken();
      const refreshExpiresAt = new Date(Date.now() + refreshTokenTtlMs);

      await tx.insert(refreshTokens).values({
        userId: user.id,
        familyId: stored.familyId,
        tokenHash: hashToken(refreshToken),
        expiresAt: refreshExpiresAt,
        userAgent: meta.userAgent ?? null,
        ip: meta.ip ?? null,
      });

      return { user, refreshToken, refreshExpiresAt };
    });
  } catch (error) {
    if (error instanceof AppError && error.statusCode === 401) {
      await revokeReusedFamily(tokenHash);
    }
    throw error;
  }

  const tokens = {
    accessToken: signAccessToken(rotated.user.id, rotated.user.role),
    refreshToken: rotated.refreshToken,
    refreshExpiresAt: rotated.refreshExpiresAt,
  };
  const session = await buildSession(rotated.user.id);

  return { session, tokens };
}

export async function revokeRefreshToken(rawToken: string): Promise<void> {
  await db
    .update(refreshTokens)
    .set({ revokedAt: new Date() })
    .where(and(eq(refreshTokens.tokenHash, hashToken(rawToken)), isNull(refreshTokens.revokedAt)));
}
