import { Router } from 'express';
import { uuidSchema } from '@event-bridge/shared';
import { z } from 'zod';
import { authenticate } from '../../middleware/auth.js';
import { validateParams } from '../../middleware/validate.js';
import { list, markAllRead, markRead } from './notifications.controller.js';

const idParams = z.object({ id: uuidSchema });

export const notificationsRouter = Router();

notificationsRouter.use(authenticate);

notificationsRouter.get('/', list);
notificationsRouter.post('/read-all', markAllRead);
notificationsRouter.post('/:id/read', validateParams(idParams), markRead);
