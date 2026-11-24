import { and, asc, desc, eq, ilike, inArray, ne, or, sql, type SQL } from 'drizzle-orm';
import {
  canTransitionRequest,
  REQUEST_ACCEPTS_QUOTES,
  REQUEST_EDITABLE,
  type CreateRequestInput,
  type NotificationType,
  type RequestStatus,
  type UpdateRequestInput,
  type UserRole,
} from '@event-bridge/shared';
import { db } from '../../db/index.js';
import {
  bookings,
  categories,
  events,
  notifications,
  quotations,
  requestVendors,
  serviceRequests,
  societies,
  vendors,
} from '../../db/schema/index.js';
import { writeAuditTx } from '../../lib/audit.js';
import { AppError } from '../../lib/errors.js';
import { notifyBestEffort } from '../../lib/notifications.js';
import { buildPagination, likePattern, type PageRequest } from '../../lib/pagination.js';
import { makeReference } from '../../lib/reference.js';
import type { Transaction } from '../../lib/transaction.js';
import { findEligibleVendors } from './matching.js';

export type RequestSort = 'newest' | 'oldest' | 'deadline';

export interface RequestViewer {
  id: string;
  role: UserRole;
}

export interface RequestListFilters extends PageRequest {
  status?: RequestStatus | undefined;
  categoryId?: string | undefined;
  search?: string | undefined;
  societyId?: string | undefined;
  sort: RequestSort;
}

export interface VendorRequestFilters extends PageRequest {
  categoryId?: string | undefined;
  search?: string | undefined;
  sort: RequestSort;
}

interface EventSummary {
  id: string;
  name: string;
  eventDate: string;
  location: string;
  expectedAttendance: number | null;
}

interface CategorySummary {
  id: string;
  name: string;
  slug: string;
}

interface SocietySummary {
  id: string;
  name: string;
  institution: string;
  contactPerson?: string | null;
  contactEmail?: string | null;
  contactPhone?: string | null;
}

export interface RequestPermissions {
  canEdit: boolean;
  canSubmit: boolean;
  canCancel: boolean;
  canClose: boolean;
  canViewVendors: boolean;
}

