import type { RequestHandler } from 'express';
import { optionalReasonSchema } from '@event-bridge/shared';
import { AppError } from '../../lib/errors.js';
import { parsePagination } from '../../lib/pagination.js';
import {
  adminReviewQuerySchema,
  adminUserQuerySchema,
  adminVendorQuerySchema,
  auditLogQuerySchema,
} from './admin.schema.js';
import {
  changeUserStatus,
  getAdminStats,
  listAuditLogs,
  listReviewsForAdmin,
  listSystemSettings,
  listUsers,
  listVendorsForReview,
  moderateReview,
  reviewVendor,
  upsertSystemSetting,
} from './admin.service.js';

function optionalReason(body: unknown): string | undefined {
  return optionalReasonSchema.parse(body ?? {}).reason;
}

export const listVendorQueue: RequestHandler = async (req, res) => {
  const page = parsePagination(req.query);
  const filter = adminVendorQuerySchema.parse(req.query);
  const result = await listVendorsForReview({ ...page, ...filter });
  res.json({ data: result });
};

export const approveVendor: RequestHandler = async (req, res) => {
  if (!req.user) throw AppError.unauthenticated();
  const vendor = await reviewVendor(req.user.id, req.params.id as string, 'approve');
  res.json({ data: vendor });
};

export const rejectVendor: RequestHandler = async (req, res) => {
  if (!req.user) throw AppError.unauthenticated();
  const vendor = await reviewVendor(
    req.user.id,
    req.params.id as string,
    'reject',
    req.body.reason,
  );
  res.json({ data: vendor });
};

export const requestVendorChanges: RequestHandler = async (req, res) => {
  if (!req.user) throw AppError.unauthenticated();
  const vendor = await reviewVendor(
    req.user.id,
    req.params.id as string,
    'request_changes',
    req.body.reason,
  );
  res.json({ data: vendor });
};

export const suspendVendor: RequestHandler = async (req, res) => {
  if (!req.user) throw AppError.unauthenticated();
  const vendor = await reviewVendor(
    req.user.id,
    req.params.id as string,
    'suspend',
    optionalReason(req.body),
  );
  res.json({ data: vendor });
};

export const restoreVendor: RequestHandler = async (req, res) => {
  if (!req.user) throw AppError.unauthenticated();
  const vendor = await reviewVendor(req.user.id, req.params.id as string, 'restore');
  res.json({ data: vendor });
};

export const listAccounts: RequestHandler = async (req, res) => {
  const page = parsePagination(req.query);
  const filter = adminUserQuerySchema.parse(req.query);
  const result = await listUsers({ ...page, ...filter });
  res.json({ data: result });
};

export const suspendUser: RequestHandler = async (req, res) => {
  if (!req.user) throw AppError.unauthenticated();
  const user = await changeUserStatus(
    req.user.id,
    req.params.id as string,
    'suspend',
    optionalReason(req.body),
  );
  res.json({ data: user });
};

export const reactivateUser: RequestHandler = async (req, res) => {
  if (!req.user) throw AppError.unauthenticated();
  const user = await changeUserStatus(req.user.id, req.params.id as string, 'reactivate');
  res.json({ data: user });
};

export const deactivateUser: RequestHandler = async (req, res) => {
  if (!req.user) throw AppError.unauthenticated();
  const user = await changeUserStatus(
    req.user.id,
    req.params.id as string,
    'deactivate',
    optionalReason(req.body),
  );
  res.json({ data: user });
};

export const getAuditLogs: RequestHandler = async (req, res) => {
  const page = parsePagination(req.query);
  const filter = auditLogQuerySchema.parse(req.query);
  const result = await listAuditLogs({ ...page, ...filter });
  res.json({ data: result });
};

export const getStats: RequestHandler = async (_req, res) => {
  const stats = await getAdminStats();
  res.json({ data: stats });
};

export const listReviews: RequestHandler = async (req, res) => {
  const page = parsePagination(req.query);
  const filter = adminReviewQuerySchema.parse(req.query);
  const result = await listReviewsForAdmin({ ...page, ...filter });
  res.json({ data: result });
};

export const hideReview: RequestHandler = async (req, res) => {
  if (!req.user) throw AppError.unauthenticated();
  const review = await moderateReview(
    req.user.id,
    req.params.id as string,
    'hide',
    optionalReason(req.body),
  );
  res.json({ data: review });
};

export const unhideReview: RequestHandler = async (req, res) => {
  if (!req.user) throw AppError.unauthenticated();
  const review = await moderateReview(req.user.id, req.params.id as string, 'unhide');
  res.json({ data: review });
};

export const listSettings: RequestHandler = async (_req, res) => {
  const settings = await listSystemSettings();
  res.json({ data: settings });
};

export const updateSetting: RequestHandler = async (req, res) => {
  if (!req.user) throw AppError.unauthenticated();
  const setting = await upsertSystemSetting(req.user.id, req.params.key as string, req.body.value);
  res.json({ data: setting });
};
