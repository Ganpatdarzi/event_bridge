import { Router } from 'express';
import { createBookingSchema, uuidSchema } from '@event-bridge/shared';
import { z } from 'zod';
import { authenticate, authorize } from '../../middleware/auth.js';
import { validateBody, validateParams } from '../../middleware/validate.js';
import {
  cancelBookingHandler,
  createBookingHandler,
  getAvailabilityHandler,
  listMyBookingsHandler,
} from './bookings.controller.js';

const idParams = z.object({ id: uuidSchema });
const vendorParams = z.object({ vendorId: uuidSchema });

export const bookingsRouter = Router();

bookingsRouter.use(authenticate);

bookingsRouter.get('/availability/:vendorId', validateParams(vendorParams), getAvailabilityHandler);
bookingsRouter.get('/me', listMyBookingsHandler);
bookingsRouter.post(
  '/',
  authorize('society'),
  validateBody(createBookingSchema),
  createBookingHandler,
);
bookingsRouter.post('/:id/cancel', validateParams(idParams), cancelBookingHandler);
