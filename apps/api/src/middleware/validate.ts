import type { Request, Response, NextFunction } from 'express';
import { ZodError, type ZodType } from 'zod';
import { AppError } from '../lib/errors.js';

function toValidationError(error: ZodError): AppError {
  return AppError.validation(
    error.issues.map((issue) => ({
      path: issue.path.join('.'),
      message: issue.message,
      code: issue.code,
    })),
  );
}

export function validateBody<T extends ZodType>(schema: T) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      next(toValidationError(result.error));
      return;
    }
    req.body = result.data;
    next();
  };
}

export function validateParams<T extends ZodType>(schema: T) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    const result = schema.safeParse(req.params);
    if (!result.success) {
      next(toValidationError(result.error));
      return;
    }
    req.params = result.data as Request['params'];
    next();
  };
}
