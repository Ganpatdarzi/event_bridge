import { Router } from 'express';
import { updateSocietyProfileSchema } from '@event-bridge/shared';
import { authenticate, authorize } from '../../middleware/auth.js';
import { validateBody } from '../../middleware/validate.js';
import { getMySociety, updateMySociety } from './societies.controller.js';

export const societiesRouter = Router();

societiesRouter.get('/me', authenticate, authorize('society'), getMySociety);
societiesRouter.patch(
  '/me',
  authenticate,
  authorize('society'),
  validateBody(updateSocietyProfileSchema),
  updateMySociety,
);
