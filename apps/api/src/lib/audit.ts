import type { ExtractTablesWithRelations } from 'drizzle-orm';
import type { NodePgQueryResultHKT } from 'drizzle-orm/node-postgres';
import type { PgTransaction } from 'drizzle-orm/pg-core';
import { db } from '../db/index.js';
import type * as schema from '../db/schema/index.js';
import { auditLogs } from '../db/schema/index.js';
import { logger } from '../config/logger.js';

export interface AuditEntry {
  actorId: string | null;
  action: string;
  targetType: string;
  targetId?: string | null;
  metadata?: Record<string, unknown>;
}

/** Drizzle transaction handle for the application schema. */
export type AuditTransaction = PgTransaction<
  NodePgQueryResultHKT,
  typeof schema,
  ExtractTablesWithRelations<typeof schema>
>;

async function insertAudit(
  handle: Pick<AuditTransaction, 'insert'>,
  entry: AuditEntry,
): Promise<void> {
  await handle.insert(auditLogs).values({
    actorId: entry.actorId,
    action: entry.action,
    targetType: entry.targetType,
    targetId: entry.targetId ?? null,
    metadata: entry.metadata ?? null,
  });
}

/**
 * Writes the audit row inside the caller's transaction, so an admin action and
 * its audit trail commit or roll back together.
 */
export async function writeAuditTx(tx: AuditTransaction, entry: AuditEntry): Promise<void> {
  await insertAudit(tx, entry);
}

/**
 * Audit writes are best-effort when used outside a transaction: a failure must
 * not roll back the user-facing action, but it is logged loudly so it can be
 * investigated.
 */
export async function writeAudit(entry: AuditEntry): Promise<void> {
  try {
    await insertAudit(db, entry);
  } catch (error) {
    logger.error({ err: error, entry }, 'Failed to write audit log');
  }
}
