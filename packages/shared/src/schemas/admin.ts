import { z } from 'zod';

/** Body for decisions that must explain themselves (reject, request changes). */
export const decisionReasonSchema = z.object({
  reason: z.string().trim().min(5, 'Explain the decision in at least 5 characters').max(1000),
});

/** Body for actions where a reason is optional (suspend, deactivate). */
export const optionalReasonSchema = z.object({
  reason: z.string().trim().max(1000).optional(),
});

export const adminVendorActionSchema = z.enum([
  'approve',
  'reject',
  'request_changes',
  'suspend',
  'restore',
  'deactivate',
  'activate',
]);

export const adminUserActionSchema = z.enum(['suspend', 'reactivate', 'deactivate']);

export type AdminVendorAction = z.infer<typeof adminVendorActionSchema>;
export type AdminUserAction = z.infer<typeof adminUserActionSchema>;
