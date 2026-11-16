import { paginationSchema } from '@event-bridge/shared';

export interface PageRequest {
  page: number;
  pageSize: number;
  limit: number;
  offset: number;
}

export interface PaginationMeta {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

/**
 * Reads `page` and `pageSize` from an Express query object. Unknown keys are
 * ignored, so callers can pass the whole query string after validating filters.
 * Throws a ZodError, which the global error handler turns into a 400 response.
 */
export function parsePagination(query: unknown): PageRequest {
  const { page, pageSize } = paginationSchema.parse(query);
  return {
    page,
    pageSize,
    limit: pageSize,
    offset: (page - 1) * pageSize,
  };
}

export function buildPagination(total: number, request: PageRequest): PaginationMeta {
  return {
    page: request.page,
    pageSize: request.pageSize,
    total,
    totalPages: Math.ceil(total / request.pageSize),
  };
}

/** Escapes user input for use inside a LIKE/ILIKE pattern (PostgreSQL default escape). */
export function likePattern(value: string): string {
  return `%${value.replace(/[\\%_]/g, '\\$&')}%`;
}
