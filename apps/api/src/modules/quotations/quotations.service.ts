import { and, desc, eq, inArray, isNotNull, lt, ne, sql } from 'drizzle-orm';
import {
  canTransitionQuotation,
  canTransitionRequest,
  QUOTATION_DECIDABLE,
  QUOTATION_EDITABLE,
  REQUEST_ACCEPTS_DECISIONS,
  REQUEST_ACCEPTS_QUOTES,
  type QuotationStatus,
  type RequestStatus,
  type UpsertQuotationInput,
  type UserRole,
} from '@event-bridge/shared';
import { db } from '../../db/index.js';
import {
  events,
  notifications,
  quotations,
  requestVendors,
  serviceRequests,
  societies,
  users,
  vendors,
} from '../../db/schema/index.js';
import { writeAuditTx, type AuditTransaction } from '../../lib/audit.js';
import { AppError } from '../../lib/errors.js';
import { buildPagination, type PageRequest, type PaginationMeta } from '../../lib/pagination.js';
import { makeReference } from '../../lib/reference.js';

export interface QuotationViewer {
  id: string;
  role: UserRole;
}

export interface QuotationVendorSummary {
  id: string;
  businessName: string;
  city: string;
  serviceArea: string | null;
  contactPerson: string | null;
  contactPhone: string | null;
  contactEmail: string;
}

export interface QuotationView {
  id: string;
  reference: string;
  requestId: string;
  vendor: QuotationVendorSummary;
  totalPrice: number;
  currency: string;
  description: string;
  inclusions: string | null;
  exclusions: string | null;
  additionalCharges: number | null;
  availableOnDate: boolean | null;
  validUntil: Date | null;
  notes: string | null;
  status: string;
  submittedAt: Date;
  updatedAt: Date;
}

interface QuotationRow {
  id: string;
  reference: string;
  requestId: string;
  totalPrice: string;
  currency: string;
  description: string;
  inclusions: string | null;
  exclusions: string | null;
  additionalCharges: string | null;
  availableOnDate: boolean | null;
  validUntil: Date | null;
  notes: string | null;
  status: string;
  submittedAt: Date;
  updatedAt: Date;
  vendorId: string;
  businessName: string;
  city: string;
  serviceArea: string | null;
  contactPerson: string | null;
  contactPhone: string | null;
  contactEmail: string;
}

const quotationColumns = {
  id: quotations.id,
  reference: quotations.reference,
  requestId: quotations.requestId,
  totalPrice: quotations.totalPrice,
  currency: quotations.currency,
  description: quotations.description,
  inclusions: quotations.inclusions,
  exclusions: quotations.exclusions,
  additionalCharges: quotations.additionalCharges,
  availableOnDate: quotations.availableOnDate,
  validUntil: quotations.validUntil,
  notes: quotations.notes,
  status: quotations.status,
  submittedAt: quotations.submittedAt,
  updatedAt: quotations.updatedAt,
  vendorId: vendors.id,
  businessName: vendors.businessName,
  city: vendors.city,
  serviceArea: vendors.serviceArea,
  contactPerson: vendors.contactPerson,
  contactPhone: vendors.contactPhone,
  contactEmail: users.email,
} as const;

function mapQuotation(row: QuotationRow): QuotationView {
  return {
    id: row.id,
    reference: row.reference,
    requestId: row.requestId,
    vendor: {
      id: row.vendorId,
      businessName: row.businessName,
      city: row.city,
      serviceArea: row.serviceArea,
      contactPerson: row.contactPerson,
      contactPhone: row.contactPhone,
      contactEmail: row.contactEmail,
    },
    totalPrice: Number(row.totalPrice),
    currency: row.currency,
    description: row.description,
    inclusions: row.inclusions,
    exclusions: row.exclusions,
    additionalCharges: row.additionalCharges === null ? null : Number(row.additionalCharges),
    availableOnDate: row.availableOnDate,
    validUntil: row.validUntil,
    notes: row.notes,
    status: row.status,
    submittedAt: row.submittedAt,
    updatedAt: row.updatedAt,
  };
}

