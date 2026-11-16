import { z } from 'zod';

export const categorySlugSchema = z
  .string()
  .trim()
  .toLowerCase()
  .min(2, 'Slug must be at least 2 characters')
  .max(80, 'Slug must be at most 80 characters')
  .regex(
    /^[a-z0-9]+(?:-[a-z0-9]+)*$/,
    'Use lowercase letters, numbers and single hyphens (e.g. sound-lighting-av)',
  );

export const categoryCreateSchema = z.object({
  name: z.string().trim().min(2, 'Name is required').max(80),
  slug: categorySlugSchema.optional(),
  description: z.string().trim().max(1000).optional(),
  sortOrder: z.coerce.number().int().min(0).max(9999).default(0),
  isActive: z.boolean().default(true),
});

export const categoryUpdateSchema = z
  .object({
    name: z.string().trim().min(2, 'Name is required').max(80).optional(),
    slug: categorySlugSchema.optional(),
    description: z.string().trim().max(1000).optional(),
    sortOrder: z.coerce.number().int().min(0).max(9999).optional(),
  })
  .refine((value) => Object.values(value).some((field) => field !== undefined), {
    message: 'Provide at least one field to update',
  });

export const categoryStatusSchema = z.object({
  isActive: z.boolean(),
});

export type CategoryCreateInput = z.infer<typeof categoryCreateSchema>;
export type CategoryUpdateInput = z.infer<typeof categoryUpdateSchema>;
