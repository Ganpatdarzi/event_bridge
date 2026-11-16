import { requestStatusSchema, uuidSchema } from '@event-bridge/shared';
import { z } from 'zod';

const sortSchema = z.enum(['newest', 'oldest', 'deadline']);

export const requestListQuerySchema = z.object({
  status: requestStatusSchema.optional(),
  categoryId: uuidSchema.optional(),
  search: z.string().trim().min(1).max(100).optional(),
  societyId: uuidSchema.optional(),
  sort: sortSchema.default('newest'),
});

export const vendorRequestQuerySchema = z.object({
  categoryId: uuidSchema.optional(),
  search: z.string().trim().min(1).max(100).optional(),
  sort: sortSchema.default('deadline'),
});
