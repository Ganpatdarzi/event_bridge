import { Router } from 'express';
import { categoryCreateSchema, categoryUpdateSchema, uuidSchema } from '@event-bridge/shared';
import { z } from 'zod';
import { authenticate, authorize } from '../../middleware/auth.js';
import { validateBody, validateParams } from '../../middleware/validate.js';
import {
  createCategoryHandler,
  listCategories,
  setCategoryStatusHandler,
  updateCategoryHandler,
} from './categories.controller.js';

const categoryParams = z.object({ id: uuidSchema });

export const categoriesRouter = Router();

categoriesRouter.get('/', listCategories);

categoriesRouter.post(
  '/',
  authenticate,
  authorize('admin'),
  validateBody(categoryCreateSchema),
  createCategoryHandler,
);

categoriesRouter.patch(
  '/:id',
  authenticate,
  authorize('admin'),
  validateParams(categoryParams),
  validateBody(categoryUpdateSchema),
  updateCategoryHandler,
);

categoriesRouter.patch(
  '/:id/status',
  authenticate,
  authorize('admin'),
  validateParams(categoryParams),
  setCategoryStatusHandler,
);
