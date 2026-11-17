import { and, asc, desc, eq, gte, ilike, isNull, lte, or, sql, type SQL } from 'drizzle-orm';
import {
  canTransitionVendor,
  type AccountStatus,
  type AdminUserAction,
  type AdminVendorAction,
  type UserRole,
  type VendorStatus,
} from '@event-bridge/shared';
import { db } from '../../db/index.js';
import {
  auditLogs,
  categories,
  quotations,
  refreshTokens,
  reviews,
  serviceRequests,
  societies,
  systemSettings,
  users,
  vendorCategories,
  vendors,
} from '../../db/schema/index.js';
import { writeAuditTx } from '../../lib/audit.js';
import { AppError } from '../../lib/errors.js';
import {
  buildPagination,
  likePattern,
  type PageRequest,
  type PaginationMeta,
} from '../../lib/pagination.js';
import { loadCategoryMap, type VendorCategorySummary } from '../vendors/vendors.service.js';

export interface AdminVendorFilter extends PageRequest {
  status?: VendorStatus | undefined;
  search?: string | undefined;
}

export interface AdminVendor {
  id: string;
  businessName: string;
  description: string;
  city: string;
  serviceArea: string | null;
  contactPerson: string | null;
  contactPhone: string | null;
  verificationStatus: VendorStatus;
  rejectionReason: string | null;
  verifiedBy: string | null;
  verifiedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  categories: VendorCategorySummary[];
  user: {
    id: string;
    name: string;
    email: string;
    status: AccountStatus;
  };
}

export interface AdminUserFilter extends PageRequest {
  role?: UserRole | undefined;
  status?: AccountStatus | undefined;
  search?: string | undefined;
}

export interface AdminUser {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  status: AccountStatus;
  createdAt: Date;
  society: { id: string; name: string } | null;
  vendor: { id: string; businessName: string; verificationStatus: VendorStatus } | null;
}

export interface AuditLogFilter extends PageRequest {
  actorId?: string | undefined;
  action?: string | undefined;
  targetType?: string | undefined;
  targetId?: string | undefined;
  from?: Date | undefined;
  to?: Date | undefined;
}

export interface AuditLogEntry {
  id: string;
  action: string;
  targetType: string;
  targetId: string | null;
  metadata: unknown;
  createdAt: Date;
  actor: { id: string; name: string; email: string } | null;
}

const VENDOR_TARGET: Record<AdminVendorAction, VendorStatus> = {
  approve: 'verified',
  reject: 'rejected',
  request_changes: 'changes_requested',
  suspend: 'suspended',
  restore: 'verified',
};

const VENDOR_VERB: Record<AdminVendorAction, string> = {
  approve: 'approve',
  reject: 'reject',
  request_changes: 'request changes for',
  suspend: 'suspend',
  restore: 'restore',
};

const VENDOR_AUDIT_ACTION: Record<AdminVendorAction, string> = {
  approve: 'vendor.approved',
  reject: 'vendor.rejected',
  request_changes: 'vendor.changes_requested',
  suspend: 'vendor.suspended',
  restore: 'vendor.restored',
};

function vendorSelection() {
  return {
    id: vendors.id,
    businessName: vendors.businessName,
    description: vendors.description,
    city: vendors.city,
    serviceArea: vendors.serviceArea,
    contactPerson: vendors.contactPerson,
    contactPhone: vendors.contactPhone,
    verificationStatus: vendors.verificationStatus,
    rejectionReason: vendors.rejectionReason,
    verifiedBy: vendors.verifiedBy,
    verifiedAt: vendors.verifiedAt,
    createdAt: vendors.createdAt,
    updatedAt: vendors.updatedAt,
    userId: users.id,
    userName: users.name,
    userEmail: users.email,
    userStatus: users.status,
  };
}

async function getAdminVendor(vendorId: string): Promise<AdminVendor> {
  const [row] = await db
    .select(vendorSelection())
    .from(vendors)
    .innerJoin(users, eq(users.id, vendors.userId))
    .where(eq(vendors.id, vendorId))
    .limit(1);

  if (!row) {
    throw AppError.notFound('Vendor not found');
  }

  const categoryMap = await loadCategoryMap([row.id], false);

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
    verifiedBy: row.verifiedBy,
    verifiedAt: row.verifiedAt,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    categories: categoryMap.get(row.id) ?? [],
    user: {
      id: row.userId,
      name: row.userName,
      email: row.userEmail,
      status: row.userStatus,
    },
  };
}

