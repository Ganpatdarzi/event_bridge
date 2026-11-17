import { pgTable, text, timestamp, uuid, varchar } from 'drizzle-orm/pg-core';
import { users } from './users.js';

export const systemSettings = pgTable('system_settings', {
  key: varchar('key', { length: 120 }).primaryKey(),
  value: text('value').notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  updatedBy: uuid('updated_by').references(() => users.id, { onDelete: 'set null' }),
});

export type SystemSetting = typeof systemSettings.$inferSelect;
export type NewSystemSetting = typeof systemSettings.$inferInsert;
