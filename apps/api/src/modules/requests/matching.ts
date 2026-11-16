import { and, eq, sql } from 'drizzle-orm';
import { users, vendorCategories, vendors } from '../../db/schema/index.js';
import type { Transaction } from '../../lib/transaction.js';

export interface MatchedVendor {
  id: string;
  userId: string;
  city: string;
  serviceArea: string | null;
}

const WILDCARD_AREAS = new Set([
  'nationwide',
  'national',
  'pakistan',
  'all pakistan',
  'remote',
  'anywhere',
  'all cities',
]);

/**
 * Vendor service areas are free text ("Karachi", "Karachi (all campuses)",
 * "Karachi, Lahore"). A blank area means the vendor serves everywhere. A
 * location matches when it names the vendor's city or any area token.
 */
export function vendorServesLocation(
  city: string,
  serviceArea: string | null,
  eventLocation: string,
): boolean {
  const location = eventLocation.trim().toLowerCase();
  if (!location) return false;

  const normalizedCity = city.trim().toLowerCase();
  if (normalizedCity && location.includes(normalizedCity)) {
    return true;
  }

  const area = serviceArea?.trim().toLowerCase();
  if (!area) return true;

  const cleaned = area.replace(/\([^)]*\)/g, ' ');
  const tokens = cleaned
    .split(/[,;/|]|\band\b|&/g)
    .map((token) => token.trim().replace(/^[-–—]+|[-–—]+$/g, ''))
    .filter((token) => token.length >= 2);

  return tokens.some(
    (token) => WILDCARD_AREAS.has(token) || location.includes(token) || token.includes(location),
  );
}

/**
 * Step 30 matching: active account + verified vendor + category match, then the
 * service area rule. The category and account checks run in SQL; service areas
 * are compared in memory because they are human-entered free text.
 */
export async function findEligibleVendors(
  tx: Transaction,
  categoryId: string,
  eventLocation: string,
): Promise<MatchedVendor[]> {
  const rows = await tx
    .select({
      id: vendors.id,
      userId: vendors.userId,
      city: vendors.city,
      serviceArea: vendors.serviceArea,
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

  return rows.filter((row) => vendorServesLocation(row.city, row.serviceArea, eventLocation));
}
