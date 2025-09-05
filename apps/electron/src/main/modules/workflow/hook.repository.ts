import { getSqliteManager } from "../../infrastructure/database/sqlite-manager";
import { HookModule } from "@mcp_router/shared";
import { v4 as uuidv4 } from "uuid";

/**
 * Hook Moduleリポジトリクラス
 * HookModuleの永続化を管理
 */
export class HookRepository {
  private static instance: HookRepository | null = null;

  /**
   * コンストラクタ
   */
  private constructor() {
    this.initializeTable();
  }

  /**
   * テーブルを初期化
   */
  private initializeTable(): void {
    const db = getSqliteManager();
    try {
      // hook_modulesテーブルを作成
      db.execute(`
        CREATE TABLE IF NOT EXISTS hook_modules (
          id TEXT PRIMARY KEY,
          name TEXT NOT NULL UNIQUE,
          script TEXT NOT NULL,
          created_at INTEGER NOT NULL,
          updated_at INTEGER NOT NULL
        )
      `);

      // インデックスを作成
      db.execute(
        "CREATE INDEX IF NOT EXISTS idx_hook_modules_name ON hook_modules(name)",
      );

      console.log("[HookRepository] テーブルの初期化が完了しました");
    } catch (error) {
      console.error("[HookRepository] テーブルの初期化中にエラー:", error);
      throw error;
    }
  }

  /**
   * シングルトンインスタンスの取得
   */
  public static getInstance(): HookRepository {
    if (!HookRepository.instance) {
      HookRepository.instance = new HookRepository();
    }
    return HookRepository.instance;
  }

  /**
   * テスト用にインスタンスをリセット
   */
  public static resetInstance(): void {
    HookRepository.instance = null;
  }

  /**
   * 全てのHook Moduleを取得
   */
  public getAllHookModules(): HookModule[] {
    const db = getSqliteManager();
    const rows = db.all(`
      SELECT id, name, script, created_at, updated_at
      FROM hook_modules
      ORDER BY name ASC
    `);

    return rows.map((row: any) => ({
      id: row.id,
      name: row.name,
      script: row.script,
    }));
  }

  /**
   * IDでHook Moduleを取得
   */
  public getHookModuleById(id: string): HookModule | null {
    const db = getSqliteManager();
    const row = db.get(
      `
      SELECT id, name, script, created_at, updated_at
      FROM hook_modules
      WHERE id = :id
    `,
      { id },
    ) as any;

    if (!row) {
      return null;
    }

    return {
      id: row.id,
      name: row.name,
      script: row.script,
    };
  }

  /**
   * 名前でHook Moduleを取得
   */
  public getHookModuleByName(name: string): HookModule | null {
    const db = getSqliteManager();
    const row = db.get(
      `
      SELECT id, name, script, created_at, updated_at
      FROM hook_modules
      WHERE name = :name
    `,
      { name },
    ) as any;

    if (!row) {
      return null;
    }

    return {
      id: row.id,
      name: row.name,
      script: row.script,
    };
  }

  /**
   * Hook Moduleを作成
   */
  public createHookModule(module: Omit<HookModule, "id">): HookModule {
    const db = getSqliteManager();
    const now = Date.now();
    const id = uuidv4();

    const newModule: HookModule = {
      ...module,
      id,
    };

    db.execute(
      `
      INSERT INTO hook_modules (
        id, name, script, created_at, updated_at
      ) VALUES (
        :id, :name, :script, :createdAt, :updatedAt
      )
    `,
      {
        id: newModule.id,
        name: newModule.name,
        script: newModule.script,
        createdAt: now,
        updatedAt: now,
      },
    );

    return newModule;
  }

  /**
   * Hook Moduleを更新
   */
  public updateHookModule(
    id: string,
    updates: Partial<Omit<HookModule, "id">>,
  ): HookModule | null {
    const existing = this.getHookModuleById(id);
    if (!existing) {
      return null;
    }

    const db = getSqliteManager();
    const updatedModule: HookModule = {
      ...existing,
      ...updates,
      id,
    };

    db.execute(
      `
      UPDATE hook_modules
      SET name = :name,
          script = :script,
          updated_at = :updatedAt
      WHERE id = :id
    `,
      {
        id,
        name: updatedModule.name,
        script: updatedModule.script,
        updatedAt: Date.now(),
      },
    );

    return updatedModule;
  }

  /**
   * Hook Moduleを削除
   */
  public deleteHookModule(id: string): boolean {
    const db = getSqliteManager();
    const result = db.execute(
      `
      DELETE FROM hook_modules
      WHERE id = :id
    `,
      { id },
    );

    return result.changes > 0;
  }

  /**
   * Hook Moduleの存在確認（名前）
   */
  public existsByName(name: string): boolean {
    const db = getSqliteManager();
    const row = db.get(
      `
      SELECT COUNT(*) as count
      FROM hook_modules
      WHERE name = :name
    `,
      { name },
    ) as any;

    return row?.count > 0;
  }

  /**
   * Hook Moduleをインポート（名前の重複を回避）
   */
  public importHookModule(module: Omit<HookModule, "id">): HookModule {
    let name = module.name;
    let counter = 1;

    // 名前が重複する場合は番号を付与
    while (this.existsByName(name)) {
      name = `${module.name}_${counter}`;
      counter++;
    }

    return this.createHookModule({
      ...module,
      name,
    });
  }

  /**
   * 複数のHook Moduleを一括作成
   */
  public createHookModules(modules: Omit<HookModule, "id">[]): HookModule[] {
    return modules.map((module) => this.createHookModule(module));
  }

  /**
   * 全てのHook Moduleを削除（テスト用）
   */
  public deleteAllHookModules(): void {
    const db = getSqliteManager();
    db.execute("DELETE FROM hook_modules");
  }
}

/**
 * HookRepositoryのシングルトンインスタンスを取得
 */
export function getHookRepository(): HookRepository {
  return HookRepository.getInstance();
}
