import { Router } from 'express';
import { uuidSchema } from '@event-bridge/shared';
import { z } from 'zod';
import { authenticate, authorize } from '../../middleware/auth.js';
import { validateParams } from '../../middleware/validate.js';
import { withdrawQuotationHandler } from './quotations.controller.js';

const idParams = z.object({ id: uuidSchema });

export const quotationsRouter = Router();

quotationsRouter.use(authenticate);

quotationsRouter.post(
  '/:id/withdraw',
  authorize('vendor'),
  validateParams(idParams),
  withdrawQuotationHandler,
);
