import { z } from 'zod';

/* ------------------------------------------------------------------ */
/* Roles and account state                                             */
/* ------------------------------------------------------------------ */

export const USER_ROLES = ['society', 'vendor', 'admin'] as const;
export type UserRole = (typeof USER_ROLES)[number];
export const userRoleSchema = z.enum(USER_ROLES);

export const ACCOUNT_STATUSES = ['active', 'suspended', 'deactivated'] as const;
export type AccountStatus = (typeof ACCOUNT_STATUSES)[number];
export const accountStatusSchema = z.enum(ACCOUNT_STATUSES);

/* ------------------------------------------------------------------ */
/* Vendor lifecycle                                                    */
/* ------------------------------------------------------------------ */

export const VENDOR_STATUSES = [
  'pending_review',
  'verified',
  'changes_requested',
  'rejected',
  'suspended',
  'deactivated',
] as const;
export type VendorStatus = (typeof VENDOR_STATUSES)[number];
export const vendorStatusSchema = z.enum(VENDOR_STATUSES);

export const VENDOR_TRANSITIONS: Record<VendorStatus, VendorStatus[]> = {
  pending_review: ['verified', 'changes_requested', 'rejected'],
  changes_requested: ['pending_review'],
  verified: ['suspended', 'deactivated'],
  suspended: ['verified', 'deactivated'],
  rejected: ['pending_review'],
  deactivated: [],
};

/* ------------------------------------------------------------------ */
/* Request lifecycle                                                   */
/* ------------------------------------------------------------------ */

export const REQUEST_STATUSES = [
  'draft',
  'submitted',
  'open',
  'partially_quoted',
  'quoted',
  'selected',
  'completed',
  'closed',
  'cancelled',
] as const;
export type RequestStatus = (typeof REQUEST_STATUSES)[number];
export const requestStatusSchema = z.enum(REQUEST_STATUSES);

export const REQUEST_TRANSITIONS: Record<RequestStatus, RequestStatus[]> = {
  draft: ['submitted', 'cancelled'],
  submitted: ['open', 'cancelled'],
  open: ['partially_quoted', 'quoted', 'closed', 'cancelled'],
  // A request can be selected as soon as it has a quotation. `quoted` is a
  // useful review state but is not a prerequisite for selection.
  partially_quoted: ['quoted', 'selected', 'closed', 'cancelled'],
  quoted: ['selected', 'closed', 'cancelled'],
  selected: ['completed', 'cancelled'],
  completed: ['closed'],
  closed: [],
  cancelled: [],
};

/** Statuses in which a request still accepts vendor quotations. */
export const REQUEST_ACCEPTS_QUOTES: RequestStatus[] = ['open', 'partially_quoted', 'quoted'];

/** Statuses from which a society may select or mark a quotation as preferred. */
export const REQUEST_ACCEPTS_DECISIONS: RequestStatus[] = ['partially_quoted', 'quoted'];

/** Statuses in which a society may edit request details. */
export const REQUEST_EDITABLE: RequestStatus[] = ['draft', 'submitted', 'open', 'partially_quoted'];

/* ------------------------------------------------------------------ */
/* Quotation lifecycle                                                 */
/* ------------------------------------------------------------------ */

export const QUOTATION_STATUSES = [
  'submitted',
  'updated',
  'withdrawn',
  'preferred',
  'selected',
  'not_selected',
  'expired',
] as const;
export type QuotationStatus = (typeof QUOTATION_STATUSES)[number];
export const quotationStatusSchema = z.enum(QUOTATION_STATUSES);

export const QUOTATION_TRANSITIONS: Record<QuotationStatus, QuotationStatus[]> = {
  submitted: ['updated', 'withdrawn', 'preferred', 'selected', 'not_selected', 'expired'],
  updated: ['submitted', 'withdrawn', 'preferred', 'selected', 'not_selected', 'expired'],
  // Un-marking a preference returns the offer to its editable/latest revision.
  preferred: ['updated', 'selected', 'not_selected', 'withdrawn', 'expired'],
  selected: [],
  not_selected: [],
  withdrawn: [],
  expired: [],
};

/** Statuses a vendor may still edit or withdraw. */
export const QUOTATION_EDITABLE: QuotationStatus[] = ['submitted', 'updated', 'preferred'];

/** Statuses a society may select or mark as preferred. */
export const QUOTATION_DECIDABLE: QuotationStatus[] = ['submitted', 'updated', 'preferred'];

/* ------------------------------------------------------------------ */
/* Booking (hire) lifecycle                                            */
/* ------------------------------------------------------------------ */

export const BOOKING_STATUSES = ['confirmed', 'cancelled', 'completed'] as const;
export type BookingStatus = (typeof BOOKING_STATUSES)[number];
export const bookingStatusSchema = z.enum(BOOKING_STATUSES);

export const BOOKING_TRANSITIONS: Record<BookingStatus, BookingStatus[]> = {
  confirmed: ['cancelled', 'completed'],
  cancelled: [],
  completed: [],
};

/** Only confirmed bookings reserve a vendor's time. */
export const ACTIVE_BOOKING_STATUSES: BookingStatus[] = ['confirmed'];

export function canTransitionBooking(from: BookingStatus, to: BookingStatus): boolean {
  return BOOKING_TRANSITIONS[from].includes(to);
}

/* ------------------------------------------------------------------ */
/* Distribution                                                        */
/* ------------------------------------------------------------------ */

export const DISTRIBUTION_STATUSES = ['invited', 'viewed', 'responded', 'declined'] as const;
export type DistributionStatus = (typeof DISTRIBUTION_STATUSES)[number];
export const distributionStatusSchema = z.enum(DISTRIBUTION_STATUSES);

/* ------------------------------------------------------------------ */
/* Notifications                                                       */
/* ------------------------------------------------------------------ */

export const NOTIFICATION_TYPES = [
  'request_new',
  'new_quotation',
  'quotation_selected',
  'quotation_rejected',
  'request_closed',
  'request_completed',
  'booking_created',
  'booking_cancelled',
  'vendor_status',
] as const;
export type NotificationType = (typeof NOTIFICATION_TYPES)[number];
export const notificationTypeSchema = z.enum(NOTIFICATION_TYPES);

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */

export function canTransitionRequest(from: RequestStatus, to: RequestStatus): boolean {
  return REQUEST_TRANSITIONS[from].includes(to);
}

export function canTransitionQuotation(from: QuotationStatus, to: QuotationStatus): boolean {
  return QUOTATION_TRANSITIONS[from].includes(to);
}

export function canTransitionVendor(from: VendorStatus, to: VendorStatus): boolean {
  return VENDOR_TRANSITIONS[from].includes(to);
}
