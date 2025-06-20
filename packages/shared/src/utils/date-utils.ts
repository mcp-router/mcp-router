import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';
import timezone from 'dayjs/plugin/timezone';
import localizedFormat from 'dayjs/plugin/localizedFormat';
import customParseFormat from 'dayjs/plugin/customParseFormat';

// プラグインを登録
dayjs.extend(utc);
dayjs.extend(timezone);
dayjs.extend(localizedFormat);
dayjs.extend(customParseFormat);

// アプリケーションのデフォルトタイムゾーン
const DEFAULT_TIMEZONE = dayjs.tz.guess();

/**
 * 一貫したタイムゾーン設定のdayjsインスタンスを返す
 */
export function getDateInstance(date?: string | number | Date | dayjs.Dayjs) {
  return date ? dayjs(date).tz(DEFAULT_TIMEZONE) : dayjs().tz(DEFAULT_TIMEZONE);
}

/**
 * 日付をYYYY-MM-DD形式に変換
 */
export function formatDateBucket(date?: string | number | Date | dayjs.Dayjs) {
  return getDateInstance(date).format('YYYY-MM-DD');
}

/**
 * 現在の日付バケットを取得
 */
export function getCurrentBucket() {
  return formatDateBucket(getDateInstance());
}

/**
 * タイムスタンプ（ミリ秒）を取得
 */
export function getTimestamp(date?: string | number | Date | dayjs.Dayjs) {
  return getDateInstance(date).valueOf();
}

/**
 * 時間フォーマットを指定して文字列に変換
 */
export function formatDate(date: string | number | Date | dayjs.Dayjs, format?: string) {
  const instance = getDateInstance(date);
  if (format) {
    return instance.format(format);
  }
  return instance.format('YYYY-MM-DD HH:mm:ss');
}

/**
 * i18nを使用して時間をフォーマット
 */
export function formatDateI18n(date: string | number | Date | dayjs.Dayjs, t: any, formatKey: 'shortDate' | 'shortDateTime' | 'shortDateTimeWithSeconds' = 'shortDateTime') {
  const instance = getDateInstance(date);
  const format = t(`logs.viewer.dateFormat.${formatKey}`);
  return instance.format(format);
}

/**
 * 指定された日の開始時刻を取得
 */
export function getStartOfDay(date?: string | number | Date | dayjs.Dayjs) {
  return getDateInstance(date).startOf('day');
}

/**
 * 指定された日の終了時刻を取得
 */
export function getEndOfDay(date?: string | number | Date | dayjs.Dayjs) {
  return getDateInstance(date).endOf('day');
}

/**
 * 指定された日付範囲に基づいてバケットを生成
 */
export function generateBuckets(startDate?: Date | string | number, endDate?: Date | string | number) {
  const start = getDateInstance(startDate || 0);
  const end = getDateInstance(endDate || undefined);
  
  const buckets: string[] = [];
  let current = start.startOf('day');
  
  while (current.isBefore(end) || current.isSame(end, 'day')) {
    buckets.push(formatDateBucket(current));
    current = current.add(1, 'day');
  }
  
  return buckets;
}

/**
 * 日付の範囲が重なるかチェック
 */
export function dateRangesOverlap(
  start1: string | number | Date | dayjs.Dayjs, 
  end1: string | number | Date | dayjs.Dayjs,
  start2: string | number | Date | dayjs.Dayjs, 
  end2: string | number | Date | dayjs.Dayjs
) {
  const s1 = getDateInstance(start1);
  const e1 = getDateInstance(end1);
  const s2 = getDateInstance(start2);
  const e2 = getDateInstance(end2);
  
  return (e1.isAfter(s2) || e1.isSame(s2)) && (s1.isBefore(e2) || s1.isSame(e2));
}

/**
 * 指定された時間バケット文字列を解析して日付オブジェクトを返す
 * 例: "2025-03-29 08" -> 2025年3月29日8時のdayjsオブジェクト
 */
export function parseHourBucket(hourBucket: string) {
  return dayjs.tz(`${hourBucket}:00:00`, 'YYYY-MM-DD HH:mm:ss', DEFAULT_TIMEZONE);
}

/**
 * 指定された日付が範囲内かどうかを確認
 */
export function isDateInRange(
  date: string | number | Date | dayjs.Dayjs,
  startDate: string | number | Date | dayjs.Dayjs,
  endDate: string | number | Date | dayjs.Dayjs
) {
  const target = getDateInstance(date);
  const start = getDateInstance(startDate);
  const end = getDateInstance(endDate);
  
  return (target.isAfter(start) || target.isSame(start)) && (target.isBefore(end) || target.isSame(end));
}
