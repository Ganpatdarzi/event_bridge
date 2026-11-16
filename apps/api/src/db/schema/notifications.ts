import { index, pgTable, text, timestamp, uuid, varchar } from 'drizzle-orm/pg-core';
import { notificationTypeEnum } from './enums.js';
import { users } from './users.js';

export const notifications = pgTable(
  'notifications',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    type: notificationTypeEnum('type').notNull(),
    title: varchar('title', { length: 180 }).notNull(),
    body: text('body'),
    link: varchar('link', { length: 300 }),
    readAt: timestamp('read_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index('idx_notifications_user_unread').on(table.userId, table.readAt)],
);

export type Notification = typeof notifications.$inferSelect;
export type NewNotification = typeof notifications.$inferInsert;
