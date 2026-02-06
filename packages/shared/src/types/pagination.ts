/**
 * Common type definitions for cursor-based pagination
 */

/**
 * Cursor-based query options
 */
export interface CursorPaginationOptions {
  cursor?: string;
  limit?: number;
}

/**
 * Cursor-based query result
 */
export interface CursorPaginationResult<T> {
  items: T[];
  total: number;
  nextCursor?: string;
  hasMore: boolean;
}

/**
 * Internal representation of a cursor
 */
export interface CursorData {
  timestamp: number;
  id: string;
}
