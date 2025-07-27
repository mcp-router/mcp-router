import dayjs from "dayjs";
import utc from "dayjs/plugin/utc";
import timezone from "dayjs/plugin/timezone";
import localizedFormat from "dayjs/plugin/localizedFormat";
import customParseFormat from "dayjs/plugin/customParseFormat";

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
function formatDateBucket(date?: string | number | Date | dayjs.Dayjs) {
  return getDateInstance(date).format("YYYY-MM-DD");
}



/**
 * i18nを使用して時間をフォーマット
 */
export function formatDateI18n(
  date: string | number | Date | dayjs.Dayjs,
  t: any,
  formatKey:
    | "shortDate"
    | "shortDateTime"
    | "shortDateTimeWithSeconds" = "shortDateTime",
) {
  const instance = getDateInstance(date);
  const format = t(`logs.viewer.dateFormat.${formatKey}`);
  return instance.format(format);
}