export async function listVendorsForReview(
  filter: AdminVendorFilter,
): Promise<{ items: AdminVendor[]; pagination: PaginationMeta }> {
  const conditions: SQL[] = [];

  if (filter.status) {
    conditions.push(eq(vendors.verificationStatus, filter.status));
  }

  if (filter.search) {
    const pattern = likePattern(filter.search);
    const searchCondition = or(
      ilike(vendors.businessName, pattern),
      ilike(vendors.description, pattern),
      ilike(users.name, pattern),
      ilike(users.email, pattern),
    );
    if (searchCondition) conditions.push(searchCondition);
  }

  const where = conditions.length ? and(...conditions) : undefined;

  const [countRow] = await db
    .select({ total: sql<number>`count(*)::int` })
    .from(vendors)
    .innerJoin(users, eq(users.id, vendors.userId))
    .where(where);

  const rows = await db
    .select(vendorSelection())
    .from(vendors)
    .innerJoin(users, eq(users.id, vendors.userId))
    .where(where)
    .orderBy(
      sql`case
        when ${vendors.verificationStatus} = 'pending_review' then 0
        when ${vendors.verificationStatus} = 'changes_requested' then 1
        else 2
      end`,
      desc(vendors.createdAt),
    )
    .limit(filter.limit)
    .offset(filter.offset);

  const categoryMap = await loadCategoryMap(
    rows.map((row) => row.id),
    false,
  );

  const items = rows.map((row) => ({
    id: row.id,
    businessName: row.businessName,
    description: row.description,
    city: row.city,
    serviceArea: row.serviceArea,
    contactPerson: row.contactPerson,
    contactPhone: row.contactPhone,
    verificationStatus: row.verificationStatus,
    rejectionReason: row.rejectionReason,
    verifiedBy: row.verifiedBy,
    verifiedAt: row.verifiedAt,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    categories: categoryMap.get(row.id) ?? [],
    user: {
      id: row.userId,
      name: row.userName,
      email: row.userEmail,
      status: row.userStatus,
    },
  }));

  return {
    items,
    pagination: buildPagination(countRow?.total ?? 0, filter),
  };
}

export async function reviewVendor(
  actorId: string,
  vendorId: string,
  action: AdminVendorAction,
  reason?: string,
): Promise<AdminVendor> {
  const targetStatus = VENDOR_TARGET[action];

  await db.transaction(async (tx) => {
    const [vendor] = await tx
      .select()
      .from(vendors)
      .where(eq(vendors.id, vendorId))
      .for('update')
      .limit(1);

    if (!vendor) {
      throw AppError.notFound('Vendor not found');
    }

    if (!canTransitionVendor(vendor.verificationStatus, targetStatus)) {
      throw AppError.ruleViolation(
        `Cannot ${VENDOR_VERB[action]} a vendor that is ${vendor.verificationStatus.replaceAll('_', ' ')}.`,
        { from: vendor.verificationStatus, to: targetStatus },
      );
    }

    if (action === 'approve' || action === 'restore') {
      const [account] = await tx
        .select({ status: users.status })
        .from(users)
        .where(eq(users.id, vendor.userId))
        .limit(1);

      if (!account) {
        throw AppError.notFound('Vendor account not found');
      }

      if (account.status !== 'active') {
        throw AppError.ruleViolation(
          'Reactivate this vendor account before verifying the business.',
        );
      }

      const [categoryCount] = await tx
        .select({ count: sql<number>`count(*)::int` })
        .from(vendorCategories)
        .where(eq(vendorCategories.vendorId, vendor.id));

      if (!categoryCount?.count) {
        throw AppError.ruleViolation(
          'Assign at least one service category before verifying this vendor.',
        );
      }
    }

    const patch: Partial<typeof vendors.$inferInsert> = {
      verificationStatus: targetStatus,
      updatedAt: new Date(),
    };

    if (action === 'approve' || action === 'restore') {
      patch.verifiedBy = actorId;
      patch.verifiedAt = new Date();
      patch.rejectionReason = null;
    } else if (action === 'reject' || action === 'request_changes') {
      patch.rejectionReason = reason ?? null;
    } else if (action === 'suspend') {
      patch.rejectionReason = reason ?? null;
    }

    await tx.update(vendors).set(patch).where(eq(vendors.id, vendor.id));

    await writeAuditTx(tx, {
      actorId,
      action: VENDOR_AUDIT_ACTION[action],
      targetType: 'vendor',
      targetId: vendor.id,
      metadata: {
        from: vendor.verificationStatus,
        to: targetStatus,
        reason: reason ?? null,
        businessName: vendor.businessName,
      },
    });
  });

  return getAdminVendor(vendorId);
}

