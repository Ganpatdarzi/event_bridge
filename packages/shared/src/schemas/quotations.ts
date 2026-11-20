import { z } from 'zod';
import { numericInput } from './common.js';

const MAX_MONEY = 9_999_999_999.99;

/** Treat an empty form field as "not set" instead of coercing it to zero. */
function emptyToNull(value: unknown): unknown {
  return value === '' || value === null ? null : value;
}

function optionalText(max: number) {
  return z.preprocess(
    (value) => (value === '' || value === null ? undefined : value),
    z.string().trim().max(max).optional(),
  );
}

const moneySchema = numericInput.pipe(
  z
    .number({ message: 'Enter a valid amount' })
    .finite()
    .min(0, 'Amount cannot be negative')
    .max(MAX_MONEY),
);

const nullableMoneySchema = z.preprocess(emptyToNull, moneySchema.nullable());

const nullableDateTimeSchema = z.preprocess(
  emptyToNull,
  z.iso.datetime({ offset: true, message: 'Enter a valid date and time' }).nullable(),
);

export const upsertQuotationSchema = z.object({
  totalPrice: moneySchema,
  description: z.string().trim().min(10, 'Describe the offer in at least 10 characters').max(5000),
  inclusions: optionalText(2000),
  exclusions: optionalText(2000),
  additionalCharges: nullableMoneySchema.optional(),
  availableOnDate: z.boolean().optional(),
  validUntil: nullableDateTimeSchema.optional(),
  notes: optionalText(1000),
});

export type UpsertQuotationInput = z.infer<typeof upsertQuotationSchema>;
