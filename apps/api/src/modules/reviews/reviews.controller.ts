import type { RequestHandler } from 'express';
import type { ReviewCreateInput } from '@event-bridge/shared';
import { AppError } from '../../lib/errors.js';
import { createReview, listVendorReviews } from './reviews.service.js';

export const createReviewHandler: RequestHandler = async (req, res) => {
  if (!req.user) throw AppError.unauthenticated();

  const review = await createReview(
    req.user.id,
    req.params.id as string,
    req.body as ReviewCreateInput,
  );
  res.status(201).json({ data: review });
};

export const listVendorReviewsHandler: RequestHandler = async (req, res) => {
  const reviews = await listVendorReviews(req.params.id as string);
  res.json({ data: reviews });
};