const userSelection = {
  id: users.id,
  name: users.name,
  email: users.email,
  role: users.role,
  status: users.status,
  createdAt: users.createdAt,
  societyId: societies.id,
  societyName: societies.name,
  vendorId: vendors.id,
  businessName: vendors.businessName,
  verificationStatus: vendors.verificationStatus,
} as const;

type UserRow = {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  status: AccountStatus;
  createdAt: Date;
  societyId: string | null;
  societyName: string | null;
  vendorId: string | null;
  businessName: string | null;
  verificationStatus: VendorStatus | null;
};

function toAdminUser(row: UserRow): AdminUser {
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    role: row.role,
    status: row.status,
    createdAt: row.createdAt,
    society: row.societyId && row.societyName ? { id: row.societyId, name: row.societyName } : null,
    vendor:
      row.vendorId && row.businessName && row.verificationStatus
        ? {
            id: row.vendorId,
            businessName: row.businessName,
            verificationStatus: row.verificationStatus,
          }
        : null,
  };
}

async function getAdminUser(userId: string): Promise<AdminUser> {
  const [row] = await db
    .select(userSelection)
    .from(users)
    .leftJoin(societies, eq(societies.userId, users.id))
    .leftJoin(vendors, eq(vendors.userId, users.id))
    .where(eq(users.id, userId))
    .limit(1);

  if (!row) {
    throw AppError.notFound('User not found');
  }

  return toAdminUser(row);
}

export async function listUsers(
  filter: AdminUserFilter,
): Promise<{ items: AdminUser[]; pagination: PaginationMeta }> {
  const conditions: SQL[] = [];

  if (filter.role) {
    conditions.push(eq(users.role, filter.role));
  }
  if (filter.status) {
    conditions.push(eq(users.status, filter.status));
  }
  if (filter.search) {
    const pattern = likePattern(filter.search);
    const searchCondition = or(
      ilike(users.name, pattern),
      ilike(users.email, pattern),
      ilike(societies.name, pattern),
      ilike(vendors.businessName, pattern),
    );
    if (searchCondition) conditions.push(searchCondition);
  }

  const where = conditions.length ? and(...conditions) : undefined;

  const [countRow] = await db
    .select({ total: sql<number>`count(*)::int` })
    .from(users)
    .leftJoin(societies, eq(societies.userId, users.id))
    .leftJoin(vendors, eq(vendors.userId, users.id))
    .where(where);

  const rows = await db
    .select(userSelection)
    .from(users)
    .leftJoin(societies, eq(societies.userId, users.id))
    .leftJoin(vendors, eq(vendors.userId, users.id))
    .where(where)
    .orderBy(desc(users.createdAt), asc(users.id))
    .limit(filter.limit)
    .offset(filter.offset);

  return {
    items: rows.map(toAdminUser),
    pagination: buildPagination(countRow?.total ?? 0, filter),
  };
}

const USER_TARGET: Record<AdminUserAction, AccountStatus> = {
  suspend: 'suspended',
  reactivate: 'active',
  deactivate: 'deactivated',
};

const USER_AUDIT_ACTION: Record<AdminUserAction, string> = {
  suspend: 'user.suspended',
  reactivate: 'user.reactivated',
  deactivate: 'user.deactivated',
};

