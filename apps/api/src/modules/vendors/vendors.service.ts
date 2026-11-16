import { and, asc, eq, ilike, inArray, or, sql, type SQL } from 'drizzle-orm';
import type { UpdateVendorProfileInput, VendorStatus } from '@event-bridge/shared';
import { db } from '../../db/index.js';
import { categories, reviews, users, vendorCategories, vendors } from '../../db/schema/index.js';
import { writeAuditTx } from '../../lib/audit.js';
import { AppError } from '../../lib/errors.js';
import { buildPagination, likePattern, type PageRequest } from '../../lib/pagination.js';

export interface VendorCategorySummary {
  id: string;
  name: string;
  slug: string;
}

export interface VendorRatingSummary {
  average: number | null;
  count: number;
}

export interface PublicVendorSummary {
  id: string;
  businessName: string;
  description: string;
  city: string;
  serviceArea: string | null;
  verifiedAt: Date | null;
  categories: VendorCategorySummary[];
  rating: VendorRatingSummary;
}

export interface PublicVendorDetail extends PublicVendorSummary {
  contactPerson: string | null;
  contactPhone: string | null;
  contactEmail: string;
}

export interface MyVendorProfile {
  id: string;
  businessName: string;
  description: string;
  city: string;
  serviceArea: string | null;
  contactPerson: string | null;
  contactPhone: string | null;
  verificationStatus: VendorStatus;
  rejectionReason: string | null;
  verifiedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  categories: VendorCategorySummary[];
  rating: VendorRatingSummary;
  account: {
    id: string;
    name: string;
    email: string;
  };
}

export interface VendorDirectoryFilter extends PageRequest {
  search?: string | undefined;
  city?: string | undefined;
  category?: string | undefined;
}

export async function loadCategoryMap(
  vendorIds: string[],
  activeOnly: boolean,
): Promise<Map<string, VendorCategorySummary[]>> {
  const map = new Map<string, VendorCategorySummary[]>();
  if (!vendorIds.length) return map;

  const conditions: SQL[] = [inArray(vendorCategories.vendorId, vendorIds)];
  if (activeOnly) {
    conditions.push(eq(categories.isActive, true));
  }

  const rows = await db
    .select({
      vendorId: vendorCategories.vendorId,
      id: categories.id,
      name: categories.name,
      slug: categories.slug,
    })
    .from(vendorCategories)
    .innerJoin(categories, eq(categories.id, vendorCategories.categoryId))
    .where(and(...conditions))
    .orderBy(asc(categories.sortOrder), asc(categories.name));

  for (const row of rows) {
    const list = map.get(row.vendorId) ?? [];
    list.push({ id: row.id, name: row.name, slug: row.slug });
    map.set(row.vendorId, list);
  }

  return map;
}

async function loadRatingMap(vendorIds: string[]): Promise<Map<string, VendorRatingSummary>> {
  const map = new Map<string, VendorRatingSummary>();
  if (!vendorIds.length) return map;

  const rows = await db
    .select({
      vendorId: reviews.vendorId,
      average: sql<number | null>`avg(${reviews.rating})::float`,
      count: sql<number>`count(*)::int`,
    })
    .from(reviews)
    .where(and(inArray(reviews.vendorId, vendorIds), eq(reviews.isHidden, false)))
    .groupBy(reviews.vendorId);

  for (const row of rows) {
    map.set(row.vendorId, { average: row.average, count: row.count });
  }

  return map;
}

function emptyRating(): VendorRatingSummary {
  return { average: null, count: 0 };
}

