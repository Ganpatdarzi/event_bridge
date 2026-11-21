import { Router } from 'express';
import { API_PREFIX } from '@event-bridge/shared';
import { adminRouter } from './admin/admin.routes.js';
import { authRouter } from './auth/auth.routes.js';
import { bookingsRouter } from './bookings/bookings.routes.js';
import { categoriesRouter } from './categories/categories.routes.js';
import { notificationsRouter } from './notifications/notifications.routes.js';
import { quotationsRouter } from './quotations/quotations.routes.js';
import { requestsRouter, vendorRequestsRouter } from './requests/requests.routes.js';
import { societiesRouter } from './societies/societies.routes.js';
import { vendorsRouter } from './vendors/vendors.routes.js';

export const apiRouter = Router();

apiRouter.get('/', (_req, res) => {
  res.json({
    data: {
      name: 'Event Bridge API',
      version: '0.1.0',
      prefix: API_PREFIX,
      docs: 'See README.md §8 for the endpoint reference',
    },
  });
});

apiRouter.use('/auth', authRouter);
apiRouter.use('/categories', categoriesRouter);
apiRouter.use('/societies', societiesRouter);
apiRouter.use('/vendors', vendorsRouter);
apiRouter.use('/requests', requestsRouter);
apiRouter.use('/vendor', vendorRequestsRouter);
apiRouter.use('/bookings', bookingsRouter);
apiRouter.use('/quotations', quotationsRouter);
apiRouter.use('/notifications', notificationsRouter);
apiRouter.use('/admin', adminRouter);