export async function changeUserStatus(
  actorId: string,
  userId: string,
  action: AdminUserAction,
  reason?: string,
): Promise<AdminUser> {
  if (actorId === userId) {
    throw AppError.forbidden('You cannot change the status of your own account.');
  }

  const targetStatus = USER_TARGET[action];

  await db.transaction(async (tx) => {
    const [user] = await tx.select().from(users).where(eq(users.id, userId)).for('update').limit(1);

    if (!user) {
      throw AppError.notFound('User not found');
    }

    if (user.role === 'admin') {
      throw AppError.forbidden('Administrator accounts cannot be managed through this endpoint.');
    }

    if (action === 'suspend' && user.status !== 'active') {
      throw AppError.ruleViolation('Only active accounts can be suspended.', {
        currentStatus: user.status,
      });
    }
    if (action === 'reactivate' && user.status === 'active') {
      throw AppError.ruleViolation('This account is already active.', {
        currentStatus: user.status,
      });
    }
    if (action === 'deactivate' && user.status === 'deactivated') {
      throw AppError.ruleViolation('This account is already deactivated.', {
        currentStatus: user.status,
      });
    }

    await tx
      .update(users)
      .set({ status: targetStatus, updatedAt: new Date() })
      .where(eq(users.id, user.id));

    if (targetStatus !== 'active') {
      await tx
        .update(refreshTokens)
        .set({ revokedAt: new Date() })
        .where(and(eq(refreshTokens.userId, user.id), isNull(refreshTokens.revokedAt)));
    }

    let vendorChange: { from: VendorStatus; to: VendorStatus } | null = null;

    if (user.role === 'vendor') {
      const [vendor] = await tx
        .select({
          id: vendors.id,
          verificationStatus: vendors.verificationStatus,
        })
        .from(vendors)
        .where(eq(vendors.userId, user.id))
        .limit(1);

      if (vendor) {
        let nextVendorStatus: VendorStatus | null = null;

        if (action === 'suspend' && vendor.verificationStatus === 'verified') {
          nextVendorStatus = 'suspended';
        }
        if (
          action === 'deactivate' &&
          (vendor.verificationStatus === 'verified' || vendor.verificationStatus === 'suspended')
        ) {
          nextVendorStatus = 'deactivated';
        }

        if (nextVendorStatus) {
          await tx
            .update(vendors)
            .set({ verificationStatus: nextVendorStatus, updatedAt: new Date() })
            .where(eq(vendors.id, vendor.id));

          vendorChange = { from: vendor.verificationStatus, to: nextVendorStatus };
        }
      }
    }

    await writeAuditTx(tx, {
      actorId,
      action: USER_AUDIT_ACTION[action],
      targetType: 'user',
      targetId: user.id,
      metadata: {
        reason: reason ?? null,
        from: user.status,
        to: targetStatus,
        vendorStatus: vendorChange,
        email: user.email,
      },
    });
  });

  return getAdminUser(userId);
}

export async function listAuditLogs(
  filter: AuditLogFilter,
): Promise<{ items: AuditLogEntry[]; pagination: PaginationMeta }> {
  const conditions: SQL[] = [];

  if (filter.actorId) {
    conditions.push(eq(auditLogs.actorId, filter.actorId));
  }
  if (filter.action) {
    conditions.push(eq(auditLogs.action, filter.action));
  }
  if (filter.targetType) {
    conditions.push(eq(auditLogs.targetType, filter.targetType));
  }
  if (filter.targetId) {
    conditions.push(eq(auditLogs.targetId, filter.targetId));
  }
  if (filter.from) {
    conditions.push(gte(auditLogs.createdAt, filter.from));
  }
  if (filter.to) {
    conditions.push(lte(auditLogs.createdAt, filter.to));
  }

  const where = conditions.length ? and(...conditions) : undefined;

  const [countRow] = await db
    .select({ total: sql<number>`count(*)::int` })
    .from(auditLogs)
    .where(where);

  const rows = await db
    .select({
      id: auditLogs.id,
      action: auditLogs.action,
      targetType: auditLogs.targetType,
      targetId: auditLogs.targetId,
      metadata: auditLogs.metadata,
      createdAt: auditLogs.createdAt,
      actorId: users.id,
      actorName: users.name,
      actorEmail: users.email,
    })
    .from(auditLogs)
    .leftJoin(users, eq(users.id, auditLogs.actorId))
    .where(where)
    .orderBy(desc(auditLogs.createdAt), sql`${auditLogs.id} desc`)
    .limit(filter.limit)
    .offset(filter.offset);

  return {
    items: rows.map((row) => ({
      id: row.id,
      action: row.action,
      targetType: row.targetType,
      targetId: row.targetId,
      metadata: row.metadata,
      createdAt: row.createdAt,
      actor:
        row.actorId && row.actorName && row.actorEmail
          ? { id: row.actorId, name: row.actorName, email: row.actorEmail }
          : null,
    })),
    pagination: buildPagination(countRow?.total ?? 0, filter),
  };
}

