import { randomUUID } from 'node:crypto';
import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import { pinoHttp } from 'pino-http';
import { API_PREFIX } from '@event-bridge/shared';
import { env } from './config/env.js';
import { logger } from './config/logger.js';
import { pool } from './db/pool.js';
import { errorHandler, notFound } from './middleware/error.js';
import { globalLimiter } from './middleware/rate-limit.js';
import { apiRouter } from './modules/index.js';

export function createApp(): express.Express {
  const app = express();

  app.set('trust proxy', 1);
  app.disable('x-powered-by');

  app.use(helmet());
  app.use(
    cors({
      origin: env.APP_ORIGIN,
      credentials: true,
      methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE', 'OPTIONS'],
    }),
  );
  app.use(express.json({ limit: '1mb' }));
  app.use(cookieParser());
  app.use(
    pinoHttp({
      logger,
      genReqId: (req, res) => {
        const header = req.headers['x-request-id'];
        const id = Array.isArray(header) ? header[0] : header;
        const requestId = id ?? randomUUID();
        res.setHeader('x-request-id', requestId);
        return requestId;
      },
    }),
  );
  app.use(globalLimiter);

  app.get('/health', (_req, res) => {
    res.json({
      data: {
        status: 'ok',
        uptimeSeconds: Math.round(process.uptime()),
        timestamp: new Date().toISOString(),
      },
    });
  });

  app.get('/health/db', async (_req, res, next) => {
    try {
      await pool.query('SELECT 1');
      res.json({ data: { status: 'ok', database: 'reachable' } });
    } catch (error) {
      next(error);
    }
  });

  app.use(API_PREFIX, apiRouter);

  app.use(notFound);
  app.use(errorHandler);

  return app;
}
