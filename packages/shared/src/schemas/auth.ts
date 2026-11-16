import { z } from 'zod';
import { emailSchema, passwordSchema, uuidSchema } from './common.js';

const accountSchema = z.object({
  name: z.string().trim().min(2, 'Name is required').max(120),
  email: emailSchema,
  password: passwordSchema,
});

export const societyProfileSchema = z.object({
  societyName: z.string().trim().min(2, 'Society name is required').max(160),
  institution: z.string().trim().min(2, 'Institution is required').max(160),
  contactPerson: z.string().trim().min(2, 'Contact person is required').max(120),
  contactEmail: emailSchema.optional(),
  contactPhone: z.string().trim().min(7).max(40).optional(),
  description: z.string().trim().max(2000).optional(),
});

export const vendorProfileSchema = z.object({
  businessName: z.string().trim().min(2, 'Business name is required').max(160),
  description: z
    .string()
    .trim()
    .min(20, 'Describe your business in at least 20 characters')
    .max(2000),
  city: z.string().trim().min(2, 'City is required').max(80),
  serviceArea: z.string().trim().max(300).optional(),
  contactPerson: z.string().trim().min(2, 'Contact person is required').max(120).optional(),
  contactPhone: z.string().trim().min(7, 'Enter a valid phone number').max(40).optional(),
  categoryIds: z.array(uuidSchema).max(10).optional(),
});

export const registerSchema = z.discriminatedUnion('role', [
  accountSchema.extend({
    role: z.literal('society'),
    society: societyProfileSchema,
  }),
  accountSchema.extend({
    role: z.literal('vendor'),
    vendor: vendorProfileSchema,
  }),
]);

export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, 'Password is required'),
});

export const updateSocietyProfileSchema = societyProfileSchema
  .partial()
  .refine((value) => Object.values(value).some((field) => field !== undefined), {
    message: 'Provide at least one field to update',
  });

export const updateVendorProfileSchema = vendorProfileSchema
  .partial()
  .refine((value) => Object.values(value).some((field) => field !== undefined), {
    message: 'Provide at least one field to update',
  });

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type SocietyProfileInput = z.infer<typeof societyProfileSchema>;
export type VendorProfileInput = z.infer<typeof vendorProfileSchema>;
export type UpdateSocietyProfileInput = z.infer<typeof updateSocietyProfileSchema>;
export type UpdateVendorProfileInput = z.infer<typeof updateVendorProfileSchema>;
