import { and, asc, desc, eq, gt, inArray, lt } from 'drizzle-orm';
import {
  QUOTATION_DECIDABLE,
  REQUEST_ACCEPTS_DECISIONS,
  type AvailabilityQuery,
  type BookingStatus,
  type CancelBookingInput,
  type CreateBookingInput,
  type UserRole,
} from '@event-bridge/shared';
import { db } from '../../db/index.js';
import {
  bookings,
  events,
  type NewNotification,
  quotations,
  serviceRequests,
  societies,
  users,
  vendors,
} from '../../db/schema/index.js';
import { writeAuditTx } from '../../lib/audit.js';
import { AppError } from '../../lib/errors.js';
import { notifyBestEffort } from '../../lib/notifications.js';

export interface BookingViewer {
  id: string;
  role: UserRole;
}

export interface BookingDetail {
  id: string;
  requestId: string;
  quotationId: string;
  societyId: string;
  vendorId: string;
  startsAt: Date;
  endsAt: Date;
  amount: number;
  currency: string;
  notes: string | null;
  status: BookingStatus;
  request: {
    id: string;
    reference: string;
    title: string;
  };
  vendor: {
    id: string;
    businessName: string;
  };
  createdAt: Date;
  updatedAt: Date;
}

export interface BusyWindow {
  id: string;
  startsAt: Date;
  endsAt: Date;
}

export interface VendorAvailability {
  vendorId: string;
  from: Date;
  to: Date;
  available: boolean;
  busyWindows: BusyWindow[];
}

export interface BookingSummary {
  id: string;
  quotationId: string;
  vendorId: string;
  status: string;
  startsAt: Date;
  endsAt: Date;
  amount: number;
  currency: string;
  requestId: string;
}

/** A society's quotations for one vendor, shown on that vendor's public profile. */
export interface VendorHireOption {
  quotationId: string;
  reference: string;
  requestId: string;
  requestReference: string;
  requestTitle: string;
  eventName: string | null;
  eventDate: string | null;
  totalPrice: number;
  currency: string;
  quotationStatus: string;
  requestStatus: string;
  canSelect: boolean;
  canHire: boolean;
  booking: BookingSummary | null;
}

export interface VendorHireOptionPage {
  vendorId: string;
  items: VendorHireOption[];
}

interface BookingSummaryRow {
  id: string;
  quotationId: string;
  vendorId: string;
  status: string;
  startsAt: Date;
  endsAt: Date;
  amount: string;
  currency: string;
  requestId: string;
}

function toNumber(value: string): number {
  return Number.parseFloat(value);
}

function formatRange(startsAt: Date, endsAt: Date): string {
  return `${startsAt.toISOString().slice(0, 16).replace('T', ' ')}–${endsAt
    .toISOString()
    .slice(0, 16)
    .replace('T', ' ')} UTC`;
}