export async function listPublicVendors(
  filter: VendorDirectoryFilter,
): Promise<{ items: PublicVendorSummary[]; pagination: ReturnType<typeof buildPagination> }> {
  const conditions: SQL[] = [
    eq(users.status, 'active'),
    eq(vendors.verificationStatus, 'verified'),
  ];

  if (filter.city) {
    conditions.push(ilike(vendors.city, likePattern(filter.city)));
  }

  if (filter.search) {
    const pattern = likePattern(filter.search);
    const searchCondition = or(
      ilike(vendors.businessName, pattern),
      ilike(vendors.description, pattern),
      ilike(vendors.city, pattern),
    );
    if (searchCondition) conditions.push(searchCondition);
  }

  if (filter.category) {
    conditions.push(
      inArray(
        vendors.id,
        db
          .select({ id: vendorCategories.vendorId })
          .from(vendorCategories)
          .innerJoin(categories, eq(categories.id, vendorCategories.categoryId))
          .where(and(eq(categories.slug, filter.category), eq(categories.isActive, true))),
      ),
    );
  }

  const where = and(...conditions);

  const [countRow] = await db
    .select({ total: sql<number>`count(*)::int` })
    .from(vendors)
    .innerJoin(users, eq(users.id, vendors.userId))
    .where(where);

  const rows = await db
    .select({
      id: vendors.id,
      businessName: vendors.businessName,
      description: vendors.description,
      city: vendors.city,
      serviceArea: vendors.serviceArea,
      verifiedAt: vendors.verifiedAt,
    })
    .from(vendors)
    .innerJoin(users, eq(users.id, vendors.userId))
    .where(where)
    .orderBy(asc(vendors.businessName), asc(vendors.id))
    .limit(filter.limit)
    .offset(filter.offset);

  const ids = rows.map((row) => row.id);
  const [categoryMap, ratingMap] = await Promise.all([
    loadCategoryMap(ids, true),
    loadRatingMap(ids),
  ]);

  const items = rows.map((row) => ({
    id: row.id,
    businessName: row.businessName,
    description: row.description,
    city: row.city,
    serviceArea: row.serviceArea,
    verifiedAt: row.verifiedAt,
    categories: categoryMap.get(row.id) ?? [],
    rating: ratingMap.get(row.id) ?? emptyRating(),
  }));

  return {
    items,
    pagination: buildPagination(countRow?.total ?? 0, filter),
  };
}

export async function getPublicVendor(vendorId: string): Promise<PublicVendorDetail> {
  const [row] = await db
    .select({
      id: vendors.id,
      businessName: vendors.businessName,
      description: vendors.description,
      city: vendors.city,
      serviceArea: vendors.serviceArea,
      contactPerson: vendors.contactPerson,
      contactPhone: vendors.contactPhone,
      contactEmail: users.email,
      verifiedAt: vendors.verifiedAt,
    })
    .from(vendors)
    .innerJoin(users, eq(users.id, vendors.userId))
    .where(
      and(
        eq(vendors.id, vendorId),
        eq(users.status, 'active'),
        eq(vendors.verificationStatus, 'verified'),
      ),
    )
    .limit(1);

  if (!row) {
    throw AppError.notFound('Vendor not found');
  }

  const [categoryMap, ratingMap] = await Promise.all([
    loadCategoryMap([row.id], true),
    loadRatingMap([row.id]),
  ]);

  return {
    ...row,
    categories: categoryMap.get(row.id) ?? [],
    rating: ratingMap.get(row.id) ?? emptyRating(),
  };
}