function formatMoney(value: number): string {
  return new Intl.NumberFormat('en-PK', { maximumFractionDigits: 0 }).format(value);
}

function staleQuotationFilter(requestId?: string) {
  return and(
    requestId ? eq(quotations.requestId, requestId) : undefined,
    inArray(quotations.status, QUOTATION_DECIDABLE),
    isNotNull(quotations.validUntil),
    lt(quotations.validUntil, new Date()),
  );
}

/** Lazy expiry: no scheduler is required, writes are safe and idempotent. */
async function expireStaleQuotations(): Promise<void> {
  await db
    .update(quotations)
    .set({ status: 'expired', updatedAt: new Date() })
    .where(staleQuotationFilter());
}

async function expireStaleQuotationsTx(tx: AuditTransaction, requestId: string): Promise<void> {
  await tx
    .update(quotations)
    .set({ status: 'expired', updatedAt: new Date() })
    .where(staleQuotationFilter(requestId));
}

/**
 * All society decisions lock the request row first. Together with the lock in
 * `upsertQuotation`, this serialises every lifecycle write for one request, so
 * a selection can no longer race with a withdrawal or a new quotation.
 */
async function lockRequestForDecision(
  tx: AuditTransaction,
  requestId: string,
  userId: string,
): Promise<{ id: string; title: string; status: RequestStatus; societyUserId: string }> {
  const [request] = await tx
    .select({
      id: serviceRequests.id,
      title: serviceRequests.title,
      status: serviceRequests.status,
      societyUserId: societies.userId,
    })
    .from(serviceRequests)
    .innerJoin(societies, eq(societies.id, serviceRequests.societyId))
    .where(eq(serviceRequests.id, requestId))
    .for('update')
    .limit(1);

  if (!request || request.societyUserId !== userId) {
    throw AppError.notFound('Request not found');
  }

  if (!REQUEST_ACCEPTS_DECISIONS.includes(request.status)) {
    throw AppError.conflict('CONFLICT', 'This request can no longer be reviewed');
  }

  return {
    id: request.id,
    title: request.title,
    status: request.status,
    societyUserId: request.societyUserId,
  };
}

async function loadQuotationForDecision(
  tx: AuditTransaction,
  requestId: string,
  quotationId: string,
): Promise<{ id: string; status: QuotationStatus; vendorId: string }> {
  const [quote] = await tx
    .select({
      id: quotations.id,
      status: quotations.status,
      vendorId: quotations.vendorId,
    })
    .from(quotations)
    .where(and(eq(quotations.id, quotationId), eq(quotations.requestId, requestId)))
    .limit(1);

  if (!quote) {
    throw AppError.notFound('Quotation not found');
  }

  return quote;
}

async function getQuotationById(quotationId: string): Promise<QuotationView> {
  const [row] = await db
    .select(quotationColumns)
    .from(quotations)
    .innerJoin(vendors, eq(vendors.id, quotations.vendorId))
    .innerJoin(users, eq(users.id, vendors.userId))
    .where(eq(quotations.id, quotationId))
    .limit(1);

  if (!row) {
    throw AppError.notFound('Quotation not found');
  }

  return mapQuotation(row);
}

export interface UpsertQuotationResult {
  quotation: QuotationView;
  created: boolean;
}

/**
 * Creates or updates the authenticated vendor's quotation for one request.
 * A vendor has at most one quotation per request (enforced by a unique index),
 * so re-applying edits the existing row instead of creating a duplicate.
 */
