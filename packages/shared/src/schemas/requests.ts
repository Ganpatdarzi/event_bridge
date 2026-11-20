import { z } from 'zod';
import { numericInput, uuidSchema } from './common.js';

const MAX_MONEY = 9_999_999_999.99;

/** Treat an empty form field as "not set" instead of coercing it to zero. */
function emptyToNull(value: unknown): unknown {
  return value === '' || value === null ? null : value;
}

const nullableMoneySchema = z.preprocess(
  emptyToNull,
  numericInput
    .pipe(
      z
        .number({ message: 'Enter a valid amount' })
        .finite()
        .min(0, 'Amount cannot be negative')
        .max(MAX_MONEY),
    )
    .nullable(),
);

const nullableIntegerSchema = z.preprocess(
  emptyToNull,
  numericInput.pipe(z.number().int().min(1).max(1_000_000)).nullable(),
);

const nullableDateTimeSchema = z.preprocess(
  emptyToNull,
  z.iso.datetime({ offset: true, message: 'Enter a valid date and time' }).nullable(),
);

export const eventCreateSchema = z.object({
  name: z.string().trim().min(3, 'Event name is required').max(180),
  eventDate: z.iso.date({ message: 'Enter a valid event date (YYYY-MM-DD)' }),
  location: z.string().trim().min(3, 'Event location is required').max(240),
  expectedAttendance: numericInput.pipe(z.number().int().min(1).max(1_000_000)).optional(),
});

export const eventUpdateSchema = eventCreateSchema
  .partial()
  .refine((value) => Object.values(value).some((field) => field !== undefined), {
    message: 'Provide at least one event field to update',
  });

const requestCreateBaseSchema = z.object({
  event: eventCreateSchema.optional(),
  eventId: uuidSchema.optional(),
  categoryId: uuidSchema,
  title: z.string().trim().min(5, 'Title is required').max(180),
  description: z
    .string()
    .trim()
    .min(20, 'Describe the requirement in at least 20 characters')
    .max(5000),
  budgetMin: nullableMoneySchema.optional(),
  budgetMax: nullableMoneySchema.optional(),
  quantity: numericInput.pipe(z.number().int().min(1).max(1_000_000)).optional(),
  responseDeadline: nullableDateTimeSchema.optional(),
  submit: z.boolean().default(false),
});

export const createRequestSchema = requestCreateBaseSchema.superRefine((value, ctx) => {
  if ((value.event === undefined) === (value.eventId === undefined)) {
    ctx.addIssue({
      code: 'custom',
      path: ['event'],
      message: 'Provide either event details or an existing eventId',
    });
  }

  if (
    value.budgetMin !== null &&
    value.budgetMin !== undefined &&
    value.budgetMax !== null &&
    value.budgetMax !== undefined &&
    value.budgetMin > value.budgetMax
  ) {
    ctx.addIssue({
      code: 'custom',
      path: ['budgetMin'],
      message: 'Minimum budget cannot exceed the maximum budget',
    });
  }
});

export const updateRequestSchema = z
  .object({
    event: eventUpdateSchema.optional(),
    eventId: uuidSchema.optional(),
    categoryId: uuidSchema.optional(),
    title: z.string().trim().min(5, 'Title is required').max(180).optional(),
    description: z
      .string()
      .trim()
      .min(20, 'Describe the requirement in at least 20 characters')
      .max(5000)
      .optional(),
    budgetMin: nullableMoneySchema.optional(),
    budgetMax: nullableMoneySchema.optional(),
    quantity: nullableIntegerSchema.optional(),
    responseDeadline: nullableDateTimeSchema.optional(),
  })
  .superRefine((value, ctx) => {
    if (value.event !== undefined && value.eventId !== undefined) {
      ctx.addIssue({
        code: 'custom',
        path: ['eventId'],
        message: 'Provide either event details or an eventId, not both',
      });
    }

    if (Object.values(value).every((field) => field === undefined)) {
      ctx.addIssue({
        code: 'custom',
        path: [],
        message: 'Provide at least one field to update',
      });
    }

    if (
      value.budgetMin !== null &&
      value.budgetMin !== undefined &&
      value.budgetMax !== null &&
      value.budgetMax !== undefined &&
      value.budgetMin > value.budgetMax
    ) {
      ctx.addIssue({
        code: 'custom',
        path: ['budgetMin'],
        message: 'Minimum budget cannot exceed the maximum budget',
      });
    }
  });

export const cancelRequestSchema = z.object({
  reason: z.string().trim().min(5, 'Explain the cancellation in at least 5 characters').max(500),
});

export const closeRequestSchema = z.object({
  reason: z.string().trim().max(500).optional(),
});

export type EventCreateInput = z.infer<typeof eventCreateSchema>;
export type EventUpdateInput = z.infer<typeof eventUpdateSchema>;
export type CreateRequestInput = z.infer<typeof createRequestSchema>;
export type UpdateRequestInput = z.infer<typeof updateRequestSchema>;
export type CancelRequestInput = z.infer<typeof cancelRequestSchema>;
export type CloseRequestInput = z.infer<typeof closeRequestSchema>;
