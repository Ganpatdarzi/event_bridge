import { asc, eq, getTableColumns, sql } from 'drizzle-orm';
import type { CategoryCreateInput, CategoryUpdateInput } from '@event-bridge/shared';
import { db } from '../../db/index.js';
import { categories, serviceRequests, vendorCategories } from '../../db/schema/index.js';
import { writeAuditTx } from '../../lib/audit.js';
import { AppError, isUniqueViolation } from '../../lib/errors.js';
import { slugify } from '../../lib/slug.js';

export interface AdminCategory {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  isActive: boolean;
  sortOrder: number;
  createdAt: Date;
  updatedAt: Date;
  requestCount: number;
  vendorCount: number;
}

function duplicateCategory(): AppError {
  return AppError.conflict('DUPLICATE', 'A category with this name or slug already exists');
}

export async function listActiveCategories() {
  return db
    .select()
    .from(categories)
    .where(eq(categories.isActive, true))
    .orderBy(asc(categories.sortOrder), asc(categories.name));
}

export async function listAllCategories(): Promise<AdminCategory[]> {
  return db
    .select({
      ...getTableColumns(categories),
      requestCount: sql<number>`count(distinct ${serviceRequests.id})::int`,
      vendorCount: sql<number>`count(distinct ${vendorCategories.vendorId})::int`,
    })
    .from(categories)
    .leftJoin(serviceRequests, eq(serviceRequests.categoryId, categories.id))
    .leftJoin(vendorCategories, eq(vendorCategories.categoryId, categories.id))
    .groupBy(categories.id)
    .orderBy(asc(categories.sortOrder), asc(categories.name));
}

export async function createCategory(
  actorId: string,
  input: CategoryCreateInput,
): Promise<AdminCategory | undefined> {
  const slug = input.slug ?? slugify(input.name);

  if (!slug) {
    throw AppError.badRequest(
      'Could not derive a slug from this name. Provide an explicit slug using Latin letters, numbers and hyphens.',
    );
  }

  const id = await db.transaction(async (tx) => {
    let created: { id: string } | undefined;
    try {
      [created] = await tx
        .insert(categories)
        .values({
          name: input.name,
          slug,
          description: input.description ?? null,
          sortOrder: input.sortOrder,
          isActive: input.isActive,
        })
        .returning({ id: categories.id });
    } catch (error) {
      if (isUniqueViolation(error)) throw duplicateCategory();
      throw error;
    }

    if (!created) {
      throw new Error('Category insert returned no row');
    }

    await writeAuditTx(tx, {
      actorId,
      action: 'category.created',
      targetType: 'category',
      targetId: created.id,
      metadata: { name: input.name, slug, isActive: input.isActive },
    });

    return created.id;
  });

  return getAdminCategory(id);
}

export async function updateCategory(
  actorId: string,
  categoryId: string,
  input: CategoryUpdateInput,
): Promise<AdminCategory | undefined> {
  const [existing] = await db
    .select()
    .from(categories)
    .where(eq(categories.id, categoryId))
    .limit(1);

  if (!existing) {
    throw AppError.notFound('Category not found');
  }

  const patch: Partial<typeof categories.$inferInsert> = { updatedAt: new Date() };
  if (input.name !== undefined) patch.name = input.name;
  if (input.slug !== undefined) patch.slug = input.slug;
  if (input.description !== undefined) patch.description = input.description;
  if (input.sortOrder !== undefined) patch.sortOrder = input.sortOrder;

  try {
    await db.transaction(async (tx) => {
      await tx.update(categories).set(patch).where(eq(categories.id, categoryId));

      await writeAuditTx(tx, {
        actorId,
        action: 'category.updated',
        targetType: 'category',
        targetId: categoryId,
        metadata: {
          before: { name: existing.name, slug: existing.slug, sortOrder: existing.sortOrder },
          after: input,
        },
      });
    });
  } catch (error) {
    if (isUniqueViolation(error)) throw duplicateCategory();
    throw error;
  }

  return getAdminCategory(categoryId);
}

export async function setCategoryStatus(
  actorId: string,
  categoryId: string,
  isActive: boolean,
): Promise<AdminCategory | undefined> {
  const [existing] = await db
    .select()
    .from(categories)
    .where(eq(categories.id, categoryId))
    .limit(1);

  if (!existing) {
    throw AppError.notFound('Category not found');
  }

  if (existing.isActive !== isActive) {
    await db.transaction(async (tx) => {
      await tx
        .update(categories)
        .set({ isActive, updatedAt: new Date() })
        .where(eq(categories.id, categoryId));

      await writeAuditTx(tx, {
        actorId,
        action: isActive ? 'category.activated' : 'category.deactivated',
        targetType: 'category',
        targetId: categoryId,
        metadata: { name: existing.name },
      });
    });
  }

  return getAdminCategory(categoryId);
}

async function getAdminCategory(id: string): Promise<AdminCategory | undefined> {
  const [row] = await db
    .select({
      ...getTableColumns(categories),
      requestCount: sql<number>`count(distinct ${serviceRequests.id})::int`,
      vendorCount: sql<number>`count(distinct ${vendorCategories.vendorId})::int`,
    })
    .from(categories)
    .leftJoin(serviceRequests, eq(serviceRequests.categoryId, categories.id))
    .leftJoin(vendorCategories, eq(vendorCategories.categoryId, categories.id))
    .where(eq(categories.id, id))
    .groupBy(categories.id)
    .limit(1);

  return row;
}