export async function upsertQuotation(
  userId: string,
  requestId: string,
  input: UpsertQuotationInput,
): Promise<UpsertQuotationResult> {
  const result = await db.transaction(async (tx) => {
    const [vendor] = await tx.select().from(vendors).where(eq(vendors.userId, userId)).limit(1);

    if (!vendor) {
      throw AppError.notFound('Vendor profile not found');
    }

    if (vendor.verificationStatus !== 'verified') {
      throw AppError.notEligible('Your vendor account must be verified before you can quote');
    }

    const [request] = await tx
      .select()
      .from(serviceRequests)
      .where(eq(serviceRequests.id, requestId))
      .for('update')
      .limit(1);

    if (!request) {
      throw AppError.notFound('Request not found');
    }

    if (!REQUEST_ACCEPTS_QUOTES.includes(request.status)) {
      throw AppError.conflict('CONFLICT', 'This request is no longer accepting quotations');
    }

    await expireStaleQuotationsTx(tx, request.id);

    if (request.responseDeadline && request.responseDeadline.getTime() <= Date.now()) {
      throw AppError.conflict('CONFLICT', 'The response deadline for this request has passed');
    }

    if (request.eventId) {
      const [event] = await tx
        .select({ eventDate: events.eventDate })
        .from(events)
        .where(eq(events.id, request.eventId))
        .limit(1);

      if (event && event.eventDate < new Date().toISOString().slice(0, 10)) {
        throw AppError.conflict('CONFLICT', 'The event date for this request has passed');
      }
    }

    const [assignment] = await tx
      .select({ id: requestVendors.id })
      .from(requestVendors)
      .where(and(eq(requestVendors.requestId, request.id), eq(requestVendors.vendorId, vendor.id)))
      .limit(1);

    if (!assignment) {
      throw AppError.forbidden('You were not invited to quote on this request');
    }

    const [existing] = await tx
      .select()
      .from(quotations)
      .where(and(eq(quotations.requestId, request.id), eq(quotations.vendorId, vendor.id)))
      .limit(1);

    if (existing && !QUOTATION_EDITABLE.includes(existing.status)) {
      throw AppError.conflict('CONFLICT', 'This quotation can no longer be edited');
    }

    const values = {
      totalPrice: input.totalPrice.toFixed(2),
      currency: 'PKR',
      description: input.description,
      inclusions: input.inclusions ?? null,
      exclusions: input.exclusions ?? null,
      additionalCharges:
        input.additionalCharges === undefined || input.additionalCharges === null
          ? null
          : input.additionalCharges.toFixed(2),
      availableOnDate: input.availableOnDate ?? null,
      validUntil: input.validUntil ? new Date(input.validUntil) : null,
      notes: input.notes ?? null,
    };

    let quotationId: string;

    if (existing) {
      // Keep a preference marker when the vendor revises a preferred offer;
      // otherwise the society's decision would silently disappear.
      await tx
        .update(quotations)
        .set({
          ...values,
          status: existing.status === 'preferred' ? 'preferred' : 'updated',
          updatedAt: new Date(),
        })
        .where(eq(quotations.id, existing.id));
      quotationId = existing.id;
    } else {
      const [created] = await tx
        .insert(quotations)
        .values({
          reference: makeReference('Q'),
          requestId: request.id,
          vendorId: vendor.id,
          ...values,
          status: 'submitted',
        })
        .returning({ id: quotations.id });

      if (!created) {
        throw new Error('Quotation insert did not return an id');
      }

      quotationId = created.id;
    }

    await tx
      .update(requestVendors)
      .set({ distributionStatus: 'responded', viewedAt: new Date() })
      .where(eq(requestVendors.id, assignment.id));

    // Stop the request from showing as untouched once the first quote lands.
    // "quoted" is reserved for a later all-responded/selection flow so the
    // vendor can still revise their quotation.
    if (request.status === 'open') {
      await tx
        .update(serviceRequests)
        .set({ status: 'partially_quoted', updatedAt: new Date() })
        .where(eq(serviceRequests.id, request.id));
    }

    const [society] = await tx
      .select({ userId: societies.userId })
      .from(societies)
      .where(eq(societies.id, request.societyId))
      .limit(1);

    if (society) {
      await tx.insert(notifications).values({
        userId: society.userId,
        type: 'new_quotation',
        title: existing
          ? `Quotation updated by ${vendor.businessName}`
          : `New quotation from ${vendor.businessName}`,
        body: `${vendor.businessName} quoted PKR ${formatMoney(input.totalPrice)} for "${request.title}".`,
        link: '/society',
      });
    }

    await writeAuditTx(tx, {
      actorId: userId,
      action: existing ? 'quotation.updated' : 'quotation.submitted',
      targetType: 'quotation',
      targetId: quotationId,
      metadata: { requestId: request.id, totalPrice: input.totalPrice },
    });

    return { quotationId, created: !existing };
  });

  return {
    quotation: await getQuotationById(result.quotationId),
    created: result.created,
  };
}