export async function getMyVendorProfile(userId: string): Promise<MyVendorProfile> {
  const [row] = await db
    .select({
      id: vendors.id,
      businessName: vendors.businessName,
      description: vendors.description,
      city: vendors.city,
      serviceArea: vendors.serviceArea,
      contactPerson: vendors.contactPerson,
      contactPhone: vendors.contactPhone,
      verificationStatus: vendors.verificationStatus,
      rejectionReason: vendors.rejectionReason,
      verifiedAt: vendors.verifiedAt,
      createdAt: vendors.createdAt,
      updatedAt: vendors.updatedAt,
      accountId: users.id,
      accountName: users.name,
      accountEmail: users.email,
    })
    .from(vendors)
    .innerJoin(users, eq(users.id, vendors.userId))
    .where(eq(vendors.userId, userId))
    .limit(1);

  if (!row) {
    throw AppError.notFound('Vendor profile not found');
  }

  const [categoryMap, ratingMap] = await Promise.all([
    loadCategoryMap([row.id], false),
    loadRatingMap([row.id]),
  ]);

  return {
    id: row.id,
    businessName: row.businessName,
    description: row.description,
    city: row.city,
    serviceArea: row.serviceArea,
    contactPerson: row.contactPerson,
    contactPhone: row.contactPhone,
    verificationStatus: row.verificationStatus,
    rejectionReason: row.rejectionReason,
    verifiedAt: row.verifiedAt,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    categories: categoryMap.get(row.id) ?? [],
    rating: ratingMap.get(row.id) ?? emptyRating(),
    account: {
      id: row.accountId,
      name: row.accountName,
      email: row.accountEmail,
    },
  };
}

export async function updateMyVendorProfile(
  userId: string,
  input: UpdateVendorProfileInput,
): Promise<MyVendorProfile> {
  await db.transaction(async (tx) => {
    const [vendor] = await tx
      .select()
      .from(vendors)
      .where(eq(vendors.userId, userId))
      .for('update')
      .limit(1);

    if (!vendor) {
      throw AppError.notFound('Vendor profile not found');
    }

    if (vendor.verificationStatus === 'deactivated') {
      throw AppError.ruleViolation(
        'This vendor profile is deactivated and can no longer be edited.',
      );
    }

    const patch: Partial<typeof vendors.$inferInsert> = { updatedAt: new Date() };
    const changedFields: string[] = [];

    if (input.businessName !== undefined) {
      patch.businessName = input.businessName;
      changedFields.push('businessName');
    }
    if (input.description !== undefined) {
      patch.description = input.description;
      changedFields.push('description');
    }
    if (input.city !== undefined) {
      patch.city = input.city;
      changedFields.push('city');
    }
    if (input.serviceArea !== undefined) {
      patch.serviceArea = input.serviceArea;
      changedFields.push('serviceArea');
    }
    if (input.contactPerson !== undefined) {
      patch.contactPerson = input.contactPerson;
      changedFields.push('contactPerson');
    }
    if (input.contactPhone !== undefined) {
      patch.contactPhone = input.contactPhone;
      changedFields.push('contactPhone');
    }

    let resubmitted = false;
    if (
      vendor.verificationStatus === 'changes_requested' ||
      vendor.verificationStatus === 'rejected'
    ) {
      patch.verificationStatus = 'pending_review';
      patch.rejectionReason = null;
      resubmitted = true;
    }

    await tx.update(vendors).set(patch).where(eq(vendors.id, vendor.id));

    if (input.categoryIds !== undefined) {
      const unique = [...new Set(input.categoryIds)];

      if (unique.length) {
        const rows = await tx
          .select({ id: categories.id, isActive: categories.isActive })
          .from(categories)
          .where(inArray(categories.id, unique));

        if (rows.length !== unique.length) {
          throw AppError.badRequest('One or more selected service categories do not exist');
        }
        if (rows.some((row) => !row.isActive)) {
          throw AppError.badRequest('One or more selected service categories are not available');
        }
      }

      await tx.delete(vendorCategories).where(eq(vendorCategories.vendorId, vendor.id));
      if (unique.length) {
        await tx.insert(vendorCategories).values(
          unique.map((categoryId) => ({
            vendorId: vendor.id,
            categoryId,
          })),
        );
      }
      changedFields.push('categoryIds');
    }

    await writeAuditTx(tx, {
      actorId: userId,
      action: 'vendor.profile_updated',
      targetType: 'vendor',
      targetId: vendor.id,
      metadata: { fields: changedFields, resubmitted },
    });
  });

  return getMyVendorProfile(userId);
}
