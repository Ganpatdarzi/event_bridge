import type { RequestHandler } from 'express';
import { categoryStatusSchema } from '@event-bridge/shared';
import { AppError } from '../../lib/errors.js';
import {
  createCategory,
  listActiveCategories,
  listAllCategories,
  setCategoryStatus,
  updateCategory,
} from './categories.service.js';

export const listCategories: RequestHandler = async (_req, res) => {
  const items = await listActiveCategories();
  res.json({ data: items });
};

export const listCategoriesForAdmin: RequestHandler = async (_req, res) => {
  const items = await listAllCategories();
  res.json({ data: items });
};

export const createCategoryHandler: RequestHandler = async (req, res) => {
  if (!req.user) throw AppError.unauthenticated();

  const category = await createCategory(req.user.id, req.body);
  res.status(201).json({ data: category });
};

export const updateCategoryHandler: RequestHandler = async (req, res) => {
  if (!req.user) throw AppError.unauthenticated();

  const category = await updateCategory(req.user.id, req.params.id as string, req.body);
  res.json({ data: category });
};

export const setCategoryStatusHandler: RequestHandler = async (req, res) => {
  if (!req.user) throw AppError.unauthenticated();

  const { isActive } = categoryStatusSchema.parse(req.body);
  const category = await setCategoryStatus(req.user.id, req.params.id as string, isActive);
  res.json({ data: category });
};
