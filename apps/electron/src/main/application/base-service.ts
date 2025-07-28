import { logError } from "../../lib/utils/backend/error-handler";

/**
 * 基本サービスクラス
 * CRUD操作と共通エラーハンドリングを提供する
 *
 * @template T - 操作対象となるデータ型
 * @template K - IDの型（通常はstring）
 */
export abstract class BaseService<T, K = string> {
  /**
   * エンティティ名を取得する抽象メソッド（エラーメッセージなどに使用）
   * 各サブクラスで実装が必要
   */
  protected abstract getEntityName(): string;

  /**
   * エラーハンドリング共通処理
   * @param operation - 処理名
   * @param error - エラーオブジェクト
   * @param defaultValue - エラー時に返す値（指定なしの場合は例外が投げられる）
   * @returns デフォルト値または例外をスロー
   */
  protected handleError(
    operation: string,
    error: unknown,
    defaultValue?: any,
  ): any {
    const entityName = this.getEntityName();
    const message = `${entityName}の${operation}中にエラーが発生しました`;
    logError(message, error);

    if (arguments.length > 2) {
      return defaultValue;
    }

    throw error;
  }
}
