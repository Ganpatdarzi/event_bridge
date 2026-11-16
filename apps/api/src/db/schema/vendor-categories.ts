import { index, pgTable, primaryKey, uuid } from 'drizzle-orm/pg-core';
import { categories } from './categories.js';
import { vendors } from './vendors.js';

export const vendorCategories = pgTable(
  'vendor_categories',
  {
    vendorId: uuid('vendor_id')
      .notNull()
      .references(() => vendors.id, { onDelete: 'cascade' }),
    categoryId: uuid('category_id')
      .notNull()
      .references(() => categories.id, { onDelete: 'restrict' }),
  },
  (table) => [
    primaryKey({ columns: [table.vendorId, table.categoryId] }),
    index('vendor_categories_category_idx').on(table.categoryId),
  ],
);

export type VendorCategory = typeof vendorCategories.$inferSelect;
export type NewVendorCategory = typeof vendorCategories.$inferInsert;
