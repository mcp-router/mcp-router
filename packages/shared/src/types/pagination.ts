/**
 * カーソルベースページネーションの共通型定義
 */

/**
 * カーソルベースのクエリオプション
 */
export interface CursorPaginationOptions {
  cursor?: string;
  limit?: number;
}

/**
 * カーソルベースのクエリ結果
 */
export interface CursorPaginationResult<T> {
  items: T[];
  total: number;
  nextCursor?: string;
  hasMore: boolean;
}

/**
 * カーソルの内部表現
 */
export interface CursorData {
  timestamp: number;
  id: string;
}
