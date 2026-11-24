import { and, eq, sql } from 'drizzle-orm';
import { users, vendorCategories, vendors } from '../../db/schema/index.js';
import type { Transaction } from '../../lib/transaction.js';

export interface MatchedVendor {
  id: string;
  userId: string;
}

/**
 * Published requests are distributed to every active, verified vendor in the
 * selected category. Service areas stay on the vendor profile for display, but
 * free-text venue names were too inconsistent to use as a hidden delivery rule.
 */
export async function findEligibleVendors(
  tx: Transaction,
  categoryId: string,
): Promise<MatchedVendor[]> {
  return tx
    .select({
      id: vendors.id,
      userId: vendors.userId,
    })
    .from(vendors)
    .innerJoin(users, eq(users.id, vendors.userId))
    .where(
      and(
        eq(users.status, 'active'),
        eq(vendors.verificationStatus, 'verified'),
        sql`exists (
          select 1 from ${vendorCategories}
          where ${vendorCategories.vendorId} = ${vendors.id}
            and ${vendorCategories.categoryId} = ${categoryId}
        )`,
      ),
    );
}
