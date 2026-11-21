import type { RequestHandler } from 'express';
import {
  availabilityQuerySchema,
  cancelBookingSchema,
  type CancelBookingInput,
  type CreateBookingInput,
} from '@event-bridge/shared';
import { AppError } from '../../lib/errors.js';
import {
  cancelBooking,
  createBooking,
  getVendorAvailability,
  listMyBookings,
  listVendorHireOptions,
} from './bookings.service.js';

export const createBookingHandler: RequestHandler = async (req, res) => {
  if (!req.user) throw AppError.unauthenticated();

  const booking = await createBooking(req.user, req.body as CreateBookingInput);
  res.status(201).json({ data: booking });
};

export const listMyBookingsHandler: RequestHandler = async (req, res) => {
  if (!req.user) throw AppError.unauthenticated();

  const bookings = await listMyBookings(req.user);
  res.json({ data: bookings });
};

export const getAvailabilityHandler: RequestHandler = async (req, res) => {
  const query = availabilityQuerySchema.safeParse(req.query);
  if (!query.success) {
    throw AppError.validation(
      query.error.issues.map((issue) => ({
        path: issue.path.join('.'),
        message: issue.message,
      })),
    );
  }

  const availability = await getVendorAvailability(req.params.vendorId as string, query.data);
  res.json({ data: availability });
};

export const listVendorHireOptionsHandler: RequestHandler = async (req, res) => {
  if (!req.user) throw AppError.unauthenticated();

  const options = await listVendorHireOptions(req.user, req.params.vendorId as string);
  res.json({ data: options });
};

export const cancelBookingHandler: RequestHandler = async (req, res) => {
  if (!req.user) throw AppError.unauthenticated();

  const parsed = cancelBookingSchema.safeParse(req.body ?? {});
  if (!parsed.success) {
    throw AppError.validation(
      parsed.error.issues.map((issue) => ({
        path: issue.path.join('.'),
        message: issue.message,
      })),
    );
  }

  const booking = await cancelBooking(
    req.user,
    req.params.id as string,
    parsed.data as CancelBookingInput,
  );
  res.json({ data: booking });
};
