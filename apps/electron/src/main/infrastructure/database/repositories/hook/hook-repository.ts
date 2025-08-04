import { BaseRepository } from "../../core/base-repository";
import { SqliteManager } from "../../core/sqlite-manager";
import { MCPHook } from "@mcp_router/shared";
import { v4 as uuidv4 } from "uuid";

/**
 * Hook情報用リポジトリクラス
 * MCP Hooksを管理
 */
export class HookRepository extends BaseRepository<MCPHook> {
  /**
   * コンストラクタ
   * @param db SqliteManagerインスタンス
   */
  constructor(db: SqliteManager) {
    super(db, "hooks");
    console.log(
      "[HookRepository] Initialized with database:",
      db ? "Present" : "Missing",
    );
  }

  /**
   * テーブルを初期化（BaseRepositoryの抽象メソッドを実装）
   */
  protected initializeTable(): void {
    try {
      // hooksテーブルを作成（存在しない場合）
      this.db.execute(`
        CREATE TABLE IF NOT EXISTS hooks (
          id TEXT PRIMARY KEY,
          name TEXT NOT NULL,
          description TEXT,
          enabled INTEGER NOT NULL DEFAULT 1,
          execution_order INTEGER NOT NULL DEFAULT 0,
          hook_type TEXT NOT NULL CHECK(hook_type IN ('pre', 'post', 'both')),
          script TEXT NOT NULL,
          created_at INTEGER NOT NULL,
          updated_at INTEGER NOT NULL
        )
      `);

      // インデックスを作成
      this.db.execute(`
        CREATE INDEX IF NOT EXISTS idx_hooks_enabled ON hooks(enabled)
      `);
      this.db.execute(`
        CREATE INDEX IF NOT EXISTS idx_hooks_execution_order ON hooks(execution_order)
      `);
      this.db.execute(`
        CREATE INDEX IF NOT EXISTS idx_hooks_hook_type ON hooks(hook_type)
      `);

      console.log("[HookRepository] Table and indexes initialized");
    } catch (error) {
      console.error("[HookRepository] Failed to initialize table:", error);
      throw error;
    }
  }

  /**
   * Get all hooks
   */
  public listHooks(): MCPHook[] {
    return this.getAll({
      orderBy: 'execution_order ASC, created_at ASC',
    });
  }

  /**
   * Get a specific hook by ID
   */
  public getHook(id: string): MCPHook | null {
    return this.findById(id);
  }

  /**
   * Create or update a hook
   */
  public upsertHook(hook: MCPHook): void {
    const existing = this.findById(hook.id);
    if (existing) {
      this.update(hook.id, hook);
    } else {
      this.add(hook);
    }
  }

  /**
   * Update specific fields of a hook
   */
  public updateHook(
    id: string,
    updates: Partial<Omit<MCPHook, "id" | "createdAt" | "updatedAt">>,
  ): void {
    const existing = this.findById(id);
    if (!existing) {
      throw new Error(`Hook not found: ${id}`);
    }

    const updated = {
      ...existing,
      ...updates,
      updatedAt: Date.now(),
    };

    this.update(id, updated);
  }

  /**
   * Delete a hook
   */
  public deleteHook(id: string): void {
    this.delete(id);
  }

  /**
   * Get hooks by type
   */
  public getHooksByType(hookType: "pre" | "post" | "both"): MCPHook[] {
    const sql = `
      SELECT * FROM hooks 
      WHERE hook_type = ? OR hook_type = 'both'
      ORDER BY execution_order ASC, created_at ASC
    `;
    
    const rows = this.db.all<any>(sql, [hookType]);
    return rows.map(row => this.mapRowToEntity(row));
  }

  /**
   * Get enabled hooks
   */
  public getEnabledHooks(): MCPHook[] {
    return this.getAll({
      where: { enabled: 1 },
      orderBy: 'execution_order ASC, created_at ASC',
    });
  }

  /**
   * Reorder hooks
   */
  public reorderHooks(hookIds: string[]): void {
    const stmt = this.db.prepare(`
      UPDATE hooks SET execution_order = ? WHERE id = ?
    `);

    hookIds.forEach((id, index) => {
      stmt.run(index, id);
    });
  }

  /**
   * Create a new hook
   */
  public createHook(hookData: Omit<MCPHook, 'id' | 'createdAt' | 'updatedAt'>): MCPHook {
    const now = Date.now();
    const hook: MCPHook = {
      id: uuidv4(),
      ...hookData,
      createdAt: now,
      updatedAt: now,
    };
    
    return this.add(hook);
  }

  /**
   * データベース行をエンティティに変換
   * @param row データベース行
   */
  protected mapRowToEntity(row: any): MCPHook {
    return {
      id: row.id,
      name: row.name,
      description: row.description || undefined,
      enabled: row.enabled === 1,
      executionOrder: row.execution_order,
      hookType: row.hook_type as "pre" | "post" | "both",
      script: row.script,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  /**
   * エンティティをデータベース行に変換
   * @param entity エンティティ
   */
  protected mapEntityToRow(entity: MCPHook): Record<string, any> {
    return {
      id: entity.id,
      name: entity.name,
      description: entity.description || null,
      enabled: entity.enabled ? 1 : 0,
      execution_order: entity.executionOrder,
      hook_type: entity.hookType,
      script: entity.script,
      created_at: entity.createdAt,
      updated_at: entity.updatedAt,
    };
  }
}