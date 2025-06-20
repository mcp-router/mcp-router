/**
 * シングルトンパターンを実装するための汎用的な基底クラス
 *
 * このクラスを継承することで、一貫したシングルトンパターンの実装が可能になります。
 * 例: class MyService extends Singleton<MyService> { ... }
 *
 * @template T - シングルトンとして実装するクラスの型
 */
export abstract class Singleton<T> {
  /**
   * シングルトンインスタンスを保持するためのマップ
   * キーはクラスのコンストラクタ関数、値はそのクラスのインスタンス
   */
  private static instances: Map<Function, any> = new Map<Function, any>();

  /**
   * 直接インスタンス化を防ぐためのprotectedコンストラクタ
   */
  protected constructor() {}

  /**
   * シングルトンインスタンスを取得する静的メソッド
   * 継承先のクラスでこのメソッドを使用することで、シングルトンインスタンスを取得できる
   */
  protected static getInstanceBase<
    C extends new (...args: any[]) => InstanceType<C>,
  >(this: C): InstanceType<C> {
    // クラス名の代わりにコンストラクタ関数自体をキーとして使用
    const key = this;

    if (!Singleton.instances.has(key)) {
      Singleton.instances.set(key, new this());
    }

    return Singleton.instances.get(key) as InstanceType<C>;
  }

  /**
   * すべてのシングルトンインスタンスをクリアする
   * 主にテストの際やアプリケーション終了時のクリーンアップに使用
   */
  public static clearAllInstances(): void {
    Singleton.instances.clear();
  }
}