function emptyCounts<T extends string>(keys: readonly T[]): Record<T, number> {
  return keys.reduce(
    (accumulator, key) => {
      accumulator[key] = 0;
      return accumulator;
    },
    {} as Record<T, number>,
  );
}

export async function getAdminStats() {
  const [roleRows, userStatusRows, vendorStatusRows, requestStatusRows, categoryRows, quoteRows] =
    await Promise.all([
      db
        .select({ role: users.role, count: sql<number>`count(*)::int` })
        .from(users)
        .groupBy(users.role),
      db
        .select({ status: users.status, count: sql<number>`count(*)::int` })
        .from(users)
        .groupBy(users.status),
      db
        .select({
          status: vendors.verificationStatus,
          count: sql<number>`count(*)::int`,
        })
        .from(vendors)
        .groupBy(vendors.verificationStatus),
      db
        .select({
          status: serviceRequests.status,
          count: sql<number>`count(*)::int`,
        })
        .from(serviceRequests)
        .groupBy(serviceRequests.status),
      db
        .select({
          total: sql<number>`count(*)::int`,
          active: sql<number>`(count(*) filter (where ${categories.isActive}))::int`,
        })
        .from(categories),
      db.select({ total: sql<number>`count(*)::int` }).from(quotations),
    ]);

  const byRole = emptyCounts(['society', 'vendor', 'admin'] as const);
  for (const row of roleRows) byRole[row.role] = row.count;

  const usersByStatus = emptyCounts(['active', 'suspended', 'deactivated'] as const);
  for (const row of userStatusRows) usersByStatus[row.status] = row.count;

  const vendorsByStatus = emptyCounts([
    'pending_review',
    'verified',
    'changes_requested',
    'rejected',
    'suspended',
    'deactivated',
  ] as const);
  for (const row of vendorStatusRows) vendorsByStatus[row.status] = row.count;

  const requestsByStatus = emptyCounts([
    'draft',
    'submitted',
    'open',
    'partially_quoted',
    'quoted',
    'selected',
    'completed',
    'closed',
    'cancelled',
  ] as const);
  for (const row of requestStatusRows) requestsByStatus[row.status] = row.count;

  return {
    users: {
      total: roleRows.reduce((sum, row) => sum + row.count, 0),
      byRole,
      byStatus: usersByStatus,
    },
    vendors: {
      total: vendorStatusRows.reduce((sum, row) => sum + row.count, 0),
      byStatus: vendorsByStatus,
    },
    requests: {
      total: requestStatusRows.reduce((sum, row) => sum + row.count, 0),
      byStatus: requestsByStatus,
    },
    categories: {
      total: categoryRows[0]?.total ?? 0,
      active: categoryRows[0]?.active ?? 0,
    },
    quotations: {
      total: quoteRows[0]?.total ?? 0,
    },
  };
}

/* ------------------------------------------------------------------ */
/* Review moderation                                                  */
/* ------------------------------------------------------------------ */

export interface AdminReviewFilter extends PageRequest {
  hidden?: boolean | undefined;
  vendorId?: string | undefined;
  search?: string | undefined;
}

export interface AdminReview {
  id: string;
  rating: number;
  comment: string | null;
  isHidden: boolean;
  createdAt: Date;
  society: { id: string; name: string };
  vendor: { id: string; businessName: string };
  request: { id: string; reference: string; title: string };
}

