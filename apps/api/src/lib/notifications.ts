import type { NewNotification } from '../db/schema/index.js';
import { db } from '../db/index.js';
import { notifications } from '../db/schema/index.js';
import { logger } from '../config/logger.js';

/**
 * Notifications are useful but must never block a business transition. This is
 * deliberately outside the caller's transaction: a stale notification enum in a
 * deployment that has not run migrations cannot roll back a completed action.
 */
export async function notifyBestEffort(values: NewNotification): Promise<void> {
  try {
    await db.insert(notifications).values(values);
  } catch (error) {
    logger.warn(
      { err: error, userId: values.userId, type: values.type },
      'Notification insert failed; continuing without notification',
    );
  }
}
