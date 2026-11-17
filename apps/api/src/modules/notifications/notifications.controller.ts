import type { RequestHandler } from 'express';
import { AppError } from '../../lib/errors.js';
import { parsePagination } from '../../lib/pagination.js';
import {
  listNotifications,
  markAllNotificationsRead,
  markNotificationRead,
} from './notifications.service.js';

export const list: RequestHandler = async (req, res) => {
  if (!req.user) throw AppError.unauthenticated();

  const page = parsePagination(req.query);
  const result = await listNotifications(req.user.id, page);
  res.json({ data: result });
};

export const markAllRead: RequestHandler = async (req, res) => {
  if (!req.user) throw AppError.unauthenticated();

  const result = await markAllNotificationsRead(req.user.id);
  res.json({ data: result });
};

export const markRead: RequestHandler = async (req, res) => {
  if (!req.user) throw AppError.unauthenticated();

  const notification = await markNotificationRead(req.user.id, req.params.id as string);
  res.json({ data: notification });
};
