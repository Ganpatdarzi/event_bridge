import {
  boolean,
  check,
  index,
  numeric,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { timestamps } from './_timestamps.js';
import { quotationStatusEnum } from './enums.js';
import { serviceRequests } from './service-requests.js';
import { vendors } from './vendors.js';

export const quotations = pgTable(
  'quotations',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    reference: varchar('reference', { length: 24 }).notNull(),
    requestId: uuid('request_id')
      .notNull()
      .references(() => serviceRequests.id, { onDelete: 'cascade' }),
    vendorId: uuid('vendor_id')
      .notNull()
      .references(() => vendors.id, { onDelete: 'cascade' }),
    totalPrice: numeric('total_price', { precision: 12, scale: 2 }).notNull(),
    currency: varchar('currency', { length: 3 }).notNull().default('PKR'),
    description: text('description').notNull(),
    inclusions: text('inclusions'),
    exclusions: text('exclusions'),
    additionalCharges: numeric('additional_charges', { precision: 12, scale: 2 }),
    availableOnDate: boolean('available_on_date'),
    validUntil: timestamp('valid_until', { withTimezone: true }),
    notes: text('notes'),
    status: quotationStatusEnum('status').notNull().default('submitted'),
    submittedAt: timestamp('submitted_at', { withTimezone: true }).notNull().defaultNow(),
    ...timestamps,
  },
  (table) => [
    uniqueIndex('quotations_reference_uq').on(table.reference),
    uniqueIndex('quotations_request_vendor_uq').on(table.requestId, table.vendorId),
    index('idx_quotations_request').on(table.requestId, table.status),
    index('idx_quotations_vendor').on(table.vendorId, table.submittedAt),
    // A request has at most one selected and one preferred offer, even if a
    // service-layer race slips through.
    uniqueIndex('idx_quotations_one_selected_per_request')
      .on(table.requestId)
      .where(sql`${table.status} = 'selected'`),
    uniqueIndex('idx_quotations_one_preferred_per_request')
      .on(table.requestId)
      .where(sql`${table.status} = 'preferred'`),
    check('quotations_total_price_check', sql`${table.totalPrice} >= 0`),
    check(
      'quotations_additional_charges_check',
      sql`${table.additionalCharges} IS NULL OR ${table.additionalCharges} >= 0`,
    ),
  ],
);

export type Quotation = typeof quotations.$inferSelect;
export type NewQuotation = typeof quotations.$inferInsert;
