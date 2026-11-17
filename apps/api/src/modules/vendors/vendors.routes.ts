import { Router } from 'express';
import { updateVendorProfileSchema, uuidSchema } from '@event-bridge/shared';
import { z } from 'zod';
import { authenticate, authorize } from '../../middleware/auth.js';
import { validateBody, validateParams } from '../../middleware/validate.js';
import {
  addPortfolioImageHandler,
  getMyVendor,
  getVendor,
  listVendors,
  removePortfolioImageHandler,
  updateMyVendor,
} from './vendors.controller.js';
import { listVendorReviewsHandler } from '../reviews/reviews.controller.js';

const vendorParams = z.object({ id: uuidSchema });
const portfolioBodySchema = z.object({
  dataUrl: z.string().trim().min(20).max(3_000_000),
  caption: z.string().trim().max(240).optional(),
});

export const vendorsRouter = Router();

// `/me` must be registered before `/:id`, otherwise "me" is treated as an id.
vendorsRouter.get('/me', authenticate, authorize('vendor'), getMyVendor);
vendorsRouter.patch(
  '/me',
  authenticate,
  authorize('vendor'),
  validateBody(updateVendorProfileSchema),
  updateMyVendor,
);

vendorsRouter.post(
  '/me/portfolio',
  authenticate,
  authorize('vendor'),
  validateBody(portfolioBodySchema),
  addPortfolioImageHandler,
);

vendorsRouter.delete(
  '/me/portfolio/:id',
  authenticate,
  authorize('vendor'),
  validateParams(vendorParams),
  removePortfolioImageHandler,
);

vendorsRouter.get('/', listVendors);
vendorsRouter.get('/:id', validateParams(vendorParams), getVendor);
vendorsRouter.get('/:id/reviews', validateParams(vendorParams), listVendorReviewsHandler);