export interface RequestDetail {
  id: string;
  reference: string;
  title: string;
  description: string;
  status: RequestStatus;
  budgetMin: number | null;
  budgetMax: number | null;
  quantity: number | null;
  responseDeadline: Date | null;
  category: CategorySummary;
  event: EventSummary | null;
  society: SocietySummary;
  counts: {
    invitedVendors: number;
    quotations: number;
  };
  permissions: RequestPermissions;
  distribution?: {
    status: 'invited' | 'viewed' | 'responded' | 'declined';
    viewedAt: Date | null;
    notifiedAt: Date | null;
  };
  selectedQuotationId?: string | null;
  cancelledBy?: string | null;
  cancelledAt?: Date | null;
  cancellationReason?: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface BookingSummary {
  id: string;
  quotationId: string;
  vendorId: string;
  status: 'confirmed' | 'cancelled' | 'completed';
  startsAt: Date;
  endsAt: Date;
  amount: number;
  currency: string;
}

export interface RequestListItem {
  id: string;
  reference: string;
  title: string;
  status: RequestStatus;
  category: CategorySummary;
  event: EventSummary | null;
  society: {
    id: string;
    name: string;
    institution: string;
  };
  budgetMin: number | null;
  budgetMax: number | null;
  responseDeadline: Date | null;
  invitationCount: number;
  quotationCount: number;
  booking?: BookingSummary | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface VendorRequestListItem extends RequestListItem {
  description: string;
  quantity: number | null;
  distribution: {
    status: 'invited' | 'viewed' | 'responded' | 'declined';
    viewedAt: Date | null;
    notifiedAt: Date | null;
  };
  hasQuoted: boolean;
}

export interface RequestVendorListItem {
  vendorId: string;
  businessName: string;
  city: string;
  verificationStatus: string;
  distributionStatus: 'invited' | 'viewed' | 'responded' | 'declined';
  viewedAt: Date | null;
  notifiedAt: Date | null;
}

const OWNER_CANCELLABLE: RequestStatus[] = [
  'draft',
  'submitted',
  'open',
  'partially_quoted',
  'quoted',
];

const ADMIN_CANCELLABLE: RequestStatus[] = [...OWNER_CANCELLABLE, 'selected'];

const CLOSABLE: RequestStatus[] = ['open', 'partially_quoted', 'quoted', 'completed'];

function asMoney(value: number | null | undefined): string | null | undefined {
  if (value === undefined) return undefined;
  if (value === null) return null;
  return value.toFixed(2);
}

function toNumber(value: string | null): number | null {
  return value === null ? null : Number(value);
}

function buildPermissions(
  role: UserRole,
  isOwner: boolean,
  status: RequestStatus,
): RequestPermissions {
  const owner = role === 'society' && isOwner;
  const admin = role === 'admin';

  return {
    canEdit: owner && REQUEST_EDITABLE.includes(status),
    canSubmit: owner && status === 'draft',
    canCancel:
      (owner && OWNER_CANCELLABLE.includes(status)) ||
      (admin && ADMIN_CANCELLABLE.includes(status)),
    canClose: (owner || admin) && CLOSABLE.includes(status),
    canViewVendors: owner || admin,
  };
}

function requestOrder(sort: RequestSort): SQL[] {
  switch (sort) {
    case 'oldest':
      return [asc(serviceRequests.createdAt), asc(serviceRequests.id)];
    case 'deadline':
      return [
        sql`${serviceRequests.responseDeadline} asc nulls last`,
        desc(serviceRequests.createdAt),
      ];
    case 'newest':
    default:
      return [desc(serviceRequests.createdAt), desc(serviceRequests.id)];
  }
}

function vendorBoardOrder(sort: RequestSort): SQL[] {
  switch (sort) {
    case 'oldest':
      return [asc(serviceRequests.createdAt), asc(serviceRequests.id)];
    case 'newest':
      return [desc(serviceRequests.createdAt), desc(serviceRequests.id)];
    case 'deadline':
    default:
      return [
        sql`${serviceRequests.responseDeadline} asc nulls last`,
        desc(serviceRequests.createdAt),
      ];
  }
}

async function getSocietyByUser(userId: string): Promise<{
  id: string;
  name: string;
  institution: string;
}> {
  const [society] = await db
    .select({ id: societies.id, name: societies.name, institution: societies.institution })
    .from(societies)
    .where(eq(societies.userId, userId))
    .limit(1);

  if (!society) {
    throw AppError.notFound('Society profile not found');
  }

  return society;
}

async function getActiveCategoryTx(
  tx: Transaction,
  categoryId: string,
): Promise<typeof categories.$inferSelect> {
  const [category] = await tx
    .select()
    .from(categories)
    .where(eq(categories.id, categoryId))
    .limit(1);

  if (!category) {
    throw AppError.badRequest('The selected category does not exist');
  }
  if (!category.isActive) {
    throw AppError.badRequest('The selected category is not available');
  }

  return category;
}

async function getOwnedEventTx(
  tx: Transaction,
  eventId: string,
  societyId: string,
): Promise<typeof events.$inferSelect> {
  const [event] = await tx
    .select()
    .from(events)
    .where(and(eq(events.id, eventId), eq(events.societyId, societyId)))
    .limit(1);

  if (!event) {
    throw AppError.badRequest('The selected event does not exist');
  }

  return event;
}

function assertSubmittable(
  request: typeof serviceRequests.$inferSelect,
  category: typeof categories.$inferSelect,
  event: typeof events.$inferSelect | null,
): void {
  if (!category.isActive) {
    throw AppError.ruleViolation('The selected category is no longer available');
  }

  if (!event) {
    throw AppError.ruleViolation('Attach an event before submitting the request');
  }

  const today = new Date().toISOString().slice(0, 10);
  if (event.eventDate < today) {
    throw AppError.ruleViolation('The event date has already passed');
  }

  if (!request.responseDeadline) {
    throw AppError.ruleViolation('Set a response deadline before submitting the request');
  }

  if (request.responseDeadline.getTime() <= Date.now()) {
    throw AppError.ruleViolation('The response deadline must be in the future');
  }

  if (request.responseDeadline.toISOString().slice(0, 10) > event.eventDate) {
    throw AppError.ruleViolation('The response deadline cannot be after the event date');
  }

  if (
    request.budgetMin !== null &&
    request.budgetMax !== null &&
    Number(request.budgetMin) > Number(request.budgetMax)
  ) {
    throw AppError.ruleViolation('The minimum budget cannot exceed the maximum budget');
  }
}

async function insertRequestNotificationsTx(
  tx: Transaction,
  requestId: string,
  payload: {
    type: NotificationType;
    title: string;
    body: string;
    link: string;
  },
): Promise<void> {
  const recipients = await tx
    .select({ userId: vendors.userId })
    .from(requestVendors)
    .innerJoin(vendors, eq(vendors.id, requestVendors.vendorId))
    .where(eq(requestVendors.requestId, requestId));

  if (!recipients.length) return;

  await tx.insert(notifications).values(
    recipients.map((recipient) => ({
      userId: recipient.userId,
      type: payload.type,
      title: payload.title,
      body: payload.body,
      link: payload.link,
    })),
  );
}

/**
 * Shared by POST /requests/:id/submit and by "create and submit" so both paths
 * validate and distribute atomically.
 */
async function submitRequestTx(tx: Transaction, requestId: string, actorId: string): Promise<void> {
  const [request] = await tx
    .select()
    .from(serviceRequests)
    .where(eq(serviceRequests.id, requestId))
    .for('update')
    .limit(1);

  if (!request) {
    throw AppError.notFound('Request not found');
  }

  const [society] = await tx
    .select({ id: societies.id, name: societies.name, userId: societies.userId })
    .from(societies)
    .where(eq(societies.id, request.societyId))
    .limit(1);

  if (!society || society.userId !== actorId) {
    throw AppError.notFound('Request not found');
  }

  if (request.status !== 'draft') {
    throw AppError.conflict('CONFLICT', 'Only draft requests can be submitted');
  }

  const category = await getActiveCategoryTx(tx, request.categoryId);
  const event = request.eventId
    ? await getOwnedEventTx(tx, request.eventId, request.societyId)
    : null;

  assertSubmittable(request, category, event);

  await tx
    .update(serviceRequests)
    .set({ status: 'submitted', updatedAt: new Date() })
    .where(eq(serviceRequests.id, request.id));

  const matched = await findEligibleVendors(tx, request.categoryId);

  const now = new Date();

  if (matched.length) {
    await tx
      .insert(requestVendors)
      .values(
        matched.map((vendor) => ({
          requestId: request.id,
          vendorId: vendor.id,
          notifiedAt: now,
        })),
      )
      .onConflictDoNothing();

    const deadline = request.responseDeadline
      ? request.responseDeadline.toISOString().slice(0, 10)
      : null;

    await tx.insert(notifications).values(
      matched.map((vendor) => ({
        userId: vendor.userId,
        type: 'request_new' as const,
        title: `New ${category.name} request`,
        body: `${society.name} needs "${request.title}" for ${event?.name ?? 'an event'}${
          deadline ? ` (quotes close ${deadline})` : ''
        }.`,
        link: '/vendor',
      })),
    );
  }

  await tx
    .update(serviceRequests)
    .set({ status: 'open', updatedAt: new Date() })
    .where(eq(serviceRequests.id, request.id));

  await writeAuditTx(tx, {
    actorId,
    action: 'request.submitted',
    targetType: 'request',
    targetId: request.id,
    metadata: { matchedVendors: matched.length },
  });
}

export async function createServiceRequest(
  actorId: string,
  input: CreateRequestInput,
): Promise<RequestDetail> {
  const requestId = await db.transaction(async (tx) => {
    const [society] = await tx
      .select({ id: societies.id })
      .from(societies)
      .where(eq(societies.userId, actorId))
      .limit(1);

    if (!society) {
      throw AppError.notFound('Society profile not found');
    }

    const category = await getActiveCategoryTx(tx, input.categoryId);

    let eventId: string | null = null;
    if (input.eventId !== undefined) {
      const event = await getOwnedEventTx(tx, input.eventId, society.id);
      eventId = event.id;
    } else if (input.event !== undefined) {
      const [event] = await tx
        .insert(events)
        .values({
          societyId: society.id,
          name: input.event.name,
          eventDate: input.event.eventDate,
          location: input.event.location,
          expectedAttendance: input.event.expectedAttendance ?? null,
        })
        .returning({ id: events.id });

      if (!event) {
        throw new Error('Failed to create the event');
      }
      eventId = event.id;
    }

    if (!eventId) {
      throw AppError.badRequest('Provide event details or an existing eventId');
    }

    if (
      input.budgetMin !== null &&
      input.budgetMin !== undefined &&
      input.budgetMax !== null &&
      input.budgetMax !== undefined &&
      input.budgetMin > input.budgetMax
    ) {
      throw AppError.badRequest('The minimum budget cannot exceed the maximum budget');
    }

    const [created] = await tx
      .insert(serviceRequests)
      .values({
        reference: makeReference('R'),
        societyId: society.id,
        eventId,
        categoryId: category.id,
        title: input.title,
        description: input.description,
        budgetMin: asMoney(input.budgetMin) ?? null,
        budgetMax: asMoney(input.budgetMax) ?? null,
        quantity: input.quantity ?? null,
        responseDeadline: input.responseDeadline ? new Date(input.responseDeadline) : null,
        status: 'draft',
      })
      .returning({ id: serviceRequests.id });

    if (!created) {
      throw new Error('Failed to create the request');
    }

    await writeAuditTx(tx, {
      actorId,
      action: 'request.created',
      targetType: 'request',
      targetId: created.id,
      metadata: { categoryId: category.id, eventId },
    });

    if (input.submit) {
      await submitRequestTx(tx, created.id, actorId);
    }

    return created.id;
  });

  return getRequestDetail({ id: actorId, role: 'society' }, requestId);
}

export async function submitRequest(actorId: string, requestId: string): Promise<RequestDetail> {
  await db.transaction(async (tx) => {
    await submitRequestTx(tx, requestId, actorId);
  });

  return getRequestDetail({ id: actorId, role: 'society' }, requestId);
}

export async function getRequestDetail(
  viewer: RequestViewer,
  requestId: string,
): Promise<RequestDetail> {
  const [row] = await db
    .select({
      id: serviceRequests.id,
      reference: serviceRequests.reference,
      title: serviceRequests.title,
      description: serviceRequests.description,
      status: serviceRequests.status,
      budgetMin: serviceRequests.budgetMin,
      budgetMax: serviceRequests.budgetMax,
      quantity: serviceRequests.quantity,
      responseDeadline: serviceRequests.responseDeadline,
      selectedQuotationId: serviceRequests.selectedQuotationId,
      cancelledBy: serviceRequests.cancelledBy,
      cancelledAt: serviceRequests.cancelledAt,
      cancellationReason: serviceRequests.cancellationReason,
      createdAt: serviceRequests.createdAt,
      updatedAt: serviceRequests.updatedAt,
      societyId: societies.id,
      societyUserId: societies.userId,
      societyName: societies.name,
      societyInstitution: societies.institution,
      societyContactPerson: societies.contactPerson,
      societyContactEmail: societies.contactEmail,
      societyContactPhone: societies.contactPhone,
      categoryId: categories.id,
      categoryName: categories.name,
      categorySlug: categories.slug,
      eventId: events.id,
      eventName: events.name,
      eventDate: events.eventDate,
      eventLocation: events.location,
      eventAttendance: events.expectedAttendance,
    })
    .from(serviceRequests)
    .innerJoin(societies, eq(societies.id, serviceRequests.societyId))
    .innerJoin(categories, eq(categories.id, serviceRequests.categoryId))
    .leftJoin(events, eq(events.id, serviceRequests.eventId))
    .where(eq(serviceRequests.id, requestId))
    .limit(1);

  if (!row) {
    throw AppError.notFound('Request not found');
  }

  const isOwner = viewer.role === 'society' && row.societyUserId === viewer.id;
  if (viewer.role === 'society' && !isOwner) {
    throw AppError.notFound('Request not found');
  }

  let viewerVendorId: string | null = null;
  let distribution: RequestDetail['distribution'];

  if (viewer.role === 'vendor') {
    const [vendor] = await db
      .select({ id: vendors.id })
      .from(vendors)
      .where(eq(vendors.userId, viewer.id))
      .limit(1);

    if (!vendor) {
      throw AppError.notFound('Request not found');
    }

    const [assignment] = await db
      .select()
      .from(requestVendors)
      .where(and(eq(requestVendors.requestId, requestId), eq(requestVendors.vendorId, vendor.id)))
      .limit(1);

    if (!assignment) {
      throw AppError.notFound('Request not found');
    }

    viewerVendorId = vendor.id;
    const viewedAt = assignment.viewedAt ?? new Date();

    if (!assignment.viewedAt) {
      await db
        .update(requestVendors)
        .set({
          viewedAt,
          distributionStatus:
            assignment.distributionStatus === 'invited' ? 'viewed' : assignment.distributionStatus,
        })
        .where(eq(requestVendors.id, assignment.id));
    }

    distribution = {
      status:
        assignment.distributionStatus === 'invited' && !assignment.viewedAt
          ? 'viewed'
          : assignment.distributionStatus,
      viewedAt,
      notifiedAt: assignment.notifiedAt,
    };
  }

  let selectedVendorId: string | null = null;
  if (row.selectedQuotationId) {
    const [selected] = await db
      .select({ vendorId: quotations.vendorId })
      .from(quotations)
      .where(and(eq(quotations.id, row.selectedQuotationId), eq(quotations.requestId, requestId)))
      .limit(1);
    selectedVendorId = selected?.vendorId ?? null;
  }

  const [invitationCount] = await db
    .select({ total: sql<number>`count(*)::int` })
    .from(requestVendors)
    .where(eq(requestVendors.requestId, requestId));

  const [quotationCount] = await db
    .select({ total: sql<number>`count(*)::int` })
    .from(quotations)
    .where(and(eq(quotations.requestId, requestId), ne(quotations.status, 'withdrawn')));

  const isAdmin = viewer.role === 'admin';
  const seesInternal = isOwner || isAdmin;
  const seesContact =
    seesInternal ||
    (viewer.role === 'vendor' &&
      viewerVendorId !== null &&
      viewerVendorId === selectedVendorId &&
      ['selected', 'completed', 'closed'].includes(row.status));

  const detail: RequestDetail = {
    id: row.id,
    reference: row.reference,
    title: row.title,
    description: row.description,
    status: row.status,
    budgetMin: toNumber(row.budgetMin),
    budgetMax: toNumber(row.budgetMax),
    quantity: row.quantity,
    responseDeadline: row.responseDeadline,
    category: {
      id: row.categoryId,
      name: row.categoryName,
      slug: row.categorySlug,
    },
    event: row.eventId
      ? {
          id: row.eventId,
          name: row.eventName as string,
          eventDate: row.eventDate as string,
          location: row.eventLocation as string,
          expectedAttendance: row.eventAttendance,
        }
      : null,
    society: {
      id: row.societyId,
      name: row.societyName,
      institution: row.societyInstitution,
      ...(seesContact
        ? {
            contactPerson: row.societyContactPerson,
            contactEmail: row.societyContactEmail,
            contactPhone: row.societyContactPhone,
          }
        : {}),
    },
    counts: {
      invitedVendors: invitationCount?.total ?? 0,
      quotations: quotationCount?.total ?? 0,
    },
    permissions: buildPermissions(viewer.role, isOwner, row.status),
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };

  if (distribution) {
    detail.distribution = distribution;
  }

  if (seesInternal) {
    detail.selectedQuotationId = row.selectedQuotationId;
    detail.cancelledBy = row.cancelledBy;
    detail.cancelledAt = row.cancelledAt;
    detail.cancellationReason = row.cancellationReason;
  }

  return detail;
}

export async function listRequests(
  viewer: RequestViewer,
  filter: RequestListFilters,
): Promise<{ items: RequestListItem[]; pagination: ReturnType<typeof buildPagination> }> {
  const conditions: SQL[] = [];

  if (viewer.role === 'society') {
    const society = await getSocietyByUser(viewer.id);
    conditions.push(eq(serviceRequests.societyId, society.id));
  } else if (filter.societyId) {
    conditions.push(eq(serviceRequests.societyId, filter.societyId));
  }

  if (filter.status) {
    conditions.push(eq(serviceRequests.status, filter.status));
  }
  if (filter.categoryId) {
    conditions.push(eq(serviceRequests.categoryId, filter.categoryId));
  }
  if (filter.search) {
    const pattern = likePattern(filter.search);
    const searchCondition = or(
      ilike(serviceRequests.title, pattern),
      ilike(serviceRequests.reference, pattern),
    );
    if (searchCondition) conditions.push(searchCondition);
  }

  const where = and(...conditions);

  const [countRow] = await db
    .select({ total: sql<number>`count(*)::int` })
    .from(serviceRequests)
    .where(where);

  const rows = await db
    .select({
      id: serviceRequests.id,
      reference: serviceRequests.reference,
      title: serviceRequests.title,
      status: serviceRequests.status,
      budgetMin: serviceRequests.budgetMin,
      budgetMax: serviceRequests.budgetMax,
      responseDeadline: serviceRequests.responseDeadline,
      createdAt: serviceRequests.createdAt,
      updatedAt: serviceRequests.updatedAt,
      societyId: societies.id,
      societyName: societies.name,
      societyInstitution: societies.institution,
      categoryId: categories.id,
      categoryName: categories.name,
      categorySlug: categories.slug,
      eventId: events.id,
      eventName: events.name,
      eventDate: events.eventDate,
      eventLocation: events.location,
      eventAttendance: events.expectedAttendance,
      invitationCount: sql<number>`(
        select count(*)::int from ${requestVendors}
        where ${requestVendors.requestId} = ${serviceRequests.id}
      )`,
      quotationCount: sql<number>`(
        select count(*)::int from ${quotations}
        where ${quotations.requestId} = ${serviceRequests.id}
          and ${quotations.status} <> 'withdrawn'
      )`,
    })
    .from(serviceRequests)
    .innerJoin(societies, eq(societies.id, serviceRequests.societyId))
    .innerJoin(categories, eq(categories.id, serviceRequests.categoryId))
    .leftJoin(events, eq(events.id, serviceRequests.eventId))
    .where(where)
    .orderBy(...requestOrder(filter.sort))
    .limit(filter.limit)
    .offset(filter.offset);

  const requestIds = rows.map((row) => row.id);
  const bookingRows = requestIds.length
    ? await db
        .select({
          id: bookings.id,
          requestId: bookings.requestId,
          quotationId: bookings.quotationId,
          vendorId: bookings.vendorId,
          status: bookings.status,
          startsAt: bookings.startsAt,
          endsAt: bookings.endsAt,
          amount: bookings.amount,
          currency: bookings.currency,
        })
        .from(bookings)
        .where(
          and(
            inArray(bookings.requestId, requestIds),
            inArray(bookings.status, ['confirmed', 'completed']),
          ),
        )
    : [];

  const bookingByRequest = new Map<string, BookingSummary>();
  for (const row of bookingRows) {
    bookingByRequest.set(row.requestId, {
      id: row.id,
      quotationId: row.quotationId,
      vendorId: row.vendorId,
      status: row.status,
      startsAt: row.startsAt,
      endsAt: row.endsAt,
      amount: toNumber(row.amount) ?? 0,
      currency: row.currency,
    });
  }

  const items: RequestListItem[] = rows.map((row) => ({
    id: row.id,
    reference: row.reference,
    title: row.title,
    status: row.status,
    category: {
      id: row.categoryId,
      name: row.categoryName,
      slug: row.categorySlug,
    },
    event: row.eventId
      ? {
          id: row.eventId,
          name: row.eventName as string,
          eventDate: row.eventDate as string,
          location: row.eventLocation as string,
          expectedAttendance: row.eventAttendance,
        }
      : null,
    society: {
      id: row.societyId,
      name: row.societyName,
      institution: row.societyInstitution,
    },
    budgetMin: toNumber(row.budgetMin),
    budgetMax: toNumber(row.budgetMax),
    responseDeadline: row.responseDeadline,
    invitationCount: row.invitationCount,
    quotationCount: row.quotationCount,
    booking: bookingByRequest.get(row.id) ?? null,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  }));

  return {
    items,
    pagination: buildPagination(countRow?.total ?? 0, filter),
  };
}

export async function listVendorRequests(
  vendorUserId: string,
  filter: VendorRequestFilters,
): Promise<{ items: VendorRequestListItem[]; pagination: ReturnType<typeof buildPagination> }> {
  const [vendor] = await db
    .select({ id: vendors.id, verificationStatus: vendors.verificationStatus })
    .from(vendors)
    .where(eq(vendors.userId, vendorUserId))
    .limit(1);

  if (!vendor) {
    throw AppError.notFound('Vendor profile not found');
  }

  if (vendor.verificationStatus !== 'verified') {
    throw AppError.notEligible(
      'Your vendor account must be verified before you can browse requests',
    );
  }

  const conditions: SQL[] = [
    eq(requestVendors.vendorId, vendor.id),
    inArray(serviceRequests.status, REQUEST_ACCEPTS_QUOTES),
  ];

  if (filter.categoryId) {
    conditions.push(eq(serviceRequests.categoryId, filter.categoryId));
  }
  if (filter.search) {
    const pattern = likePattern(filter.search);
    const searchCondition = or(
      ilike(serviceRequests.title, pattern),
      ilike(serviceRequests.reference, pattern),
    );
    if (searchCondition) conditions.push(searchCondition);
  }

  const where = and(...conditions);

  const [countRow] = await db
    .select({ total: sql<number>`count(*)::int` })
    .from(requestVendors)
    .innerJoin(serviceRequests, eq(serviceRequests.id, requestVendors.requestId))
    .where(where);

  const rows = await db
    .select({
      id: serviceRequests.id,
      reference: serviceRequests.reference,
      title: serviceRequests.title,
      status: serviceRequests.status,
      description: serviceRequests.description,
      quantity: serviceRequests.quantity,
      budgetMin: serviceRequests.budgetMin,
      budgetMax: serviceRequests.budgetMax,
      responseDeadline: serviceRequests.responseDeadline,
      createdAt: serviceRequests.createdAt,
      updatedAt: serviceRequests.updatedAt,
      distributionStatus: requestVendors.distributionStatus,
      viewedAt: requestVendors.viewedAt,
      notifiedAt: requestVendors.notifiedAt,
      societyId: societies.id,
      societyName: societies.name,
      societyInstitution: societies.institution,
      categoryId: categories.id,
      categoryName: categories.name,
      categorySlug: categories.slug,
      eventId: events.id,
      eventName: events.name,
      eventDate: events.eventDate,
      eventLocation: events.location,
      eventAttendance: events.expectedAttendance,
      invitationCount: sql<number>`(
        select count(*)::int from ${requestVendors}
        where ${requestVendors.requestId} = ${serviceRequests.id}
      )`,
      quotationCount: sql<number>`(
        select count(*)::int from ${quotations}
        where ${quotations.requestId} = ${serviceRequests.id}
          and ${quotations.status} <> 'withdrawn'
      )`,
      ownQuotationCount: sql<number>`(
        select count(*)::int from ${quotations}
        where ${quotations.requestId} = ${serviceRequests.id}
          and ${quotations.vendorId} = ${vendor.id}
          and ${quotations.status} <> 'withdrawn'
      )`,
    })
    .from(requestVendors)
    .innerJoin(serviceRequests, eq(serviceRequests.id, requestVendors.requestId))
    .innerJoin(societies, eq(societies.id, serviceRequests.societyId))
    .innerJoin(categories, eq(categories.id, serviceRequests.categoryId))
    .leftJoin(events, eq(events.id, serviceRequests.eventId))
    .where(where)
    .orderBy(...vendorBoardOrder(filter.sort))
    .limit(filter.limit)
    .offset(filter.offset);

  const items: VendorRequestListItem[] = rows.map((row) => ({
    id: row.id,
    reference: row.reference,
    title: row.title,
    status: row.status,
    description: row.description,
    quantity: row.quantity,
    category: {
      id: row.categoryId,
      name: row.categoryName,
      slug: row.categorySlug,
    },
    event: row.eventId
      ? {
          id: row.eventId,
          name: row.eventName as string,
          eventDate: row.eventDate as string,
          location: row.eventLocation as string,
          expectedAttendance: row.eventAttendance,
        }
      : null,
    society: {
      id: row.societyId,
      name: row.societyName,
      institution: row.societyInstitution,
    },
    budgetMin: toNumber(row.budgetMin),
    budgetMax: toNumber(row.budgetMax),
    responseDeadline: row.responseDeadline,
    invitationCount: row.invitationCount,
    quotationCount: row.quotationCount,
    distribution: {
      status: row.distributionStatus,
      viewedAt: row.viewedAt,
      notifiedAt: row.notifiedAt,
    },
    hasQuoted: row.ownQuotationCount > 0,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  }));

  return {
    items,
    pagination: buildPagination(countRow?.total ?? 0, filter),
  };
}

export async function updateRequest(
  actorId: string,
  requestId: string,
  input: UpdateRequestInput,
): Promise<RequestDetail> {
  await db.transaction(async (tx) => {
    const [request] = await tx
      .select()
      .from(serviceRequests)
      .where(eq(serviceRequests.id, requestId))
      .for('update')
      .limit(1);

    if (!request) {
      throw AppError.notFound('Request not found');
    }

    const [society] = await tx
      .select({ id: societies.id, userId: societies.userId })
      .from(societies)
      .where(eq(societies.id, request.societyId))
      .limit(1);

    if (!society || society.userId !== actorId) {
      throw AppError.notFound('Request not found');
    }

    if (!REQUEST_EDITABLE.includes(request.status)) {
      throw AppError.conflict('CONFLICT', 'This request can no longer be edited');
    }

    const [currentEvent] = request.eventId
      ? await tx.select().from(events).where(eq(events.id, request.eventId)).limit(1)
      : [];

    const distributed = request.status === 'open' || request.status === 'partially_quoted';

    const categoryChanged =
      input.categoryId !== undefined && input.categoryId !== request.categoryId;
    const eventChanged = input.eventId !== undefined && input.eventId !== request.eventId;
    const eventDetailsChanged =
      input.event !== undefined &&
      (!currentEvent ||
        (input.event.eventDate !== undefined && input.event.eventDate !== currentEvent.eventDate) ||
        (input.event.location !== undefined && input.event.location !== currentEvent.location));

    if (distributed && (categoryChanged || eventChanged || eventDetailsChanged)) {
      throw AppError.ruleViolation(
        'Category, event date and event location cannot change after distribution',
      );
    }

    let nextCategoryId = request.categoryId;
    if (input.categoryId !== undefined) {
      const category = await getActiveCategoryTx(tx, input.categoryId);
      nextCategoryId = category.id;
    }

    let nextEventId = request.eventId;
    let nextEventDate = currentEvent?.eventDate ?? null;

    if (input.eventId !== undefined) {
      const event = await getOwnedEventTx(tx, input.eventId, request.societyId);
      nextEventId = event.id;
      nextEventDate = event.eventDate;
    } else if (input.event !== undefined) {
      if (currentEvent) {
        const eventPatch: Partial<typeof events.$inferInsert> = {
          updatedAt: new Date(),
        };
        if (input.event.name !== undefined) eventPatch.name = input.event.name;
        if (input.event.eventDate !== undefined) eventPatch.eventDate = input.event.eventDate;
        if (input.event.location !== undefined) eventPatch.location = input.event.location;
        if (input.event.expectedAttendance !== undefined) {
          eventPatch.expectedAttendance = input.event.expectedAttendance;
        }

        await tx.update(events).set(eventPatch).where(eq(events.id, currentEvent.id));
        nextEventDate = input.event.eventDate ?? currentEvent.eventDate;
      } else {
        if (!input.event.name || !input.event.eventDate || !input.event.location) {
          throw AppError.badRequest(
            'Event name, date and location are required when attaching an event',
          );
        }

        const [created] = await tx
          .insert(events)
          .values({
            societyId: request.societyId,
            name: input.event.name,
            eventDate: input.event.eventDate,
            location: input.event.location,
            expectedAttendance: input.event.expectedAttendance ?? null,
          })
          .returning({ id: events.id });

        if (!created) {
          throw new Error('Failed to create the event');
        }
        nextEventId = created.id;
        nextEventDate = input.event.eventDate;
      }
    }

    const nextBudgetMin =
      input.budgetMin === undefined ? request.budgetMin : (asMoney(input.budgetMin) ?? null);
    const nextBudgetMax =
      input.budgetMax === undefined ? request.budgetMax : (asMoney(input.budgetMax) ?? null);

    if (
      nextBudgetMin !== null &&
      nextBudgetMax !== null &&
      Number(nextBudgetMin) > Number(nextBudgetMax)
    ) {
      throw AppError.badRequest('The minimum budget cannot exceed the maximum budget');
    }

    if (request.status !== 'draft' && request.status !== 'submitted') {
      if (input.responseDeadline === null) {
        throw AppError.ruleViolation('A distributed request must keep a response deadline');
      }
      if (input.responseDeadline !== undefined) {
        const deadline = new Date(input.responseDeadline);
        if (deadline.getTime() <= Date.now()) {
          throw AppError.ruleViolation('The response deadline must be in the future');
        }
        if (nextEventDate !== null && deadline.toISOString().slice(0, 10) > nextEventDate) {
          throw AppError.ruleViolation('The response deadline cannot be after the event date');
        }
      }
    }

    const patch: Partial<typeof serviceRequests.$inferInsert> = {
      updatedAt: new Date(),
    };
    const changedFields: string[] = [];

    if (input.categoryId !== undefined) {
      patch.categoryId = nextCategoryId;
      changedFields.push('categoryId');
    }
    if (input.title !== undefined) {
      patch.title = input.title;
      changedFields.push('title');
    }
    if (input.description !== undefined) {
      patch.description = input.description;
      changedFields.push('description');
    }
    if (input.budgetMin !== undefined) {
      patch.budgetMin = nextBudgetMin;
      changedFields.push('budgetMin');
    }
    if (input.budgetMax !== undefined) {
      patch.budgetMax = nextBudgetMax;
      changedFields.push('budgetMax');
    }
    if (input.quantity !== undefined) {
      patch.quantity = input.quantity;
      changedFields.push('quantity');
    }
    if (input.responseDeadline !== undefined) {
      patch.responseDeadline = input.responseDeadline ? new Date(input.responseDeadline) : null;
      changedFields.push('responseDeadline');
    }
    if (input.eventId !== undefined || input.event !== undefined) {
      patch.eventId = nextEventId;
      changedFields.push('event');
    }

    await tx.update(serviceRequests).set(patch).where(eq(serviceRequests.id, request.id));

    await writeAuditTx(tx, {
      actorId,
      action: 'request.updated',
      targetType: 'request',
      targetId: request.id,
      metadata: { fields: changedFields },
    });
  });

  return getRequestDetail({ id: actorId, role: 'society' }, requestId);
}

export async function cancelRequest(
  viewer: RequestViewer,
  requestId: string,
  reason: string,
): Promise<RequestDetail> {
  await db.transaction(async (tx) => {
    const [request] = await tx
      .select()
      .from(serviceRequests)
      .where(eq(serviceRequests.id, requestId))
      .for('update')
      .limit(1);

    if (!request) {
      throw AppError.notFound('Request not found');
    }

    const [society] = await tx
      .select({ id: societies.id, name: societies.name, userId: societies.userId })
      .from(societies)
      .where(eq(societies.id, request.societyId))
      .limit(1);

    if (!society) {
      throw AppError.notFound('Request not found');
    }

    if (viewer.role === 'society' && society.userId !== viewer.id) {
      throw AppError.notFound('Request not found');
    }

    const allowed = viewer.role === 'admin' ? ADMIN_CANCELLABLE : OWNER_CANCELLABLE;
    if (!allowed.includes(request.status)) {
      throw AppError.conflict('CONFLICT', 'This request can no longer be cancelled');
    }

    const now = new Date();
    await tx
      .update(serviceRequests)
      .set({
        status: 'cancelled',
        cancelledBy: viewer.id,
        cancelledAt: now,
        cancellationReason: reason,
        updatedAt: now,
      })
      .where(eq(serviceRequests.id, request.id));

    await insertRequestNotificationsTx(tx, request.id, {
      type: 'request_closed',
      title: 'Request cancelled',
      body: `${society.name} cancelled "${request.title}".`,
      link: '/vendor',
    });

    await writeAuditTx(tx, {
      actorId: viewer.id,
      action: 'request.cancelled',
      targetType: 'request',
      targetId: request.id,
      metadata: { reason },
    });
  });

  return getRequestDetail(viewer, requestId);
}

export async function closeRequest(
  viewer: RequestViewer,
  requestId: string,
  reason?: string | undefined,
): Promise<RequestDetail> {
  await db.transaction(async (tx) => {
    const [request] = await tx
      .select()
      .from(serviceRequests)
      .where(eq(serviceRequests.id, requestId))
      .for('update')
      .limit(1);

    if (!request) {
      throw AppError.notFound('Request not found');
    }

    const [society] = await tx
      .select({ id: societies.id, name: societies.name, userId: societies.userId })
      .from(societies)
      .where(eq(societies.id, request.societyId))
      .limit(1);

    if (!society) {
      throw AppError.notFound('Request not found');
    }

    if (viewer.role === 'society' && society.userId !== viewer.id) {
      throw AppError.notFound('Request not found');
    }

    if (!CLOSABLE.includes(request.status)) {
      throw AppError.conflict('CONFLICT', 'This request can no longer be closed');
    }

    await tx
      .update(serviceRequests)
      .set({ status: 'closed', updatedAt: new Date() })
      .where(eq(serviceRequests.id, request.id));

    await insertRequestNotificationsTx(tx, request.id, {
      type: 'request_closed',
      title: 'Request closed',
      body: `${society.name} closed "${request.title}".`,
      link: '/vendor',
    });

    await writeAuditTx(tx, {
      actorId: viewer.id,
      action: 'request.closed',
      targetType: 'request',
      targetId: request.id,
      metadata: { reason: reason ?? null },
    });
  });

  return getRequestDetail(viewer, requestId);
}

/** Society-owned transition that freezes the collection window for review. */
export async function closeQuoting(
  viewer: RequestViewer,
  requestId: string,
): Promise<RequestDetail> {
  await db.transaction(async (tx) => {
    const [request] = await tx
      .select()
      .from(serviceRequests)
      .where(eq(serviceRequests.id, requestId))
      .for('update')
      .limit(1);

    if (!request) throw AppError.notFound('Request not found');

    const [society] = await tx
      .select({ userId: societies.userId })
      .from(societies)
      .where(eq(societies.id, request.societyId))
      .limit(1);

    if (!society || society.userId !== viewer.id) {
      throw AppError.notFound('Request not found');
    }

    if (!canTransitionRequest(request.status, 'quoted')) {
      throw AppError.conflict('CONFLICT', 'This request is no longer collecting quotations');
    }

    const [{ total } = { total: 0 }] = await tx
      .select({ total: sql<number>`count(*)::int` })
      .from(quotations)
      .where(
        and(
          eq(quotations.requestId, requestId),
          ne(quotations.status, 'withdrawn'),
          ne(quotations.status, 'expired'),
        ),
      );

    if (total === 0) {
      throw AppError.ruleViolation('At least one quotation is required before starting review');
    }

    await tx
      .update(serviceRequests)
      .set({ status: 'quoted', updatedAt: new Date() })
      .where(eq(serviceRequests.id, requestId));

    await writeAuditTx(tx, {
      actorId: viewer.id,
      action: 'request.review_opened',
      targetType: 'request',
      targetId: requestId,
      metadata: { quotationCount: total },
    });
  });

  return getRequestDetail(viewer, requestId);
}

/** Society-owned transition that closes out a successfully selected engagement. */
export async function completeRequest(
  viewer: RequestViewer,
  requestId: string,
): Promise<RequestDetail> {
  let vendorUserId: string | undefined;
  let completionContext: { title: string; societyName: string } | undefined;

  await db.transaction(async (tx) => {
    const [request] = await tx
      .select()
      .from(serviceRequests)
      .where(eq(serviceRequests.id, requestId))
      .for('update')
      .limit(1);

    if (!request) throw AppError.notFound('Request not found');

    const [society] = await tx
      .select({ name: societies.name, userId: societies.userId })
      .from(societies)
      .where(eq(societies.id, request.societyId))
      .limit(1);

    if (!society || society.userId !== viewer.id) {
      throw AppError.notFound('Request not found');
    }

    completionContext = { title: request.title, societyName: society.name };

    if (!canTransitionRequest(request.status, 'completed')) {
      throw AppError.conflict('CONFLICT', 'Only a selected request can be marked complete');
    }

    if (!request.selectedQuotationId) {
      throw AppError.conflict('CONFLICT', 'A quotation must be selected before completion');
    }

    await tx
      .update(serviceRequests)
      .set({ status: 'completed', updatedAt: new Date() })
      .where(eq(serviceRequests.id, requestId));

    const [vendorUser] = await tx
      .select({ userId: vendors.userId })
      .from(quotations)
      .innerJoin(vendors, eq(vendors.id, quotations.vendorId))
      .where(eq(quotations.id, request.selectedQuotationId))
      .limit(1);
    vendorUserId = vendorUser?.userId;

    await tx
      .update(bookings)
      .set({ status: 'completed', updatedAt: new Date() })
      .where(and(eq(bookings.requestId, requestId), eq(bookings.status, 'confirmed')));

    await writeAuditTx(tx, {
      actorId: viewer.id,
      action: 'request.completed',
      targetType: 'request',
      targetId: requestId,
      metadata: { selectedQuotationId: request.selectedQuotationId },
    });
  });

  if (vendorUserId && completionContext) {
    await notifyBestEffort({
      userId: vendorUserId,
      type: 'request_completed',
      title: 'Engagement marked complete',
      body: `${completionContext.societyName} marked "${completionContext.title}" as complete. The society can now leave a review.`,
      link: '/vendor',
    });
  }

  return getRequestDetail(viewer, requestId);
}

export async function listRequestVendors(
  viewer: RequestViewer,
  requestId: string,
): Promise<{ requestId: string; items: RequestVendorListItem[] }> {
  const [request] = await db
    .select({ id: serviceRequests.id, societyUserId: societies.userId })
    .from(serviceRequests)
    .innerJoin(societies, eq(societies.id, serviceRequests.societyId))
    .where(eq(serviceRequests.id, requestId))
    .limit(1);

  if (!request) {
    throw AppError.notFound('Request not found');
  }

  if (viewer.role === 'society' && request.societyUserId !== viewer.id) {
    throw AppError.notFound('Request not found');
  }

  const rows = await db
    .select({
      vendorId: vendors.id,
      businessName: vendors.businessName,
      city: vendors.city,
      verificationStatus: vendors.verificationStatus,
      distributionStatus: requestVendors.distributionStatus,
      viewedAt: requestVendors.viewedAt,
      notifiedAt: requestVendors.notifiedAt,
    })
    .from(requestVendors)
    .innerJoin(vendors, eq(vendors.id, requestVendors.vendorId))
    .where(eq(requestVendors.requestId, requestId))
    .orderBy(asc(vendors.businessName), asc(vendors.id));

  return { requestId, items: rows };
}
