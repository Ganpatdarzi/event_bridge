import type { RequestHandler } from 'express';
import { categorySlugSchema } from '@event-bridge/shared';
import { z } from 'zod';
import { AppError } from '../../lib/errors.js';
import { parsePagination } from '../../lib/pagination.js';
import {
  getMyVendorProfile,
  getPublicVendor,
  listPublicVendors,
  updateMyVendorProfile,
} from './vendors.service.js';

const directoryQuerySchema = z.object({
  search: z.string().trim().min(1).max(100).optional(),
  city: z.string().trim().min(1).max(80).optional(),
  category: categorySlugSchema.optional(),
});

export const listVendors: RequestHandler = async (req, res) => {
  const page = parsePagination(req.query);
  const filter = directoryQuerySchema.parse(req.query);

  const result = await listPublicVendors({ ...page, ...filter });
  res.json({ data: result });
};

export const getVendor: RequestHandler = async (req, res) => {
  const vendor = await getPublicVendor(req.params.id as string);
  res.json({ data: vendor });
};

export const getMyVendor: RequestHandler = async (req, res) => {
  if (!req.user) throw AppError.unauthenticated();

  const vendor = await getMyVendorProfile(req.user.id);
  res.json({ data: vendor });
};

export const updateMyVendor: RequestHandler = async (req, res) => {
  if (!req.user) throw AppError.unauthenticated();

  const vendor = await updateMyVendorProfile(req.user.id, req.body);
  res.json({ data: vendor });
};