/** Returns the authenticated vendor's own quotation, or null when none exists. */
export async function getMyQuotation(
  userId: string,
  requestId: string,
): Promise<QuotationView | null> {
  await expireStaleQuotations();

  const [vendor] = await db
    .select({ id: vendors.id })
    .from(vendors)
    .where(eq(vendors.userId, userId))
    .limit(1);

  if (!vendor) {
    throw AppError.notFound('Vendor profile not found');
  }

  const [row] = await db
    .select(quotationColumns)
    .from(quotations)
    .innerJoin(vendors, eq(vendors.id, quotations.vendorId))
    .innerJoin(users, eq(users.id, vendors.userId))
    .where(and(eq(quotations.requestId, requestId), eq(quotations.vendorId, vendor.id)))
    .limit(1);

  return row ? mapQuotation(row) : null;
}

/** Society owner (or an admin) reviews every quotation received for a request. */
export async function listRequestQuotations(
  viewer: QuotationViewer,
  requestId: string,
  page: PageRequest,
): Promise<{
  requestId: string;
  items: QuotationView[];
  pagination: ReturnType<typeof buildPagination>;
}> {
  await expireStaleQuotations();

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

  const where = and(eq(quotations.requestId, request.id), ne(quotations.status, 'withdrawn'));

  const [countRow] = await db
    .select({ total: sql<number>`count(*)::int` })
    .from(quotations)
    .where(where);

  const rows = await db
    .select(quotationColumns)
    .from(quotations)
    .innerJoin(vendors, eq(vendors.id, quotations.vendorId))
    .innerJoin(users, eq(users.id, vendors.userId))
    .where(where)
    .orderBy(desc(quotations.submittedAt))
    .limit(page.limit)
    .offset(page.offset);

  return {
    requestId: request.id,
    items: rows.map(mapQuotation),
    pagination: buildPagination(countRow?.total ?? 0, page),
  };
}

export interface QuotationComparisonItem {
  quotationId: string;
  reference: string;
  vendor: { id: string; businessName: string; city: string; serviceArea: string | null };
  totalPrice: number;
  additionalCharges: number | null;
  totalWithExtras: number;
  inclusions: string | null;
  exclusions: string | null;
  availableOnDate: boolean | null;
  validUntil: Date | null;
  status: string;
  submittedAt: Date;
}

export interface QuotationComparison {
  requestId: string;
  request: {
    id: string;
    title: string;
    status: string;
    budgetMin: number | null;
    budgetMax: number | null;
    currency: string;
  };
  items: QuotationComparisonItem[];
  summary: {
    count: number;
    lowestTotal: number | null;
    highestTotal: number | null;
    averageTotal: number | null;
  };
}

