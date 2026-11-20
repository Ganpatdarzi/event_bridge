import { z } from 'zod';
import {
  accountStatusSchema,
  userRoleSchema,
  uuidSchema,
  vendorStatusSchema,
} from '@event-bridge/shared';

export const adminVendorQuerySchema = z.object({
  status: vendorStatusSchema.optional(),
  search: z.string().trim().min(1).max(120).optional(),
});

export const adminUserQuerySchema = z.object({
  role: userRoleSchema.optional(),
  status: accountStatusSchema.optional(),
  search: z.string().trim().min(1).max(120).optional(),
});

export const auditLogQuerySchema = z
  .object({
    actorId: uuidSchema.optional(),
    action: z.string().trim().min(1).max(80).optional(),
    targetType: z.string().trim().min(1).max(60).optional(),
    targetId: uuidSchema.optional(),
    from: z.coerce.date().optional(),
    to: z.coerce.date().optional(),
  })
  .refine((value) => !value.from || !value.to || value.from <= value.to, {
    message: '`from` must be before `to`',
    path: ['from'],
  });

export const adminReviewQuerySchema = z.object({
  hidden: z
    .enum(['true', 'false'])
    .transform((value) => value === 'true')
    .optional(),
  vendorId: uuidSchema.optional(),
  search: z.string().trim().min(1).max(120).optional(),
});

export const systemSettingUpdateSchema = z.object({
  value: z.string().trim().min(1).max(10000),
});

export type AdminReviewQuery = z.infer<typeof adminReviewQuerySchema>;
export type AdminUserQuery = z.infer<typeof adminUserQuerySchema>;
export type AuditLogQuery = z.infer<typeof auditLogQuerySchema>;
