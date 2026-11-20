import { Router } from 'express';
import {
  cancelRequestSchema,
  createRequestSchema,
  reviewCreateSchema,
  updateRequestSchema,
  upsertQuotationSchema,
  uuidSchema,
} from '@event-bridge/shared';
import { z } from 'zod';
import { authenticate, authorize } from '../../middleware/auth.js';
import { validateBody, validateParams } from '../../middleware/validate.js';
import {
  getMyQuotation,
  listQuotations,
  preferQuotationHandler,
  selectQuotationHandler,
  submitQuotation,
} from '../quotations/quotations.controller.js';
import { createReviewHandler } from '../reviews/reviews.controller.js';
import {
  cancelRequest,
  closeRequest,
  createRequest,
  getRequest,
  getRequestVendors,
  listMyRequests,
  listVendorRequestsForMe,
  submitRequest,
  updateRequest,
} from './requests.controller.js';

const idParams = z.object({ id: uuidSchema });
const quotationParams = z.object({ id: uuidSchema, quotationId: uuidSchema });

export const requestsRouter = Router();

requestsRouter.use(authenticate);

requestsRouter.post('/', authorize('society'), validateBody(createRequestSchema), createRequest);
requestsRouter.get('/', authorize('society', 'admin'), listMyRequests);

requestsRouter.get(
  '/:id/vendors',
  authorize('society', 'admin'),
  validateParams(idParams),
  getRequestVendors,
);
requestsRouter.post('/:id/submit', authorize('society'), validateParams(idParams), submitRequest);
requestsRouter.post(
  '/:id/cancel',
  authorize('society', 'admin'),
  validateParams(idParams),
  validateBody(cancelRequestSchema),
  cancelRequest,
);
requestsRouter.post(
  '/:id/close',
  authorize('society', 'admin'),
  validateParams(idParams),
  closeRequest,
);
requestsRouter.get(
  '/:id/quotations/mine',
  authorize('vendor'),
  validateParams(idParams),
  getMyQuotation,
);
requestsRouter.post(
  '/:id/quotations',
  authorize('vendor'),
  validateParams(idParams),
  validateBody(upsertQuotationSchema),
  submitQuotation,
);
requestsRouter.get(
  '/:id/quotations',
  authorize('society', 'admin'),
  validateParams(idParams),
  listQuotations,
);
requestsRouter.post(
  '/:id/quotations/:quotationId/select',
  authorize('society'),
  validateParams(quotationParams),
  selectQuotationHandler,
);
requestsRouter.post(
  '/:id/quotations/:quotationId/prefer',
  authorize('society'),
  validateParams(quotationParams),
  preferQuotationHandler,
);
requestsRouter.post(
  '/:id/review',
  authorize('society'),
  validateParams(idParams),
  validateBody(reviewCreateSchema),
  createReviewHandler,
);
requestsRouter.patch(
  '/:id',
  authorize('society'),
  validateParams(idParams),
  validateBody(updateRequestSchema),
  updateRequest,
);
requestsRouter.get(
  '/:id',
  authorize('society', 'vendor', 'admin'),
  validateParams(idParams),
  getRequest,
);

export const vendorRequestsRouter = Router();

vendorRequestsRouter.use(authenticate, authorize('vendor'));
vendorRequestsRouter.get('/requests', listVendorRequestsForMe);