export async function createBooking(
  viewer: BookingViewer,
  input: CreateBookingInput,
): Promise<BookingDetail> {
  if (viewer.role !== 'society') {
    throw AppError.forbidden('Only societies can hire vendors');
  }

  let bookingNotification: NewNotification | undefined;

  const bookingId = await db.transaction(async (tx) => {
    const [quote] = await tx
      .select({
        id: quotations.id,
        requestId: quotations.requestId,
        vendorId: quotations.vendorId,
        status: quotations.status,
        totalPrice: quotations.totalPrice,
        additionalCharges: quotations.additionalCharges,
        currency: quotations.currency,
        requestStatus: serviceRequests.status,
        selectedQuotationId: serviceRequests.selectedQuotationId,
        requestTitle: serviceRequests.title,
        requestReference: serviceRequests.reference,
        societyId: societies.id,
        societyUserId: societies.userId,
        societyName: societies.name,
        vendorUserId: vendors.userId,
        vendorBusinessName: vendors.businessName,
      })
      .from(quotations)
      .innerJoin(serviceRequests, eq(serviceRequests.id, quotations.requestId))
      .innerJoin(societies, eq(societies.id, serviceRequests.societyId))
      .innerJoin(vendors, eq(vendors.id, quotations.vendorId))
      .where(eq(quotations.id, input.quotationId))
      .limit(1);

    if (!quote || quote.societyUserId !== viewer.id) {
      throw AppError.notFound('Quotation not found');
    }

    if (
      quote.status !== 'selected' ||
      quote.requestStatus !== 'selected' ||
      quote.selectedQuotationId !== quote.id
    ) {
      throw AppError.conflict('CONFLICT', 'Hire a vendor by selecting their quotation first');
    }

    // Serialize writers for this vendor so two societies cannot both pass the
    // overlap check for the same window.
    const [lockedVendor] = await tx
      .select({ id: vendors.id })
      .from(vendors)
      .where(eq(vendors.id, quote.vendorId))
      .for('update')
      .limit(1);

    if (!lockedVendor) {
      throw AppError.notFound('Vendor not found');
    }

    const [existingForRequest] = await tx
      .select({ id: bookings.id })
      .from(bookings)
      .where(and(eq(bookings.requestId, quote.requestId), eq(bookings.status, 'confirmed')))
      .limit(1);

    if (existingForRequest) {
      throw AppError.conflict('CONFLICT', 'This request already has an active hire');
    }

    const [conflict] = await tx
      .select({ id: bookings.id, startsAt: bookings.startsAt, endsAt: bookings.endsAt })
      .from(bookings)
      .where(
        and(
          eq(bookings.vendorId, quote.vendorId),
          eq(bookings.status, 'confirmed'),
          lt(bookings.startsAt, input.endsAt),
          gt(bookings.endsAt, input.startsAt),
        ),
      )
      .limit(1);

    if (conflict) {
      throw AppError.conflict(
        'BOOKING_CONFLICT',
        `This vendor is already hired for ${formatRange(conflict.startsAt, conflict.endsAt)}. Choose another time.`,
      );
    }

    const amount = toNumber(quote.totalPrice) + toNumber(quote.additionalCharges ?? '0');

    const [created] = await tx
      .insert(bookings)
      .values({
        requestId: quote.requestId,
        quotationId: quote.id,
        societyId: quote.societyId,
        vendorId: quote.vendorId,
        startsAt: input.startsAt,
        endsAt: input.endsAt,
        amount: amount.toFixed(2),
        currency: quote.currency,
        notes: input.notes ?? null,
        status: 'confirmed',
      })
      .returning({ id: bookings.id });

    if (!created) {
      throw AppError.conflict('CONFLICT', 'Unable to create the hire. Please retry.');
    }

    await writeAuditTx(tx, {
      actorId: viewer.id,
      action: 'booking.created',
      targetType: 'booking',
      targetId: created.id,
      metadata: { requestId: quote.requestId, vendorId: quote.vendorId },
    });

    if (quote.vendorUserId) {
      bookingNotification = {
        userId: quote.vendorUserId,
        type: 'booking_created',
        title: 'You have been hired',
        body: `${quote.societyName} hired you for "${quote.requestTitle}" (${formatRange(input.startsAt, input.endsAt)}).`,
        link: '/vendor',
      };
    }

    return created.id;
  });

  if (bookingNotification) {
    await notifyBestEffort(bookingNotification);
  }

  return getBooking(bookingId);
}

