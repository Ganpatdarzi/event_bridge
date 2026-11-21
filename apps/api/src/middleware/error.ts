import type { ErrorRequestHandler, RequestHandler } from 'express';
import { ZodError } from 'zod';
import { logger } from '../config/logger.js';
import {
  AppError,
  isForeignKeyViolation,
  isInvalidEnumValue,
  isUniqueViolation,
} from '../lib/errors.js';

export const notFound: RequestHandler = (_req, res) => {
  res.status(404).json({
    error: { code: 'NOT_FOUND', message: 'The requested endpoint does not exist' },
  });
};

export const errorHandler: ErrorRequestHandler = (error, req, res, next) => {
  if (res.headersSent) {
    next(error);
    return;
  }

  if (error instanceof ZodError) {
    res.status(400).json({
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Validation failed',
        details: error.issues.map((issue) => ({
          path: issue.path.join('.'),
          message: issue.message,
        })),
      },
    });
    return;
  }

  if (error instanceof AppError) {
    res.status(error.statusCode).json({
      error: {
        code: error.code,
        message: error.message,
        ...(error.details ? { details: error.details } : {}),
      },
    });
    return;
  }

  if (isUniqueViolation(error)) {
    res.status(409).json({
      error: { code: 'DUPLICATE', message: 'A record with these details already exists' },
    });
    return;
  }

  if (isForeignKeyViolation(error)) {
    res.status(400).json({
      error: { code: 'INVALID_REFERENCE', message: 'A referenced record does not exist' },
    });
    return;
  }

  if (isInvalidEnumValue(error)) {
    res.status(409).json({
      error: {
        code: 'SCHEMA_OUT_OF_DATE',
        message: 'The database schema is out of date. Apply the latest migrations and retry.',
      },
    });
    return;
  }

  // body-parser reports oversized JSON as 413; do not turn it into a 500.
  if (
    (error as { status?: number }).status === 413 ||
    (error as { type?: string }).type === 'entity.too.large'
  ) {
    res.status(413).json({
      error: { code: 'PAYLOAD_TOO_LARGE', message: 'The request body is too large' },
    });
    return;
  }

  // Malformed JSON bodies surface as SyntaxError with a status property.
  if (
    error instanceof SyntaxError &&
    'status' in error &&
    (error as { status?: number }).status === 400
  ) {
    res.status(400).json({ error: { code: 'BAD_REQUEST', message: 'Malformed JSON body' } });
    return;
  }

  logger.error({ err: error, requestId: (req as { id?: string }).id }, 'Unhandled error');

  res.status(500).json({
    error: {
      code: 'INTERNAL_ERROR',
      message: 'Something went wrong. Please retry, and contact support if it continues.',
    },
  });
};
