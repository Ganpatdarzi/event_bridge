export class AppError extends Error {
  readonly statusCode: number;
  readonly code: string;
  readonly details?: unknown;

  constructor(statusCode: number, code: string, message: string, details?: unknown) {
    super(message);
    this.name = 'AppError';
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
  }

  static badRequest(message: string, details?: unknown): AppError {
    return new AppError(400, 'BAD_REQUEST', message, details);
  }

  static validation(details: unknown, message = 'Validation failed'): AppError {
    return new AppError(400, 'VALIDATION_ERROR', message, details);
  }

  static unauthenticated(message = 'Authentication required'): AppError {
    return new AppError(401, 'UNAUTHENTICATED', message);
  }

  static forbidden(message = 'You do not have permission to perform this action'): AppError {
    return new AppError(403, 'FORBIDDEN', message);
  }

  static notEligible(message = 'You are not eligible for this action'): AppError {
    return new AppError(403, 'NOT_ELIGIBLE', message);
  }

  static notFound(message = 'Resource not found'): AppError {
    return new AppError(404, 'NOT_FOUND', message);
  }

  static conflict(
    code = 'CONFLICT',
    message = 'The request conflicts with the current state',
  ): AppError {
    return new AppError(409, code, message);
  }

  static ruleViolation(message: string, details?: unknown): AppError {
    return new AppError(422, 'RULE_VIOLATION', message, details);
  }
}

/**
 * Drizzle wraps driver errors in `DrizzleQueryError`, and `pg` may wrap pooled
 * failures in an `AggregateError`, so the PostgreSQL SQLSTATE can live a few
 * levels down the `cause` chain.
 */
function hasPostgresCode(error: unknown, code: string, depth = 0): boolean {
  if (!error || typeof error !== 'object' || depth > 6) {
    return false;
  }

  const candidate = error as { code?: unknown; cause?: unknown; errors?: unknown };

  if (candidate.code === code) {
    return true;
  }

  if (hasPostgresCode(candidate.cause, code, depth + 1)) {
    return true;
  }

  return (
    Array.isArray(candidate.errors) &&
    candidate.errors.some((nested) => hasPostgresCode(nested, code, depth + 1))
  );
}

export function isUniqueViolation(error: unknown): boolean {
  return hasPostgresCode(error, '23505');
}

export function isForeignKeyViolation(error: unknown): boolean {
  return hasPostgresCode(error, '23503');
}

/** An enum value in the code is newer than the deployed database enum. */
export function isInvalidEnumValue(error: unknown): boolean {
  return hasPostgresCode(error, '22P02');
}
