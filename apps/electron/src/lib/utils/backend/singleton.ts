/**
 * シングルトンパターンを実装するための汎用的な基底クラス
 *
 * このクラスを継承することで、一貫したシングルトンパターンの実装が可能になります。
 * 例: class MyService extends Singleton<MyService> { ... }
 */
export abstract class Singleton {
  /**
   * シングルトンインスタンスを保持するためのマップ
   * キーはクラスのコンストラクタ関数、値はそのクラスのインスタンス
   */
  private static instances: Map<
    new (...args: unknown[]) => unknown,
    unknown
  > = new Map();

  /**
   * 直接インスタンス化を防ぐためのprotectedコンストラクタ
   */
  protected constructor() {}

  /**
   * シングルトンインスタンスを取得する静的メソッド
   * 継承先のクラスでこのメソッドを使用することで、シングルトンインスタンスを取得できる
   */
  protected static getInstanceBase<
    C extends new (...args: unknown[]) => InstanceType<C>,
  >(this: C): InstanceType<C> {
    // クラス名の代わりにコンストラクタ関数自体をキーとして使用
    if (!Singleton.instances.has(this)) {
      Singleton.instances.set(this, new this());
    }

    return Singleton.instances.get(this) as InstanceType<C>;
  }

  /**
   * すべてのシングルトンインスタンスをクリアする
   * 主にテストの際やアプリケーション終了時のクリーンアップに使用
   */
  public static clearAllInstances(): void {
    Singleton.instances.clear();
  }
}
