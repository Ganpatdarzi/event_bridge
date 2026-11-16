import { randomUUID } from 'node:crypto';

/** Human-readable reference, e.g. EB-R-9F3A12CD. */
export function makeReference(prefix: 'R' | 'Q'): string {
  return `EB-${prefix}-${randomUUID().replace(/-/g, '').slice(0, 8).toUpperCase()}`;
}
