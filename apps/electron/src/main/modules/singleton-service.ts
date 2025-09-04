import { BaseService } from "./base-service";

/**
 * シングルトンサービスの基底クラス
 *
 * このクラスを継承することで、以下の機能を提供します：
 * 1. シングルトンパターンの実装
 * 2. ワークスペース切り替え時のインスタンスリセット
 * 3. 動的なリポジトリ取得（ワークスペース切り替えに対応）
 *
 * @template T - サービスが扱うエンティティの型
 * @template K - エンティティのIDの型（デフォルトはstring）
 * @template S - サービスクラス自身の型
 */
export abstract class SingletonService<
  T,
  K = string,
  S = any,
> extends BaseService<T, K> {
  /**
   * シングルトンインスタンスを格納するMapオブジェクト
   * キー: サービスクラスのコンストラクタ
   * 値: サービスのインスタンス
   */
  private static instances: Map<Function, any> = new Map();

  /**
   * コンストラクタはprotectedにして直接インスタンス化を防ぐ
   */
  protected constructor() {
    super();
  }

  /**
   * シングルトンインスタンスを取得する
   * @param ServiceClass - サービスクラスのコンストラクタ
   * @returns サービスのインスタンス
   */
  protected static getInstanceBase<
    T extends new (...args: any[]) => InstanceType<T>,
  >(this: T): InstanceType<T> {
    if (!SingletonService.instances.has(this)) {
      SingletonService.instances.set(this, new this());
    }
    return SingletonService.instances.get(this) as InstanceType<T>;
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
