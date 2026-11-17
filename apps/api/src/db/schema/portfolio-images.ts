import { pgTable, text, timestamp, uuid, varchar } from 'drizzle-orm/pg-core';
import { vendors } from './vendors.js';

export const portfolioImages = pgTable('portfolio_images', {
  id: uuid('id').primaryKey().defaultRandom(),
  vendorId: uuid('vendor_id')
    .notNull()
    .references(() => vendors.id, { onDelete: 'cascade' }),
  dataUrl: text('data_url').notNull(),
  caption: varchar('caption', { length: 240 }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export type PortfolioImage = typeof portfolioImages.$inferSelect;
export type NewPortfolioImage = typeof portfolioImages.$inferInsert;
