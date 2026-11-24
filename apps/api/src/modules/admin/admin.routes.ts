import { Router } from 'express';
import { decisionReasonSchema, optionalReasonSchema, uuidSchema } from '@event-bridge/shared';
import { z } from 'zod';
import { authenticate, authorize } from '../../middleware/auth.js';
import { validateBody, validateParams } from '../../middleware/validate.js';
import { listCategoriesForAdmin } from '../categories/categories.controller.js';
import { systemSettingUpdateSchema } from './admin.schema.js';
import {
  activateVendor,
  approveVendor,
  deactivateUser,
  deactivateVendor,
  getAuditLogs,
  getStats,
  hideReview,
  listAccounts,
  listReviews,
  listSettings,
  listVendorQueue,
  reactivateUser,
  rejectVendor,
  requestVendorChanges,
  restoreVendor,
  suspendUser,
  suspendVendor,
  unhideReview,
  updateSetting,
} from './admin.controller.js';

const idParams = z.object({ id: uuidSchema });

export const adminRouter = Router();

adminRouter.use(authenticate, authorize('admin'));

adminRouter.get('/stats', getStats);
adminRouter.get('/audit-logs', getAuditLogs);
adminRouter.get('/categories', listCategoriesForAdmin);

adminRouter.get('/vendors', listVendorQueue);
adminRouter.post('/vendors/:id/approve', validateParams(idParams), approveVendor);
adminRouter.post(
  '/vendors/:id/reject',
  validateParams(idParams),
  validateBody(decisionReasonSchema),
  rejectVendor,
);
adminRouter.post(
  '/vendors/:id/request-changes',
  validateParams(idParams),
  validateBody(decisionReasonSchema),
  requestVendorChanges,
);
adminRouter.post('/vendors/:id/suspend', validateParams(idParams), suspendVendor);
adminRouter.post(
  '/vendors/:id/deactivate',
  validateParams(idParams),
  validateBody(optionalReasonSchema),
  deactivateVendor,
);
adminRouter.post('/vendors/:id/activate', validateParams(idParams), activateVendor);
adminRouter.post('/vendors/:id/restore', validateParams(idParams), restoreVendor);

adminRouter.get('/users', listAccounts);
adminRouter.post('/users/:id/suspend', validateParams(idParams), suspendUser);
adminRouter.post('/users/:id/reactivate', validateParams(idParams), reactivateUser);
adminRouter.post('/users/:id/deactivate', validateParams(idParams), deactivateUser);

adminRouter.get('/reviews', listReviews);
adminRouter.post(
  '/reviews/:id/hide',
  validateParams(idParams),
  validateBody(optionalReasonSchema),
  hideReview,
);
adminRouter.post('/reviews/:id/unhide', validateParams(idParams), unhideReview);

adminRouter.get('/settings', listSettings);
adminRouter.put(
  '/settings/:key',
  validateParams(z.object({ key: z.string().trim().min(1).max(120) })),
  validateBody(systemSettingUpdateSchema),
  updateSetting,
);
