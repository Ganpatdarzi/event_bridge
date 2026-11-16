import { timestamp } from 'drizzle-orm/pg-core';

/** Shared created/updated timestamp columns. */
export const timestamps = {
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
};
