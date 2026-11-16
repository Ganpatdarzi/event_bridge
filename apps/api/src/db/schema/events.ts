import { date, index, integer, pgTable, uuid, varchar } from 'drizzle-orm/pg-core';
import { timestamps } from './_timestamps.js';
import { societies } from './societies.js';

export const events = pgTable(
  'events',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    societyId: uuid('society_id')
      .notNull()
      .references(() => societies.id, { onDelete: 'cascade' }),
    name: varchar('name', { length: 180 }).notNull(),
    eventDate: date('event_date', { mode: 'string' }).notNull(),
    location: varchar('location', { length: 240 }).notNull(),
    expectedAttendance: integer('expected_attendance'),
    ...timestamps,
  },
  (table) => [
    index('events_society_idx').on(table.societyId),
    index('events_date_idx').on(table.eventDate),
  ],
);

export type Event = typeof events.$inferSelect;
export type NewEvent = typeof events.$inferInsert;
