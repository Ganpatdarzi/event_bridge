import { sql } from 'drizzle-orm';
import {
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
import { timestamps } from './_timestamps.js';
import { bookingStatusEnum } from './enums.js';
import { quotations } from './quotations.js';
import { serviceRequests } from './service-requests.js';
import { societies } from './societies.js';
import { vendors } from './vendors.js';

export const bookings = pgTable(
  'bookings',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    requestId: uuid('request_id')
      .notNull()
      .references(() => serviceRequests.id, { onDelete: 'cascade' }),
    quotationId: uuid('quotation_id')
      .notNull()
      .references(() => quotations.id, { onDelete: 'cascade' }),
    societyId: uuid('society_id')
      .notNull()
      .references(() => societies.id, { onDelete: 'cascade' }),
    vendorId: uuid('vendor_id')
      .notNull()
      .references(() => vendors.id, { onDelete: 'cascade' }),
    startsAt: timestamp('starts_at', { withTimezone: true }).notNull(),
    endsAt: timestamp('ends_at', { withTimezone: true }).notNull(),
    amount: numeric('amount', { precision: 12, scale: 2 }).notNull(),
    currency: varchar('currency', { length: 3 }).notNull().default('PKR'),
    notes: text('notes'),
    status: bookingStatusEnum('status').notNull().default('confirmed'),
    ...timestamps,
  },
  (table) => [
    index('idx_bookings_vendor_window').on(
      table.vendorId,
      table.status,
      table.startsAt,
      table.endsAt,
    ),
    index('idx_bookings_society').on(table.societyId, table.createdAt),
    index('idx_bookings_vendor').on(table.vendorId, table.createdAt),
    // One active hire per request, even if a service-layer race slips through.
    uniqueIndex('idx_bookings_one_active_per_request')
      .on(table.requestId)
      .where(sql`${table.status} = 'confirmed'`),
    check('bookings_window_check', sql`${table.endsAt} > ${table.startsAt}`),
    check('bookings_amount_check', sql`${table.amount} >= 0`),
  ],
);

export type Booking = typeof bookings.$inferSelect;
export type NewBooking = typeof bookings.$inferInsert;
