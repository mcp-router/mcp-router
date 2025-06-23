import { useState, useEffect, useCallback } from "react";
import { RequestLogEntry, TimeSeriesDataPoint } from "@mcp-router/shared";
import { usePlatformAPI } from "@mcp-router/platform-api";
import dayjs from "dayjs";
import utc from "dayjs/plugin/utc";
import timezone from "dayjs/plugin/timezone";

// タイムゾーン処理のためのプラグインを追加
dayjs.extend(utc);
dayjs.extend(timezone);

interface TimeSeriesParams {
  clientId?: string;
  serverId?: string;
  startDate?: Date;
  endDate?: Date;
  requestType?: string;
  refreshTrigger?: number;
}

interface TimeSeriesResult {
  data: TimeSeriesDataPoint[];
  loading: boolean;
  error: string | null;
  fetchData: () => Promise<void>;
}

/**
 * Custom hook for fetching log and converting them to time series data format
 */
export const useTimeSeriesData = (
  params: TimeSeriesParams,
): TimeSeriesResult => {
  const platformAPI = usePlatformAPI();
  const [data, setData] = useState<TimeSeriesDataPoint[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // フェッチするログの最大数（大量のログを全て取得することを避ける）
  const MAX_LOGS = 1000;

  // Function to fetch log and convert to time series data
  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      // 開発環境でのみ詳細なログを出力
      // console.log('[useTimeSeriesData] Fetching log with params:', {
      //   startDate: params.startDate,
      //   endDate: params.endDate,
      //   clientId: params.clientId,
      //   serverId: params.serverId,
      //   requestType: params.requestType,
      //   refreshTrigger: params.refreshTrigger
      // });

      // getRequestLogsを使ってログデータを取得
      const result = await (platformAPI as any).getRequestLogs({
        startDate: params.startDate,
        endDate: params.endDate,
        clientId: params.clientId,
        serverId: params.serverId,
        requestType: params.requestType,
        limit: MAX_LOGS,
        offset: 0,
        // キャッシュを避けるためのパラメータ
        _cacheBuster: Date.now(),
      });

      if (result && Array.isArray(result.logs)) {
        // 時系列データに変換
        const timeSeriesData = convertLogsToTimeSeries(result.logs);

        // 開発環境でのみサンプルデータを表示
        // console.log('[useTimeSeriesData] First few items sample:',
        //     timeSeriesData.slice(0, 3).map(item => JSON.stringify(item)));
        // console.log(`[useTimeSeriesData] Generated ${timeSeriesData.length} time series data points`);

        setData(timeSeriesData);
      } else {
        console.warn("[useTimeSeriesData] Invalid result:", result);
        setData([]);
      }
    } catch (error) {
      console.error("Failed to fetch and process time series data:", error);
      setError("データの取得中にエラーが発生しました");
    } finally {
      setLoading(false);
    }
  }, [
    params.startDate,
    params.endDate,
    params.clientId,
    params.serverId,
    params.requestType,
    params.refreshTrigger,
  ]);

  /**
   * ログデータを時系列データに変換する関数
   */
  function convertLogsToTimeSeries(
    logs: RequestLogEntry[],
  ): TimeSeriesDataPoint[] {
    if (!logs || logs.length === 0) {
      return [];
    }

    // ログの型チェック
    if (
      !logs.every(
        (log) =>
          log &&
          typeof log === "object" &&
          "timestamp" in log &&
          "clientId" in log &&
          "requestType" in log,
      )
    ) {
      console.error("[useTimeSeriesData] Invalid log format in some entries");
      return [];
    }

    // ログを1時間単位のタイムバケットでグループ化
    const timeMap = new Map<string, Map<string, Map<string, number>>>();

    // すべてのログを処理
    logs.forEach((log) => {
      // 時間単位のタイムバケットを作成（YYYY-MM-DD HH） - dayjsを使って日本時間で処理
      const date = dayjs(log.timestamp).tz("Asia/Tokyo");
      const timeBucket = `${date.format("YYYY-MM-DD")} ${date.format("HH")}`;

      // クライアントIDの処理
      const clientId = log.clientId || "unknown";

      // 時間バケット用のエントリを作成（存在しない場合）
      if (!timeMap.has(timeBucket)) {
        timeMap.set(timeBucket, new Map<string, Map<string, number>>());
      }

      // クライアント用のエントリを作成
      const timeMapEntry = timeMap.get(timeBucket)!;
      if (!timeMapEntry.has(clientId)) {
        timeMapEntry.set(clientId, new Map<string, number>());
      }

      // リクエストタイプ用のエントリを作成
      const clientMapEntry = timeMapEntry.get(clientId)!;
      if (!clientMapEntry.has(log.requestType)) {
        clientMapEntry.set(log.requestType, 0);
      }

      // カウントを増やす
      clientMapEntry.set(
        log.requestType,
        clientMapEntry.get(log.requestType)! + 1,
      );
    });

    // 時系列データポイントに変換
    const timeSeriesData: TimeSeriesDataPoint[] = [];

    // タイムバケットをソート
    const sortedTimeBuckets = Array.from(timeMap.keys()).sort();

    // 各タイムバケットを処理
    sortedTimeBuckets.forEach((timeBucket) => {
      const clientMap = timeMap.get(timeBucket)!;

      // タイムスタンプを生成 (dayjsを使用して日本時間のタイムスタンプを生成)
      const [datePart, hourPart] = timeBucket.split(" ");
      const timestamp = dayjs
        .tz(`${datePart} ${hourPart}:00:00`, "Asia/Tokyo")
        .valueOf();

      // 各クライアントを処理
      clientMap.forEach((requestTypeMap, clientId) => {
        // 各リクエストタイプを処理
        requestTypeMap.forEach((count, requestType) => {
          // TimeSeriesDataPointを作成
          timeSeriesData.push({
            timestamp,
            timeBucket,
            requestType,
            count,
            clientId,
            serverId: params.serverId, // パラメータからサーバIDを取得
          });
        });
      });
    });

    // タイムスタンプでソート
    return timeSeriesData.sort((a, b) => a.timestamp - b.timestamp);
  }

  // パラメータ変更または更新トリガー時にデータをフェッチ
  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return {
    data,
    loading,
    error,
    fetchData,
  };
};
