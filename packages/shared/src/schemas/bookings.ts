import { z } from 'zod';
import { uuidSchema } from './common.js';

export const createBookingSchema = z
  .object({
    quotationId: uuidSchema,
    startsAt: z.coerce.date({
      error: 'Enter a valid hire start time',
    }),
    endsAt: z.coerce.date({
      error: 'Enter a valid hire end time',
    }),
    notes: z.string().trim().max(500).optional(),
  })
  .superRefine((value, ctx) => {
    if (value.endsAt <= value.startsAt) {
      ctx.addIssue({
        code: 'custom',
        path: ['endsAt'],
        message: 'The hire end time must be after the start time',
      });
      return;
    }

    const thirtyDays = 30 * 24 * 60 * 60 * 1000;
    if (value.endsAt.getTime() - value.startsAt.getTime() > thirtyDays) {
      ctx.addIssue({
        code: 'custom',
        path: ['endsAt'],
        message: 'A hire can cover at most 30 days',
      });
    }
  });

export type CreateBookingInput = z.infer<typeof createBookingSchema>;

export const cancelBookingSchema = z.object({
  reason: z.string().trim().min(3).max(300).optional(),
});

export type CancelBookingInput = z.infer<typeof cancelBookingSchema>;

export const availabilityQuerySchema = z
  .object({
    from: z.coerce.date({ error: 'Enter a valid start time' }).optional(),
    to: z.coerce.date({ error: 'Enter a valid end time' }).optional(),
  })
  .superRefine((value, ctx) => {
    if (value.to && value.from && value.to <= value.from) {
      ctx.addIssue({
        code: 'custom',
        path: ['to'],
        message: 'The end time must be after the start time',
      });
    }
  });

export type AvailabilityQuery = z.infer<typeof availabilityQuerySchema>;