/** Normalised, server-generated payload for the side-by-side review table. */
export async function getQuotationComparison(
  viewer: QuotationViewer,
  requestId: string,
): Promise<QuotationComparison> {
  await expireStaleQuotations();

  const [request] = await db
    .select({
      id: serviceRequests.id,
      title: serviceRequests.title,
      status: serviceRequests.status,
      budgetMin: serviceRequests.budgetMin,
      budgetMax: serviceRequests.budgetMax,
      societyUserId: societies.userId,
    })
    .from(serviceRequests)
    .innerJoin(societies, eq(societies.id, serviceRequests.societyId))
    .where(eq(serviceRequests.id, requestId))
    .limit(1);

  if (!request) throw AppError.notFound('Request not found');
  if (viewer.role === 'society' && request.societyUserId !== viewer.id) {
    throw AppError.notFound('Request not found');
  }

  const rows = await db
    .select({
      quotationId: quotations.id,
      reference: quotations.reference,
      totalPrice: quotations.totalPrice,
      currency: quotations.currency,
      additionalCharges: quotations.additionalCharges,
      inclusions: quotations.inclusions,
      exclusions: quotations.exclusions,
      availableOnDate: quotations.availableOnDate,
      validUntil: quotations.validUntil,
      status: quotations.status,
      submittedAt: quotations.submittedAt,
      vendorId: vendors.id,
      businessName: vendors.businessName,
      city: vendors.city,
      serviceArea: vendors.serviceArea,
    })
    .from(quotations)
    .innerJoin(vendors, eq(vendors.id, quotations.vendorId))
    .where(and(eq(quotations.requestId, request.id), ne(quotations.status, 'withdrawn')))
    .orderBy(desc(quotations.submittedAt));

  const items: QuotationComparisonItem[] = rows.map((row) => {
    const totalPrice = Number(row.totalPrice);
    const additionalCharges = row.additionalCharges === null ? null : Number(row.additionalCharges);

    return {
      quotationId: row.quotationId,
      reference: row.reference,
      vendor: {
        id: row.vendorId,
        businessName: row.businessName,
        city: row.city,
        serviceArea: row.serviceArea,
      },
      totalPrice,
      additionalCharges,
      totalWithExtras: Number((totalPrice + (additionalCharges ?? 0)).toFixed(2)),
      inclusions: row.inclusions,
      exclusions: row.exclusions,
      availableOnDate: row.availableOnDate,
      validUntil: row.validUntil,
      status: row.status,
      submittedAt: row.submittedAt,
    };
  });

  const comparableTotals = items
    .filter((item) => ['submitted', 'updated', 'preferred', 'selected'].includes(item.status))
    .map((item) => item.totalWithExtras);

  const lowestTotal = comparableTotals.length ? Math.min(...comparableTotals) : null;
  const highestTotal = comparableTotals.length ? Math.max(...comparableTotals) : null;
  const averageTotal = comparableTotals.length
    ? Number(
        (
          comparableTotals.reduce((total, value) => total + value, 0) / comparableTotals.length
        ).toFixed(2),
      )
    : null;

  return {
    requestId: request.id,
    request: {
      id: request.id,
      title: request.title,
      status: request.status,
      budgetMin: request.budgetMin === null ? null : Number(request.budgetMin),
      budgetMax: request.budgetMax === null ? null : Number(request.budgetMax),
      currency: rows[0]?.currency ?? 'PKR',
    },
    items,
    summary: {
      count: comparableTotals.length,
      lowestTotal,
      highestTotal,
      averageTotal,
    },
  };
}

