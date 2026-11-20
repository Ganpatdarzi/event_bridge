import { z } from 'zod';
import { PASSWORD_MIN_LENGTH } from '../constants.js';

export const emailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .pipe(z.email({ message: 'Enter a valid email address' }));

export const passwordSchema = z
  .string()
  .min(PASSWORD_MIN_LENGTH, `Password must be at least ${PASSWORD_MIN_LENGTH} characters`)
  .max(128, 'Password must be at most 128 characters')
  .regex(/[A-Za-z]/, 'Password must contain a letter')
  .regex(/[0-9]/, 'Password must contain a number');

export const uuidSchema = z.uuid({ message: 'Invalid identifier' });

/**
 * Accepts numbers and numeric strings (query params) but rejects booleans,
 * which `z.coerce.number()` silently turns into 1 / 0.
 */
export const numericInput = z.preprocess((value) => {
  if (typeof value === 'string' && value.trim() !== '') {
    const numeric = Number(value);
    if (Number.isFinite(numeric)) return numeric;
  }
  return value;
}, z.number());

export const paginationSchema = z.object({
  page: numericInput.pipe(z.number().int().min(1)).default(1),
  pageSize: numericInput.pipe(z.number().int().min(1).max(100)).default(20),
});

export type Pagination = z.infer<typeof paginationSchema>;