export async function getBooking(bookingId: string): Promise<BookingDetail> {
  const [row] = await db
    .select({
      id: bookings.id,
      requestId: bookings.requestId,
      quotationId: bookings.quotationId,
      societyId: bookings.societyId,
      vendorId: bookings.vendorId,
      startsAt: bookings.startsAt,
      endsAt: bookings.endsAt,
      amount: bookings.amount,
      currency: bookings.currency,
      notes: bookings.notes,
      status: bookings.status,
      createdAt: bookings.createdAt,
      updatedAt: bookings.updatedAt,
      requestIdRef: serviceRequests.id,
      requestReference: serviceRequests.reference,
      requestTitle: serviceRequests.title,
      vendorIdRef: vendors.id,
      vendorBusinessName: vendors.businessName,
    })
    .from(bookings)
    .innerJoin(serviceRequests, eq(serviceRequests.id, bookings.requestId))
    .innerJoin(vendors, eq(vendors.id, bookings.vendorId))
    .where(eq(bookings.id, bookingId))
    .limit(1);

  if (!row) {
    throw AppError.notFound('Booking not found');
  }

  return {
    id: row.id,
    requestId: row.requestId,
    quotationId: row.quotationId,
    societyId: row.societyId,
    vendorId: row.vendorId,
    startsAt: row.startsAt,
    endsAt: row.endsAt,
    amount: toNumber(row.amount),
    currency: row.currency,
    notes: row.notes,
    status: row.status,
    request: {
      id: row.requestIdRef,
      reference: row.requestReference,
      title: row.requestTitle,
    },
    vendor: {
      id: row.vendorIdRef,
      businessName: row.vendorBusinessName,
    },
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export async function listMyBookings(viewer: BookingViewer): Promise<BookingDetail[]> {
  let rows: { id: string }[] = [];

  if (viewer.role === 'society') {
    const [society] = await db
      .select({ id: societies.id })
      .from(societies)
      .where(eq(societies.userId, viewer.id))
      .limit(1);

    if (society) {
      rows = await db
        .select({ id: bookings.id })
        .from(bookings)
        .where(eq(bookings.societyId, society.id))
        .orderBy(asc(bookings.startsAt));
    }
  } else if (viewer.role === 'vendor') {
    const [vendor] = await db
      .select({ id: vendors.id })
      .from(vendors)
      .where(eq(vendors.userId, viewer.id))
      .limit(1);

    if (vendor) {
      rows = await db
        .select({ id: bookings.id })
        .from(bookings)
        .where(eq(bookings.vendorId, vendor.id))
        .orderBy(asc(bookings.startsAt));
    }
  }

  return Promise.all(rows.map((row) => getBooking(row.id)));
}

export async function getVendorAvailability(
  vendorId: string,
  query: AvailabilityQuery,
): Promise<VendorAvailability> {
  const [vendor] = await db
    .select({ id: vendors.id })
    .from(vendors)
    .innerJoin(users, eq(users.id, vendors.userId))
    .where(and(eq(vendors.id, vendorId), eq(users.status, 'active')))
    .limit(1);

  if (!vendor) {
    throw AppError.notFound('Vendor not found');
  }

  const now = new Date();
  const from = query.from ?? now;
  const to = query.to ?? new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

  if (to <= from) {
    throw AppError.badRequest('The end time must be after the start time');
  }

  const busy = await db
    .select({ id: bookings.id, startsAt: bookings.startsAt, endsAt: bookings.endsAt })
    .from(bookings)
    .where(
      and(
        eq(bookings.vendorId, vendorId),
        eq(bookings.status, 'confirmed'),
        lt(bookings.startsAt, to),
        gt(bookings.endsAt, from),
      ),
    )
    .orderBy(asc(bookings.startsAt));

  return {
    vendorId,
    from,
    to,
    available: busy.length === 0,
    busyWindows: busy,
  };
}

/**
 * Quotations the signed-in society can act on directly from a vendor profile.
 * Selection still follows the request lifecycle; hiring still requires a
 * selected quotation, so this endpoint only exposes the society's own data.
 */
export async function listVendorHireOptions(
  viewer: BookingViewer,
  vendorId: string,
): Promise<VendorHireOptionPage> {
  if (viewer.role !== 'society') {
    throw AppError.forbidden('Only societies can hire vendors');
  }

  const [society] = await db
    .select({ id: societies.id })
    .from(societies)
    .where(eq(societies.userId, viewer.id))
    .limit(1);

  if (!society) return { vendorId, items: [] };

  const rows = await db
    .select({
      quotationId: quotations.id,
      reference: quotations.reference,
      quotationStatus: quotations.status,
      validUntil: quotations.validUntil,
      totalPrice: quotations.totalPrice,
      currency: quotations.currency,
      requestId: serviceRequests.id,
      requestReference: serviceRequests.reference,
      requestTitle: serviceRequests.title,
      requestStatus: serviceRequests.status,
      selectedQuotationId: serviceRequests.selectedQuotationId,
      eventName: events.name,
      eventDate: events.eventDate,
    })
    .from(quotations)
    .innerJoin(serviceRequests, eq(serviceRequests.id, quotations.requestId))
    .leftJoin(events, eq(events.id, serviceRequests.eventId))
    .where(
      and(
        eq(quotations.vendorId, vendorId),
        eq(serviceRequests.societyId, society.id),
        inArray(serviceRequests.status, ['partially_quoted', 'quoted', 'selected']),
      ),
    )
    .orderBy(desc(serviceRequests.updatedAt));

  const requestIds = [...new Set(rows.map((row) => row.requestId))];
  const bookingRows: BookingSummaryRow[] = requestIds.length
    ? await db
        .select({
          id: bookings.id,
          quotationId: bookings.quotationId,
          vendorId: bookings.vendorId,
          status: bookings.status,
          startsAt: bookings.startsAt,
          endsAt: bookings.endsAt,
          amount: bookings.amount,
          currency: bookings.currency,
          requestId: bookings.requestId,
        })
        .from(bookings)
        .where(and(eq(bookings.vendorId, vendorId), inArray(bookings.requestId, requestIds)))
    : [];

  const bookingPriority: Record<string, number> = {
    confirmed: 0,
    completed: 1,
    cancelled: 2,
  };
  const bookingByRequest = new Map<string, BookingSummary>();
  for (const row of bookingRows) {
    const booking: BookingSummary = {
      id: row.id,
      quotationId: row.quotationId,
      vendorId: row.vendorId,
      status: row.status,
      startsAt: row.startsAt,
      endsAt: row.endsAt,
      amount: toNumber(row.amount),
      currency: row.currency,
      requestId: row.requestId,
    };
    const existing = bookingByRequest.get(row.requestId);
    const priority = bookingPriority[row.status] ?? 3;
    const existingPriority = existing ? (bookingPriority[existing.status] ?? 3) : 4;
    if (!existing || priority < existingPriority) {
      bookingByRequest.set(row.requestId, booking);
    }
  }

  const now = new Date();
  const selectableStatuses = new Set<string>(REQUEST_ACCEPTS_DECISIONS);
  const decidableStatuses = new Set<string>(QUOTATION_DECIDABLE);

  return {
    vendorId,
    items: rows.map((row) => {
      const booking = bookingByRequest.get(row.requestId) ?? null;
      const canSelect =
        selectableStatuses.has(row.requestStatus) &&
        decidableStatuses.has(row.quotationStatus) &&
        (!row.validUntil || row.validUntil > now);
      const canHire =
        row.requestStatus === 'selected' &&
        row.selectedQuotationId === row.quotationId &&
        row.quotationStatus === 'selected' &&
        booking?.status !== 'confirmed';

      return {
        quotationId: row.quotationId,
        reference: row.reference,
        requestId: row.requestId,
        requestReference: row.requestReference,
        requestTitle: row.requestTitle,
        eventName: row.eventName,
        eventDate: row.eventDate,
        totalPrice: toNumber(row.totalPrice),
        currency: row.currency,
        quotationStatus: row.quotationStatus,
        requestStatus: row.requestStatus,
        canSelect,
        canHire,
        booking,
      };
    }),
  };
}

export async function cancelBooking(
  viewer: BookingViewer,
  bookingId: string,
  input: CancelBookingInput,
): Promise<BookingDetail> {
  const result = await db.transaction(async (tx) => {
    const [row] = await tx
      .select({
        id: bookings.id,
        status: bookings.status,
        societyUserId: societies.userId,
        societyName: societies.name,
        vendorUserId: vendors.userId,
        vendorBusinessName: vendors.businessName,
        requestTitle: serviceRequests.title,
      })
      .from(bookings)
      .innerJoin(societies, eq(societies.id, bookings.societyId))
      .innerJoin(vendors, eq(vendors.id, bookings.vendorId))
      .innerJoin(serviceRequests, eq(serviceRequests.id, bookings.requestId))
      .where(eq(bookings.id, bookingId))
      .for('update')
      .limit(1);

    if (!row) {
      throw AppError.notFound('Booking not found');
    }

    const isSociety = row.societyUserId === viewer.id;
    const isVendor = row.vendorUserId === viewer.id;
    if (!isSociety && !isVendor) {
      throw AppError.notFound('Booking not found');
    }

    if (row.status !== 'confirmed') {
      throw AppError.conflict('CONFLICT', 'Only an active hire can be cancelled');
    }

    await tx
      .update(bookings)
      .set({ status: 'cancelled', updatedAt: new Date() })
      .where(eq(bookings.id, bookingId));

    await writeAuditTx(tx, {
      actorId: viewer.id,
      action: 'booking.cancelled',
      targetType: 'booking',
      targetId: bookingId,
      metadata: input.reason ? { reason: input.reason } : undefined,
    });

    const recipient = isSociety ? row.vendorUserId : row.societyUserId;
    const recipientLabel = isSociety ? row.vendorBusinessName : row.societyName;

    return {
      recipient,
      societyName: row.societyName,
      vendorBusinessName: row.vendorBusinessName,
      requestTitle: row.requestTitle,
      recipientLabel,
    };
  });

  if (result.recipient) {
    await notifyBestEffort({
      userId: result.recipient,
      type: 'booking_cancelled',
      title: 'Hire cancelled',
      body: `${result.societyName} and ${result.vendorBusinessName}'s hire for "${result.requestTitle}" was cancelled.`,
      link: viewer.role === 'society' ? '/society/requests' : '/vendor',
    });
  }

  return getBooking(bookingId);
}
