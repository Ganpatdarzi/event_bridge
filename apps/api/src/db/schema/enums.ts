import { pgEnum } from 'drizzle-orm/pg-core';

export const userRoleEnum = pgEnum('user_role', ['society', 'vendor', 'admin']);

export const accountStatusEnum = pgEnum('account_status', ['active', 'suspended', 'deactivated']);

export const vendorStatusEnum = pgEnum('vendor_status', [
  'pending_review',
  'verified',
  'changes_requested',
  'rejected',
  'suspended',
  'deactivated',
]);

export const requestStatusEnum = pgEnum('request_status', [
  'draft',
  'submitted',
  'open',
  'partially_quoted',
  'quoted',
  'selected',
  'completed',
  'closed',
  'cancelled',
]);

export const quotationStatusEnum = pgEnum('quotation_status', [
  'submitted',
  'updated',
  'withdrawn',
  'preferred',
  'selected',
  'not_selected',
  'expired',
]);

export const bookingStatusEnum = pgEnum('booking_status', ['confirmed', 'cancelled', 'completed']);

export const distributionStatusEnum = pgEnum('distribution_status', [
  'invited',
  'viewed',
  'responded',
  'declined',
]);

export const notificationTypeEnum = pgEnum('notification_type', [
  'request_new',
  'new_quotation',
  'quotation_selected',
  'quotation_rejected',
  'request_closed',
  'request_completed',
  'booking_created',
  'booking_cancelled',
  'vendor_status',
]);