export async function listReviewsForAdmin(
  filter: AdminReviewFilter,
): Promise<{ items: AdminReview[]; pagination: PaginationMeta }> {
  const conditions: SQL[] = [];

  if (filter.hidden !== undefined) {
    conditions.push(eq(reviews.isHidden, filter.hidden));
  }
  if (filter.vendorId) {
    conditions.push(eq(reviews.vendorId, filter.vendorId));
  }
  if (filter.search) {
    const pattern = likePattern(filter.search);
    const searchCondition = or(
      ilike(vendors.businessName, pattern),
      ilike(societies.name, pattern),
      ilike(serviceRequests.title, pattern),
      ilike(reviews.comment, pattern),
    );
    if (searchCondition) conditions.push(searchCondition);
  }

  const where = conditions.length ? and(...conditions) : undefined;

  const [countRow] = await db
    .select({ total: sql<number>`count(*)::int` })
    .from(reviews)
    .innerJoin(societies, eq(societies.id, reviews.societyId))
    .innerJoin(vendors, eq(vendors.id, reviews.vendorId))
    .innerJoin(serviceRequests, eq(serviceRequests.id, reviews.requestId))
    .where(where);

  const rows = await db
    .select({
      id: reviews.id,
      rating: reviews.rating,
      comment: reviews.comment,
      isHidden: reviews.isHidden,
      createdAt: reviews.createdAt,
      societyId: societies.id,
      societyName: societies.name,
      vendorId: vendors.id,
      vendorName: vendors.businessName,
      requestId: serviceRequests.id,
      requestReference: serviceRequests.reference,
      requestTitle: serviceRequests.title,
    })
    .from(reviews)
    .innerJoin(societies, eq(societies.id, reviews.societyId))
    .innerJoin(vendors, eq(vendors.id, reviews.vendorId))
    .innerJoin(serviceRequests, eq(serviceRequests.id, reviews.requestId))
    .where(where)
    .orderBy(desc(reviews.createdAt))
    .limit(filter.limit)
    .offset(filter.offset);

  return {
    items: rows.map((row) => ({
      id: row.id,
      rating: row.rating,
      comment: row.comment,
      isHidden: row.isHidden,
      createdAt: row.createdAt,
      society: { id: row.societyId, name: row.societyName },
      vendor: { id: row.vendorId, businessName: row.vendorName },
      request: { id: row.requestId, reference: row.requestReference, title: row.requestTitle },
    })),
    pagination: buildPagination(countRow?.total ?? 0, filter),
  };
}

export async function moderateReview(
  actorId: string,
  reviewId: string,
  action: 'hide' | 'unhide',
  reason?: string,
): Promise<AdminReview> {
  await db.transaction(async (tx) => {
    const [review] = await tx
      .select()
      .from(reviews)
      .where(eq(reviews.id, reviewId))
      .for('update')
      .limit(1);

    if (!review) {
      throw AppError.notFound('Review not found');
    }

    const nextHidden = action === 'hide';
    if (review.isHidden === nextHidden) {
      throw AppError.ruleViolation(`This review is already ${nextHidden ? 'hidden' : 'visible'}.`);
    }

    await tx.update(reviews).set({ isHidden: nextHidden }).where(eq(reviews.id, review.id));

    await writeAuditTx(tx, {
      actorId,
      action: nextHidden ? 'review.hidden' : 'review.unhidden',
      targetType: 'review',
      targetId: review.id,
      metadata: { reason: reason ?? null, rating: review.rating },
    });
  });

  const { items } = await listReviewsForAdmin({
    page: 1,
    pageSize: 1,
    limit: 1000,
    offset: 0,
  });
  const found = items.find((item) => item.id === reviewId);
  if (!found) {
    throw AppError.notFound('Review not found');
  }
  return found;
}

/* ------------------------------------------------------------------ */
/* System settings                                                    */
/* ------------------------------------------------------------------ */

export interface SystemSettingView {
  key: string;
  value: string;
  updatedAt: Date;
  updatedBy: string | null;
}

export async function listSystemSettings(): Promise<SystemSettingView[]> {
  const rows = await db
    .select({
      key: systemSettings.key,
      value: systemSettings.value,
      updatedAt: systemSettings.updatedAt,
      updatedBy: systemSettings.updatedBy,
    })
    .from(systemSettings)
    .orderBy(systemSettings.key);

  return rows;
}

export async function upsertSystemSetting(
  actorId: string,
  key: string,
  value: string,
): Promise<SystemSettingView> {
  const [existing] = await db
    .select()
    .from(systemSettings)
    .where(eq(systemSettings.key, key))
    .limit(1);

  if (existing) {
    await db
      .update(systemSettings)
      .set({ value, updatedAt: new Date(), updatedBy: actorId })
      .where(eq(systemSettings.key, key));
  } else {
    await db.insert(systemSettings).values({ key, value, updatedBy: actorId });
  }

  await db.transaction(async (tx) => {
    await writeAuditTx(tx, {
      actorId,
      action: 'settings.updated',
      targetType: 'system_setting',
      targetId: key,
      metadata: { value },
    });
  });

  const [row] = await db
    .select({
      key: systemSettings.key,
      value: systemSettings.value,
      updatedAt: systemSettings.updatedAt,
      updatedBy: systemSettings.updatedBy,
    })
    .from(systemSettings)
    .where(eq(systemSettings.key, key))
    .limit(1);

  if (!row) {
    throw AppError.notFound('Setting not found');
  }
  return row;
}
