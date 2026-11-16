import { pgTable, text, timestamp, uuid, varchar } from 'drizzle-orm/pg-core';
import { serviceRequests } from './service-requests.js';
import { users } from './users.js';

export const approvalRecords = pgTable('approval_records', {
  id: uuid('id').primaryKey().defaultRandom(),
  requestId: uuid('request_id')
    .notNull()
    .references(() => serviceRequests.id, { onDelete: 'cascade' }),
  institution: varchar('institution', { length: 160 }).notNull(),
  status: varchar('status', { length: 40 }).notNull(),
  reference: varchar('reference', { length: 120 }),
  recordedBy: uuid('recorded_by').references(() => users.id, { onDelete: 'set null' }),
  recordedAt: timestamp('recorded_at', { withTimezone: true }).notNull().defaultNow(),
  notes: text('notes'),
});

export type ApprovalRecord = typeof approvalRecords.$inferSelect;
export type NewApprovalRecord = typeof approvalRecords.$inferInsert;
