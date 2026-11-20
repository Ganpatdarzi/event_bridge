import { z } from 'zod';
import { numericInput } from './common.js';

export const reviewCreateSchema = z.object({
  rating: numericInput.pipe(z.number().int().min(1).max(5)),
  comment: z.string().trim().max(2000).optional(),
});

export type ReviewCreateInput = z.infer<typeof reviewCreateSchema>;
