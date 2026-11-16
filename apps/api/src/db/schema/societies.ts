import { pgTable, text, uniqueIndex, uuid, varchar } from 'drizzle-orm/pg-core';
import { timestamps } from './_timestamps.js';
import { users } from './users.js';

export const societies = pgTable(
  'societies',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    name: varchar('name', { length: 160 }).notNull(),
    institution: varchar('institution', { length: 160 }).notNull(),
    contactPerson: varchar('contact_person', { length: 120 }).notNull(),
    contactEmail: varchar('contact_email', { length: 255 }),
    contactPhone: varchar('contact_phone', { length: 40 }),
    description: text('description'),
    ...timestamps,
  },
  (table) => [uniqueIndex('societies_user_id_uq').on(table.userId)],
);

export type Society = typeof societies.$inferSelect;
export type NewSociety = typeof societies.$inferInsert;
