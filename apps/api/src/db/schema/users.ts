import { pgTable, text, uuid, varchar } from 'drizzle-orm/pg-core';
import { accountStatusEnum, userRoleEnum } from './enums.js';
import { timestamps } from './_timestamps.js';

export const users = pgTable('users', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: varchar('name', { length: 120 }).notNull(),
  email: varchar('email', { length: 255 }).notNull().unique(),
  passwordHash: text('password_hash').notNull(),
  role: userRoleEnum('role').notNull(),
  status: accountStatusEnum('status').notNull().default('active'),
  ...timestamps,
});

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
