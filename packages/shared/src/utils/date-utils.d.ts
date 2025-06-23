import dayjs from "dayjs";
/**
 * 一貫したタイムゾーン設定のdayjsインスタンスを返す
 */
export declare function getDateInstance(date?: string | number | Date | dayjs.Dayjs): dayjs.Dayjs;
/**
 * 日付をYYYY-MM-DD形式に変換
 */
export declare function formatDateBucket(date?: string | number | Date | dayjs.Dayjs): string;
/**
 * 現在の日付バケットを取得
 */
export declare function getCurrentBucket(): string;
/**
 * タイムスタンプ（ミリ秒）を取得
 */
export declare function getTimestamp(date?: string | number | Date | dayjs.Dayjs): number;
/**
 * 時間フォーマットを指定して文字列に変換
 */
export declare function formatDate(date: string | number | Date | dayjs.Dayjs, format?: string): string;
/**
 * i18nを使用して時間をフォーマット
 */
export declare function formatDateI18n(date: string | number | Date | dayjs.Dayjs, t: any, formatKey?: "shortDate" | "shortDateTime" | "shortDateTimeWithSeconds"): string;
/**
 * 指定された日の開始時刻を取得
 */
export declare function getStartOfDay(date?: string | number | Date | dayjs.Dayjs): dayjs.Dayjs;
/**
 * 指定された日の終了時刻を取得
 */
export declare function getEndOfDay(date?: string | number | Date | dayjs.Dayjs): dayjs.Dayjs;
/**
 * 指定された日付範囲に基づいてバケットを生成
 */
export declare function generateBuckets(startDate?: Date | string | number, endDate?: Date | string | number): string[];
/**
 * 日付の範囲が重なるかチェック
 */
export declare function dateRangesOverlap(start1: string | number | Date | dayjs.Dayjs, end1: string | number | Date | dayjs.Dayjs, start2: string | number | Date | dayjs.Dayjs, end2: string | number | Date | dayjs.Dayjs): boolean;
/**
 * 指定された時間バケット文字列を解析して日付オブジェクトを返す
 * 例: "2025-03-29 08" -> 2025年3月29日8時のdayjsオブジェクト
 */
export declare function parseHourBucket(hourBucket: string): dayjs.Dayjs;
/**
 * 指定された日付が範囲内かどうかを確認
 */
export declare function isDateInRange(date: string | number | Date | dayjs.Dayjs, startDate: string | number | Date | dayjs.Dayjs, endDate: string | number | Date | dayjs.Dayjs): boolean;
//# sourceMappingURL=date-utils.d.ts.map