export async function selectQuotation(
  userId: string,
  requestId: string,
  quotationId: string,
): Promise<QuotationView> {
  const resultQuotationId = await db.transaction(async (tx) => {
    const request = await lockRequestForDecision(tx, requestId, userId);

    await expireStaleQuotationsTx(tx, requestId);

    if (!canTransitionRequest(request.status, 'selected')) {
      throw AppError.conflict('CONFLICT', 'This request can no longer be selected');
    }

    const quote = await loadQuotationForDecision(tx, requestId, quotationId);

    if (!canTransitionQuotation(quote.status, 'selected')) {
      throw AppError.conflict('CONFLICT', 'This quotation can no longer be selected');
    }

    // Demote the other live offers before promoting the chosen one. The partial
    // unique index on selected quotations would otherwise reject this update.
    await tx
      .update(quotations)
      .set({ status: 'not_selected', updatedAt: new Date() })
      .where(
        and(
          eq(quotations.requestId, requestId),
          ne(quotations.id, quotationId),
          inArray(quotations.status, QUOTATION_DECIDABLE),
        ),
      );

    const [selected] = await tx
      .update(quotations)
      .set({ status: 'selected', updatedAt: new Date() })
      .where(and(eq(quotations.id, quotationId), inArray(quotations.status, QUOTATION_DECIDABLE)))
      .returning({ id: quotations.id });

    if (!selected) {
      throw AppError.conflict('CONFLICT', 'This quotation can no longer be selected');
    }

    await tx
      .update(serviceRequests)
      .set({ status: 'selected', selectedQuotationId: quotationId, updatedAt: new Date() })
      .where(eq(serviceRequests.id, requestId));

    const [vendorUser] = await tx
      .select({ userId: vendors.userId })
      .from(vendors)
      .where(eq(vendors.id, quote.vendorId))
      .limit(1);

    if (vendorUser) {
      await tx.insert(notifications).values({
        userId: vendorUser.userId,
        type: 'quotation_selected',
        title: 'Your quotation was selected',
        body: `A quotation for "${request.title}" was selected for further discussion.`,
        link: '/vendor',
      });
    }

    await writeAuditTx(tx, {
      actorId: userId,
      action: 'quotation.selected',
      targetType: 'quotation',
      targetId: quotationId,
      metadata: { requestId },
    });

    return quotationId;
  });

  return getQuotationById(resultQuotationId);
}

export async function preferQuotation(
  userId: string,
  requestId: string,
  quotationId: string,
): Promise<QuotationView> {
  const resultQuotationId = await db.transaction(async (tx) => {
    await lockRequestForDecision(tx, requestId, userId);

    await expireStaleQuotationsTx(tx, requestId);

    const quote = await loadQuotationForDecision(tx, requestId, quotationId);

    if (quote.status !== 'preferred' && !canTransitionQuotation(quote.status, 'preferred')) {
      throw AppError.conflict('CONFLICT', 'This quotation can no longer be preferred');
    }

    await tx
      .update(quotations)
      .set({ status: 'updated', updatedAt: new Date() })
      .where(and(eq(quotations.requestId, requestId), eq(quotations.status, 'preferred')));

    const [preferred] = await tx
      .update(quotations)
      .set({ status: 'preferred', updatedAt: new Date() })
      .where(and(eq(quotations.id, quotationId), inArray(quotations.status, QUOTATION_DECIDABLE)))
      .returning({ id: quotations.id });

    if (!preferred) {
      throw AppError.conflict('CONFLICT', 'This quotation can no longer be preferred');
    }

    await writeAuditTx(tx, {
      actorId: userId,
      action: 'quotation.preferred',
      targetType: 'quotation',
      targetId: quotationId,
      metadata: { requestId },
    });

    return quotationId;
  });

  return getQuotationById(resultQuotationId);
}

