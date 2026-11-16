import { pgTable, text, timestamp, uniqueIndex, uuid, varchar } from 'drizzle-orm/pg-core';
import { timestamps } from './_timestamps.js';
import { vendorStatusEnum } from './enums.js';
import { users } from './users.js';

export const vendors = pgTable(
  'vendors',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    businessName: varchar('business_name', { length: 160 }).notNull(),
    description: text('description').notNull(),
    city: varchar('city', { length: 80 }).notNull(),
    serviceArea: varchar('service_area', { length: 300 }),
    contactPerson: varchar('contact_person', { length: 120 }),
    contactPhone: varchar('contact_phone', { length: 40 }),
    verificationStatus: vendorStatusEnum('verification_status').notNull().default('pending_review'),
    rejectionReason: text('rejection_reason'),
    verifiedBy: uuid('verified_by').references(() => users.id, { onDelete: 'set null' }),
    verifiedAt: timestamp('verified_at', { withTimezone: true }),
    ...timestamps,
  },
  (table) => [uniqueIndex('vendors_user_id_uq').on(table.userId)],
);

export type Vendor = typeof vendors.$inferSelect;
export type NewVendor = typeof vendors.$inferInsert;
