import { and, desc, eq, isNull, sql } from 'drizzle-orm';
import { db } from '../../db/index.js';
import { notifications } from '../../db/schema/index.js';
import { AppError } from '../../lib/errors.js';
import { buildPagination, type PageRequest } from '../../lib/pagination.js';

export interface NotificationView {
  id: string;
  type: string;
  title: string;
  body: string | null;
  link: string | null;
  readAt: Date | null;
  createdAt: Date;
}

const notificationColumns = {
  id: notifications.id,
  type: notifications.type,
  title: notifications.title,
  body: notifications.body,
  link: notifications.link,
  readAt: notifications.readAt,
  createdAt: notifications.createdAt,
} as const;

export async function listNotifications(
  userId: string,
  page: PageRequest,
): Promise<{
  items: NotificationView[];
  unreadCount: number;
  pagination: ReturnType<typeof buildPagination>;
}> {
  const [countRow, unreadRow, rows] = await Promise.all([
    db
      .select({ total: sql<number>`count(*)::int` })
      .from(notifications)
      .where(eq(notifications.userId, userId)),
    db
      .select({ total: sql<number>`count(*)::int` })
      .from(notifications)
      .where(and(eq(notifications.userId, userId), isNull(notifications.readAt))),
    db
      .select(notificationColumns)
      .from(notifications)
      .where(eq(notifications.userId, userId))
      .orderBy(desc(notifications.createdAt))
      .limit(page.limit)
      .offset(page.offset),
  ]);

  return {
    items: rows,
    unreadCount: unreadRow[0]?.total ?? 0,
    pagination: buildPagination(countRow[0]?.total ?? 0, page),
  };
}

export async function markNotificationRead(
  userId: string,
  notificationId: string,
): Promise<NotificationView> {
  const [existing] = await db
    .select(notificationColumns)
    .from(notifications)
    .where(and(eq(notifications.id, notificationId), eq(notifications.userId, userId)))
    .limit(1);

  if (!existing) {
    throw AppError.notFound('Notification not found');
  }

  if (existing.readAt) {
    return existing;
  }

  const readAt = new Date();
  await db
    .update(notifications)
    .set({ readAt })
    .where(and(eq(notifications.id, notificationId), eq(notifications.userId, userId)));

  return { ...existing, readAt };
}

export async function markAllNotificationsRead(userId: string): Promise<{ updated: number }> {
  const rows = await db
    .update(notifications)
    .set({ readAt: new Date() })
    .where(and(eq(notifications.userId, userId), isNull(notifications.readAt)))
    .returning({ id: notifications.id });

  return { updated: rows.length };
}
