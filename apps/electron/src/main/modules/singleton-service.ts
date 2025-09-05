import { logError } from "@/main/utils/logger";

/**
 * シングルトンサービスの基底クラス
 *
 * このクラスを継承することで、以下の機能を提供します：
 * 1. シングルトンパターンの実装
 * 2. ワークスペース切り替え時のインスタンスリセット
 * 3. 動的なリポジトリ取得（ワークスペース切り替えに対応）
 * 4. エラーハンドリング共通処理
 *
 * @template T - サービスが扱うエンティティの型
 * @template K - エンティティのIDの型（デフォルトはstring）
 * @template S - サービスクラス自身の型
 */
export abstract class SingletonService<T, K = string, S = any> {
  /**
   * シングルトンインスタンスを格納するMapオブジェクト
   * キー: サービスクラスのコンストラクタ
   * 値: サービスのインスタンス
   */
  private static instances: Map<Function, any> = new Map();

  /**
   * コンストラクタ
   * 注意: シングルトンパターンを維持するため、直接インスタンス化せず、
   * getInstance()メソッドを使用してください
   */
  public constructor() {}

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

  /**
   * シングルトンインスタンスを取得する
   * @param ServiceClass - サービスクラスのコンストラクタ
   * @returns サービスのインスタンス
   */
  protected static getInstanceBase<T extends SingletonService<any, any, any>>(
    this: new () => T,
  ): T {
    if (!SingletonService.instances.has(this)) {
      SingletonService.instances.set(this, new this());
    }
    return SingletonService.instances.get(this) as T;
  }

  /**
   * 特定のサービスのインスタンスをリセットする
   * ワークスペース切り替え時に使用される
   * @param ServiceClass - リセットするサービスクラスのコンストラクタ
   */
  protected static resetInstanceBase<T extends Function>(
    ServiceClass: T,
  ): void {
    SingletonService.instances.delete(ServiceClass);
  }

  /**
   * すべてのサービスインスタンスをリセットする
   * アプリケーション終了時やテスト時に使用
   */
  public static resetAllInstances(): void {
    SingletonService.instances.clear();
  }
}
