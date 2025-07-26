import { CursorData } from "@mcp_router/shared";

/**
 * カーソルのエンコード・デコードユーティリティ
 */

/**
 * カーソルデータをBase64エンコード
 */
export function encodeCursor(data: CursorData): string {
  const cursorString = `${data.timestamp}:${data.id}`;
  return Buffer.from(cursorString).toString("base64");
}

/**
 * Base64エンコードされたカーソルをデコード
 */
export function decodeCursor(cursor: string): CursorData | null {
  try {
    const decoded = Buffer.from(cursor, "base64").toString("utf-8");
    const [timestampStr, id] = decoded.split(":");

    if (!timestampStr || !id) {
      return null;
    }

    const timestamp = parseInt(timestampStr, 10);
    if (isNaN(timestamp)) {
      return null;
    }

    return { timestamp, id };
  } catch (error) {
    console.warn("Failed to decode cursor:", cursor, error);
    return null;
  }
}

/**
 * 空のカーソルを表す定数
 */
export const EMPTY_CURSOR = "";

/**
 * カーソルが空かどうかを判定
 */
export function isEmptyCursor(cursor?: string): boolean {
  return !cursor || cursor === EMPTY_CURSOR;
}
