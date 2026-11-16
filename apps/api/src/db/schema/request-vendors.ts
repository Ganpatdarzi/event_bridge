import { index, pgTable, timestamp, uniqueIndex, uuid } from 'drizzle-orm/pg-core';
import { distributionStatusEnum } from './enums.js';
import { serviceRequests } from './service-requests.js';
import { vendors } from './vendors.js';

export const requestVendors = pgTable(
  'request_vendors',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    requestId: uuid('request_id')
      .notNull()
      .references(() => serviceRequests.id, { onDelete: 'cascade' }),
    vendorId: uuid('vendor_id')
      .notNull()
      .references(() => vendors.id, { onDelete: 'cascade' }),
    distributionStatus: distributionStatusEnum('distribution_status').notNull().default('invited'),
    viewedAt: timestamp('viewed_at', { withTimezone: true }),
    notifiedAt: timestamp('notified_at', { withTimezone: true }),
  },
  (table) => [
    uniqueIndex('request_vendors_request_vendor_uq').on(table.requestId, table.vendorId),
    index('request_vendors_vendor_idx').on(table.vendorId),
  ],
);

export type RequestVendor = typeof requestVendors.$inferSelect;
export type NewRequestVendor = typeof requestVendors.$inferInsert;