export async function withdrawQuotation(
  userId: string,
  quotationId: string,
): Promise<QuotationView> {
  const [vendor] = await db
    .select({ id: vendors.id })
    .from(vendors)
    .where(eq(vendors.userId, userId))
    .limit(1);

  if (!vendor) throw AppError.notFound('Vendor profile not found');

  // Read the request id first so the transaction can lock the request row
  // before touching the quotation — the same order used by every other write.
  const [initial] = await db
    .select({ requestId: quotations.requestId })
    .from(quotations)
    .where(and(eq(quotations.id, quotationId), eq(quotations.vendorId, vendor.id)))
    .limit(1);

  if (!initial) throw AppError.notFound('Quotation not found');

  const resultQuotationId = await db.transaction(async (tx) => {
    const [request] = await tx
      .select({
        status: serviceRequests.status,
        societyUserId: societies.userId,
      })
      .from(serviceRequests)
      .innerJoin(societies, eq(societies.id, serviceRequests.societyId))
      .where(eq(serviceRequests.id, initial.requestId))
      .for('update')
      .limit(1);

    if (!request) throw AppError.notFound('Request not found');

    if (['selected', 'completed', 'closed', 'cancelled'].includes(request.status)) {
      throw AppError.conflict('CONFLICT', 'This request no longer accepts withdrawals');
    }

    await expireStaleQuotationsTx(tx, initial.requestId);

    const quote = await loadQuotationForDecision(tx, initial.requestId, quotationId);

    if (!canTransitionQuotation(quote.status, 'withdrawn')) {
      throw AppError.conflict('CONFLICT', 'This quotation can no longer be withdrawn');
    }

    const [withdrawn] = await tx
      .update(quotations)
      .set({ status: 'withdrawn', updatedAt: new Date() })
      .where(and(eq(quotations.id, quotationId), inArray(quotations.status, QUOTATION_DECIDABLE)))
      .returning({ id: quotations.id });

    if (!withdrawn) {
      throw AppError.conflict('CONFLICT', 'This quotation can no longer be withdrawn');
    }

    await tx
      .update(requestVendors)
      .set({ distributionStatus: 'declined' })
      .where(
        and(
          eq(requestVendors.requestId, initial.requestId),
          eq(requestVendors.vendorId, vendor.id),
        ),
      );

    await tx.insert(notifications).values({
      userId: request.societyUserId,
      type: 'quotation_rejected',
      title: 'A quotation was withdrawn',
      body: 'A vendor withdrew their quotation. You can still review the remaining offers.',
      link: '/society',
    });

    await writeAuditTx(tx, {
      actorId: userId,
      action: 'quotation.withdrawn',
      targetType: 'quotation',
      targetId: quotationId,
      metadata: { requestId: initial.requestId },
    });

    return quotationId;
  });

  return getQuotationById(resultQuotationId);
}

export interface MyQuotationListItem {
  id: string;
  reference: string;
  totalPrice: number;
  currency: string;
  status: string;
  submittedAt: Date;
  updatedAt: Date;
  request: {
    id: string;
    reference: string;
    title: string;
    status: string;
  };
}

export async function listMyQuotations(
  userId: string,
  page: PageRequest,
): Promise<{ items: MyQuotationListItem[]; pagination: PaginationMeta }> {
  await expireStaleQuotations();

  const [vendor] = await db
    .select({ id: vendors.id })
    .from(vendors)
    .where(eq(vendors.userId, userId))
    .limit(1);

  if (!vendor) throw AppError.notFound('Vendor profile not found');

  const where = eq(quotations.vendorId, vendor.id);

  const [countRow] = await db
    .select({ total: sql<number>`count(*)::int` })
    .from(quotations)
    .where(where);

  const rows = await db
    .select({
      id: quotations.id,
      reference: quotations.reference,
      totalPrice: quotations.totalPrice,
      currency: quotations.currency,
      status: quotations.status,
      submittedAt: quotations.submittedAt,
      updatedAt: quotations.updatedAt,
      requestId: serviceRequests.id,
      requestReference: serviceRequests.reference,
      requestTitle: serviceRequests.title,
      requestStatus: serviceRequests.status,
    })
    .from(quotations)
    .innerJoin(serviceRequests, eq(serviceRequests.id, quotations.requestId))
    .where(where)
    .orderBy(desc(quotations.updatedAt))
    .limit(page.limit)
    .offset(page.offset);

  return {
    items: rows.map((row) => ({
      id: row.id,
      reference: row.reference,
      totalPrice: Number(row.totalPrice),
      currency: row.currency,
      status: row.status,
      submittedAt: row.submittedAt,
      updatedAt: row.updatedAt,
      request: {
        id: row.requestId,
        reference: row.requestReference,
        title: row.requestTitle,
        status: row.requestStatus,
      },
    })),
    pagination: buildPagination(countRow?.total ?? 0, page),
  };
}
