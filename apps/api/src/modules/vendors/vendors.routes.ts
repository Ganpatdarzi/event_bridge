import { Router } from 'express';
import { updateVendorProfileSchema, uuidSchema } from '@event-bridge/shared';
import { z } from 'zod';
import { authenticate, authorize } from '../../middleware/auth.js';
import { validateBody, validateParams } from '../../middleware/validate.js';
import { getMyVendor, getVendor, listVendors, updateMyVendor } from './vendors.controller.js';

const vendorParams = z.object({ id: uuidSchema });

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

vendorsRouter.get('/', listVendors);
vendorsRouter.get('/:id', validateParams(vendorParams), getVendor);
