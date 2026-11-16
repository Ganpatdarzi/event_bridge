import { eq } from 'drizzle-orm';
import type { UpdateSocietyProfileInput } from '@event-bridge/shared';
import { db } from '../../db/index.js';
import { societies, users } from '../../db/schema/index.js';
import { writeAudit } from '../../lib/audit.js';
import { AppError } from '../../lib/errors.js';

export interface SocietyProfile {
  id: string;
  name: string;
  institution: string;
  contactPerson: string;
  contactEmail: string | null;
  contactPhone: string | null;
  description: string | null;
  createdAt: Date;
  updatedAt: Date;
  account: {
    id: string;
    name: string;
    email: string;
  };
}

export async function getSocietyProfile(userId: string): Promise<SocietyProfile> {
  const [row] = await db
    .select({
      id: societies.id,
      name: societies.name,
      institution: societies.institution,
      contactPerson: societies.contactPerson,
      contactEmail: societies.contactEmail,
      contactPhone: societies.contactPhone,
      description: societies.description,
      createdAt: societies.createdAt,
      updatedAt: societies.updatedAt,
      accountId: users.id,
      accountName: users.name,
      accountEmail: users.email,
    })
    .from(societies)
    .innerJoin(users, eq(users.id, societies.userId))
    .where(eq(societies.userId, userId))
    .limit(1);

  if (!row) {
    throw AppError.notFound('Society profile not found');
  }

  return {
    id: row.id,
    name: row.name,
    institution: row.institution,
    contactPerson: row.contactPerson,
    contactEmail: row.contactEmail,
    contactPhone: row.contactPhone,
    description: row.description,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    account: {
      id: row.accountId,
      name: row.accountName,
      email: row.accountEmail,
    },
  };
}

export async function updateSocietyProfile(
  userId: string,
  input: UpdateSocietyProfileInput,
): Promise<SocietyProfile> {
  const patch: Partial<typeof societies.$inferInsert> = { updatedAt: new Date() };
  const changedFields: string[] = [];

  if (input.societyName !== undefined) {
    patch.name = input.societyName;
    changedFields.push('societyName');
  }
  if (input.institution !== undefined) {
    patch.institution = input.institution;
    changedFields.push('institution');
  }
  if (input.contactPerson !== undefined) {
    patch.contactPerson = input.contactPerson;
    changedFields.push('contactPerson');
  }
  if (input.contactEmail !== undefined) {
    patch.contactEmail = input.contactEmail;
    changedFields.push('contactEmail');
  }
  if (input.contactPhone !== undefined) {
    patch.contactPhone = input.contactPhone;
    changedFields.push('contactPhone');
  }
  if (input.description !== undefined) {
    patch.description = input.description;
    changedFields.push('description');
  }

  const [updated] = await db
    .update(societies)
    .set(patch)
    .where(eq(societies.userId, userId))
    .returning({ id: societies.id });

  if (!updated) {
    throw AppError.notFound('Society profile not found');
  }

  await writeAudit({
    actorId: userId,
    action: 'society.profile_updated',
    targetType: 'society',
    targetId: updated.id,
    metadata: { fields: changedFields },
  });

  return getSocietyProfile(userId);
}
