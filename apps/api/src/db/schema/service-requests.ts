import {
  index,
  integer,
  numeric,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';
import { timestamps } from './_timestamps.js';
import { categories } from './categories.js';
import { requestStatusEnum } from './enums.js';
import { events } from './events.js';
import { societies } from './societies.js';
import { users } from './users.js';

export const serviceRequests = pgTable(
  'service_requests',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    reference: varchar('reference', { length: 24 }).notNull(),
    societyId: uuid('society_id')
      .notNull()
      .references(() => societies.id, { onDelete: 'cascade' }),
    eventId: uuid('event_id').references(() => events.id, { onDelete: 'set null' }),
    categoryId: uuid('category_id')
      .notNull()
      .references(() => categories.id, { onDelete: 'restrict' }),
    title: varchar('title', { length: 180 }).notNull(),
    budgetMin: numeric('budget_min', { precision: 12, scale: 2 }),
    budgetMax: numeric('budget_max', { precision: 12, scale: 2 }),
    quantity: integer('quantity'),
    description: text('description').notNull(),
    status: requestStatusEnum('status').notNull().default('draft'),
    responseDeadline: timestamp('response_deadline', { withTimezone: true }),
    // Deliberately not a FK: quotations reference requests, so a direct FK would be circular.
    // The service layer verifies the quotation belongs to this request before writing.
    selectedQuotationId: uuid('selected_quotation_id'),
    cancelledBy: uuid('cancelled_by').references(() => users.id, { onDelete: 'set null' }),
    cancelledAt: timestamp('cancelled_at', { withTimezone: true }),
    cancellationReason: text('cancellation_reason'),
    ...timestamps,
  },
  (table) => [
    uniqueIndex('service_requests_reference_uq').on(table.reference),
    index('idx_requests_society_status').on(table.societyId, table.status),
    index('idx_requests_category_status').on(table.categoryId, table.status),
  ],
);

export type ServiceRequest = typeof serviceRequests.$inferSelect;
export type NewServiceRequest = typeof serviceRequests.$inferInsert;
