# MCP Hook System Design

## 実装詳細

このドキュメントは、MCP Routerのフックシステムの完全な実装詳細を記述します。

### 実装手順と依存関係

実装は以下の順序で行う必要があります：

1. 型定義の追加
2. データベーススキーマとリポジトリの実装
3. ビジネスロジック（HookManager）の実装
4. IPCハンドラーの実装
5. UIコンポーネントの実装
6. 既存コンポーネントへの統合

### 1. 型定義の実装

#### packages/shared/src/types/mcp-hook-types.ts (新規作成)

```typescript
/**
 * MCP Hook System Type Definitions
 */

/**
 * Hook configuration
 */
export interface MCPHook {
  id: string;
  name: string;
  description?: string;
  enabled: boolean;
  executionOrder: number; // 実行順序（小さい値から実行）
  hookType: 'pre' | 'post' | 'both';
  
  // JavaScriptスクリプト
  script: string;
  
  // メタデータ
  createdAt: number;
  updatedAt: number;
}

/**
 * Hook execution context
 */
export interface HookContext {
  // リクエスト情報
  requestType: 'CallTool' | 'ListTools' | 'ReadResource' | 'ListResources' | 'GetPrompt' | 'ListPrompts';
  serverName: string;
  serverId: string;
  clientId: string;
  token?: string;
  toolName?: string; // CallToolリクエストの場合のツール名
  
  // リクエスト本体
  request: {
    method: string;
    params: any;
  };
  
  // レスポンス情報（Post-hookでのみ利用可能）
  response?: any;
  error?: Error;
  
  // Hook間でデータを共有するためのメタデータ
  metadata: Record<string, any>;
  
  // 実行時間計測
  startTime: number;
  duration?: number; // Post-hookでのみ利用可能
}

/**
 * Hook execution result
 */
export interface HookResult {
  // 処理を続行するかどうか
  continue: boolean;
  
  // 変更されたコンテキスト（省略可能）
  context?: HookContext;
  
  // エラー発生時のエラー情報
  error?: {
    code: string;
    message: string;
  };
}

/**
 * Hook execution error
 */
export interface HookExecutionError {
  hookId: string;
  hookName: string;
  error: Error;
  timestamp: number;
}

/**
 * Hook script execution environment
 */
export interface HookScriptEnvironment {
  // Available global variables
  context: HookContext;
  console: Console;
  
  // Utility functions
  sleep: (ms: number) => Promise<void>;
  validateToken: (token: string) => boolean;
  getServerInfo: (serverId: string) => any;
}

/**
 * Hook management operations
 */
export interface HookOperations {
  // CRUD operations
  createHook: (hook: Omit<MCPHook, 'id' | 'createdAt' | 'updatedAt'>) => Promise<MCPHook>;
  updateHook: (id: string, updates: Partial<Omit<MCPHook, 'id' | 'createdAt' | 'updatedAt'>>) => Promise<MCPHook>;
  deleteHook: (id: string) => Promise<void>;
  getHook: (id: string) => Promise<MCPHook | null>;
  listHooks: () => Promise<MCPHook[]>;
  
  // Execution operations
  executePreHooks: (context: HookContext) => Promise<HookResult>;
  executePostHooks: (context: HookContext) => Promise<HookResult>;
  
  // Management operations
  enableHook: (id: string) => Promise<void>;
  disableHook: (id: string) => Promise<void>;
  reorderHooks: (hookIds: string[]) => Promise<void>;
  testHook: (id: string, context: HookContext) => Promise<HookResult>;
}

/**
 * Hook execution log entry
 */
export interface HookExecutionLog {
  id: string;
  hookId: string;
  hookName: string;
  executionTime: number;
  duration: number;
  success: boolean;
  error?: string;
  context: {
    requestType: string;
    serverName: string;
    clientId: string;
  };
}
```

#### packages/shared/src/types/index.ts (更新)

```typescript
// 既存のエクスポートに追加
export * from "./mcp-hook-types";
```

#### packages/shared/src/types/platform-api.ts (更新)

```typescript
// 既存のインポートに追加
import { MCPHook, HookContext, HookResult } from "./mcp-hook-types";

// PlatformAPI interfaceに追加
export interface PlatformAPI {
  // ... 既存のプロパティ ...
  
  hooks: HookAPI;
}

// 新規インターフェース追加
export interface HookAPI {
  listHooks: () => Promise<MCPHook[]>;
  getHook: (id: string) => Promise<MCPHook | null>;
  createHook: (hookData: Omit<MCPHook, 'id' | 'createdAt' | 'updatedAt'>) => Promise<MCPHook>;
  updateHook: (id: string, updates: Partial<Omit<MCPHook, 'id' | 'createdAt' | 'updatedAt'>>) => Promise<MCPHook | null>;
  deleteHook: (id: string) => Promise<boolean>;
  setHookEnabled: (id: string, enabled: boolean) => Promise<MCPHook | null>;
  reorderHooks: (hookIds: string[]) => Promise<MCPHook[]>;
  testHook: (id: string, context: HookContext) => Promise<HookResult>;
}
```

### 2. データベース実装

#### apps/electron/src/main/infrastructure/database/schema/tables/hooks.ts (新規作成)

```typescript
import { DatabaseTableSchema } from "@mcp_router/shared";

export const HOOKS_SCHEMA: DatabaseTableSchema = {
  createSQL: `
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
  `,
  indexes: [
    `CREATE INDEX IF NOT EXISTS idx_hooks_enabled ON hooks(enabled)`,
    `CREATE INDEX IF NOT EXISTS idx_hooks_execution_order ON hooks(execution_order)`,
    `CREATE INDEX IF NOT EXISTS idx_hooks_hook_type ON hooks(hook_type)`,
    `CREATE INDEX IF NOT EXISTS idx_hooks_created_at ON hooks(created_at)`,
  ],
};

export const HOOKS_REQUIRED_COLUMNS = [
  "id",
  "name",
  "description",
  "enabled",
  "execution_order",
  "hook_type",
  "script",
  "created_at",
  "updated_at",
];
```

#### apps/electron/src/main/infrastructure/database/repositories/hook/hook-repository.ts (新規作成)

```typescript
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
```

#### apps/electron/src/main/infrastructure/database/factories/repository-factory.ts (更新)

```typescript
// インポートに追加
import { HookRepository } from "../repositories/hook/hook-repository";

// RepositoryInstances型に追加
type RepositoryInstances = {
  // ... 既存のプロパティ ...
  hook: HookRepository | null;
};

// private static instancesに追加
private static instances: RepositoryInstances = {
  // ... 既存のプロパティ ...
  hook: null,
};

// resetAllInstancesメソッドに追加
private static resetAllInstances(): void {
  console.log("[RepositoryFactory] Resetting all repository instances");
  this.instances = {
    // ... 既存のプロパティ ...
    hook: null,
  };
}

// 新規メソッド追加
/**
 * フックリポジトリを取得
 */
public static getHookRepository(db: SqliteManager): HookRepository {
  if (this.isDatabaseChanged(db)) {
    this.resetAllInstances();
    this.currentDb = db;
  }

  if (!this.instances.hook) {
    console.log("[RepositoryFactory] Creating new HookRepository instance");
    this.instances.hook = new HookRepository(db);
  }

  return this.instances.hook;
}
```

#### apps/electron/src/main/infrastructure/database/index.ts (更新)

```typescript
// 最後に追加
export function getHookRepository() {
  const db = getSqliteManager("mcprouter");
  return RepositoryFactory.getHookRepository(db);
}

export function resetHookRepository() {
  // No-op: Reset is handled by RepositoryFactory
}
```

#### apps/electron/src/main/infrastructure/database/migrations/database-migration.ts (更新)

```typescript
// registerMigrationsメソッドに追加
// Hooksテーブルを追加
this.migrations.push({
  id: "20250805_add_hooks_table",
  description: "Add hooks table for MCP request/response hooks",
  execute: (db) => this.migrateAddHooksTable(db),
});

// 新規メソッド追加（クラスの最後に）
/**
 * hooksテーブルを追加するマイグレーション
 */
private migrateAddHooksTable(db: SqliteManager): void {
  try {

    // hooksテーブルを作成
    db.execute(`
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
    db.execute(
        `CREATE INDEX IF NOT EXISTS idx_hooks_enabled ON hooks(enabled)`,
    );
    db.execute(
        `CREATE INDEX IF NOT EXISTS idx_hooks_execution_order ON hooks(execution_order)`,
    );
    db.execute(
        `CREATE INDEX IF NOT EXISTS idx_hooks_hook_type ON hooks(hook_type)`,
    );
    db.execute(
        `CREATE INDEX IF NOT EXISTS idx_hooks_created_at ON hooks(created_at)`,
    );
  } catch (error) {
    console.error("hooksテーブルの作成中にエラーが発生しました:", error);
    throw error;
  }
}
```

### 3. ビジネスロジックの実装

#### apps/electron/src/main/application/mcp-core/mcp-manager/hook-manager.ts (新規作成)

```typescript
import {
  MCPHook,
  HookContext,
  HookResult,
  HookExecutionError,
} from "@mcp_router/shared";
import { DatabaseService } from "@/main/infrastructure/database";
import { HookRepository } from "@/main/infrastructure/database/repositories/hook/hook-repository";
import { RepositoryFactory } from "@/main/infrastructure/database/factories/repository-factory";
import { McpLogger } from "./logging";
import vm from "vm";

/**
 * Hook Manager for MCP Router
 * Manages pre/post hooks for MCP requests
 */
export class HookManager {
  private hooks: Map<string, MCPHook> = new Map();
  private hookRepository: HookRepository;
  private logger: McpLogger;

  constructor(
    private databaseService: DatabaseService,
    logger: McpLogger,
  ) {
    this.logger = logger;
    this.hookRepository = RepositoryFactory.getHookRepository(databaseService);
    this.loadHooks();
  }

  /**
   * Load all hooks from database
   */
  private async loadHooks(): Promise<void> {
    try {
      const hooks = await this.hookRepository.listHooks();
      this.hooks.clear();

      for (const hook of hooks) {
        this.hooks.set(hook.id, hook);
      }

      this.logger.info(`Loaded ${hooks.length} hooks`);
    } catch (error) {
      this.logger.error("Failed to load hooks", error);
    }
  }

  /**
   * Execute pre-hooks for a request
   */
  async executePreHooks(context: HookContext): Promise<HookResult> {
    const hooks = this.getApplicableHooks("pre", context);
    return this.executeHooks(hooks, context);
  }

  /**
   * Execute post-hooks for a response
   */
  async executePostHooks(context: HookContext): Promise<HookResult> {
    const hooks = this.getApplicableHooks("post", context);
    return this.executeHooks(hooks, context);
  }

  /**
   * Get applicable hooks based on type and context
   */
  private getApplicableHooks(
    type: "pre" | "post",
    context: HookContext,
  ): MCPHook[] {
    const applicableHooks: MCPHook[] = [];

    for (const hook of this.hooks.values()) {
      // Skip disabled hooks
      if (!hook.enabled) continue;

      // Check hook type
      if (hook.hookType !== type && hook.hookType !== "both") continue;

      // All filtering is now done in the hook script itself
      applicableHooks.push(hook);
    }

    // Sort by executionOrder (ascending)
    return applicableHooks.sort((a, b) => a.executionOrder - b.executionOrder);
  }

  /**
   * Execute a series of hooks
   */
  private async executeHooks(
    hooks: MCPHook[],
    context: HookContext,
  ): Promise<HookResult> {
    let currentContext = { ...context };

    for (const hook of hooks) {
      try {
        this.logger.debug(`Executing hook: ${hook.name}`);

        const result = await this.executeScript(hook.script, currentContext);

        if (!result.continue) {
          this.logger.info(`Hook ${hook.name} halted execution`, {
            error: result.error,
          });
          return result;
        }

        // Update context if provided
        if (result.context) {
          currentContext = result.context;
        }
      } catch (error) {
        const executionError: HookExecutionError = {
          hookId: hook.id,
          hookName: hook.name,
          error: error as Error,
          timestamp: Date.now(),
        };

        this.logger.error(
          `Hook execution failed: ${hook.name}`,
          executionError,
        );

        // Continue execution even if a hook fails
        // TODO: Make this configurable
      }
    }

    return {
      continue: true,
      context: currentContext,
    };
  }

  /**
   * Execute a hook script in a sandboxed environment
   */
  private async executeScript(
    script: string,
    context: HookContext,
  ): Promise<HookResult> {
    // Create a safe console that logs to our logger
    const safeConsole = {
      log: (...args: any[]) => this.logger.info("Hook script log:", ...args),
      error: (...args: any[]) => this.logger.error("Hook script error:", ...args),
      warn: (...args: any[]) => this.logger.warn("Hook script warn:", ...args),
      info: (...args: any[]) => this.logger.info("Hook script info:", ...args),
      debug: (...args: any[]) => this.logger.debug("Hook script debug:", ...args),
    };

    // Create sandbox environment
    const sandbox = {
      context: structuredClone(context),
      console: safeConsole,
      sleep: (ms: number) => new Promise(resolve => setTimeout(resolve, ms)),
      validateToken: this.validateToken.bind(this),
      getServerInfo: this.getServerInfo.bind(this),
    };

    // Create VM context
    const vmContext = vm.createContext(sandbox);

    // Wrap script in an async function
    const wrappedScript = `
      (async () => {
        ${script}
      })()
    `;

    try {
      // Execute script with timeout
      const scriptObj = new vm.Script(wrappedScript);
      const result = await scriptObj.runInContext(vmContext, {
        timeout: 5000, // 5 second timeout
        displayErrors: true,
      });

      // Validate result
      if (typeof result !== 'object' || result === null) {
        throw new Error('Hook script must return an object');
      }

      if (typeof result.continue !== 'boolean') {
        throw new Error('Hook script must return an object with a "continue" property');
      }

      return result as HookResult;
    } catch (error) {
      this.logger.error("Script execution error:", error);
      throw error;
    }
  }

  /**
   * Validate a token (helper for hook scripts)
   */
  private validateToken(token: string): boolean {
    // TODO: Implement actual token validation
    return token && token.length > 0;
  }

  /**
   * Get server info (helper for hook scripts)
   */
  private getServerInfo(serverId: string): any {
    // TODO: Implement actual server info retrieval
    return { id: serverId, name: "Unknown Server" };
  }

  /**
   * Reload hooks from database
   */
  public async reloadHooks(): Promise<void> {
    await this.loadHooks();
  }

  /**
   * Test a hook with a sample context
   */
  public async testHook(
    hookId: string,
    context: HookContext,
  ): Promise<HookResult> {
    const hook = this.hooks.get(hookId);
    if (!hook) {
      throw new Error(`Hook not found: ${hookId}`);
    }

    return this.executeScript(hook.script, context);
  }
}
```

#### apps/electron/src/main/application/mcp-core/mcp-manager/request-handlers.ts (更新)

```typescript
// インポートに追加
import { HookContext } from "@mcp_router/shared";

// コンストラクタの引数にDatabaseServiceを追加し、HookManagerを初期化
constructor(
  serverManager: ServerManager,
  loggingService: LoggingService,
  databaseService: DatabaseService,
) {
  // ... 既存のコード ...
  
  this.hookManager = new HookManager(databaseService, new McpLogger());
}

// handleCallToolメソッドを更新（hookContextにtoolNameを追加）
public async handleCallTool(request: any): Promise<any> {
  const toolName = request.params.name;

  // ... 既存のコード ...

  // Create hook context
  const hookContext: HookContext = {
    requestType: "CallTool",
    serverName,
    serverId,
    clientId,
    token,
    toolName: originalToolName, // ← これを追加
    request: {
      method: "tools/call",
      params: request.params,
    },
    metadata: {},
    startTime: Date.now(),
  };

  // Execute pre-hooks
  const preHookResult = await this.hookManager.executePreHooks(hookContext);
  if (!preHookResult.continue) {
    throw new McpError(
      ErrorCode.InvalidRequest,
      preHookResult.error?.message || "Request blocked by hook",
    );
  }

  // ... 既存のリクエスト処理 ...

  // Execute post-hooks
  const postHookContext: HookContext = {
    ...hookContext,
    response: result,
    duration: Date.now() - hookContext.startTime,
  };

  const postHookResult = await this.hookManager.executePostHooks(postHookContext);
  if (postHookResult.context?.response) {
    result = postHookResult.context.response;
  }

  return result;
}
```

### 4. IPCハンドラーの実装

#### apps/electron/src/main/infrastructure/ipc/handlers/hook-handler.ts (新規作成)

```typescript
import { ipcMain } from "electron";
import { MCPHook, HookContext } from "@mcp_router/shared";
import { DatabaseService } from "@/main/infrastructure/database";
import { HookRepository } from "@/main/infrastructure/database/repositories/hook/hook-repository";
import { RepositoryFactory } from "@/main/infrastructure/database/factories/repository-factory";
import { v4 as uuidv4 } from "uuid";

export function setupHookHandlers(databaseService: DatabaseService): void {
  const hookRepository = RepositoryFactory.getHookRepository(databaseService);
  const getMCPServerManager = () => (global as any).getMCPServerManager();

  /**
   * List all hooks
   */
  ipcMain.handle("hook:list", async () => {
    try {
      return await hookRepository.listHooks();
    } catch (error) {
      console.error("Failed to list hooks:", error);
      throw error;
    }
  });

  /**
   * Get a specific hook by ID
   */
  ipcMain.handle("hook:get", async (_, id: string) => {
    try {
      return await hookRepository.getHook(id);
    } catch (error) {
      console.error(`Failed to get hook ${id}:`, error);
      throw error;
    }
  });

  /**
   * Create a new hook
   */
  ipcMain.handle(
    "hook:create",
    async (_, hookData: Omit<MCPHook, "id" | "createdAt" | "updatedAt">) => {
      try {
        const hook: MCPHook = {
          ...hookData,
          id: uuidv4(),
          executionOrder: hookData.executionOrder ?? 0,
          createdAt: Date.now(),
          updatedAt: Date.now(),
        };

        await hookRepository.upsertHook(hook);

        // Reload hooks in the manager
        const mcpServerManager = getMCPServerManager();
        // Access hookManager through aggregatorServer's requestHandlers
        const aggregatorServer = mcpServerManager.getAggregatorServer();
        if (aggregatorServer) {
          // hookManager is private, so we need to reload hooks differently
          // For now, just log that hooks need to be reloaded
          console.log(
            "Hooks updated - restart may be required for changes to take effect",
          );
        }

        return hook;
      } catch (error) {
        console.error("Failed to create hook:", error);
        throw error;
      }
    },
  );

  /**
   * Update an existing hook
   */
  ipcMain.handle(
    "hook:update",
    async (
      _,
      id: string,
      updates: Partial<Omit<MCPHook, "id" | "createdAt" | "updatedAt">>,
    ) => {
      try {
        await hookRepository.updateHook(id, updates);

        // Reload hooks in the manager
        const mcpServerManager = getMCPServerManager();
        // Access hookManager through aggregatorServer's requestHandlers
        const aggregatorServer = mcpServerManager.getAggregatorServer();
        if (aggregatorServer) {
          // hookManager is private, so we need to reload hooks differently
          // For now, just log that hooks need to be reloaded
          console.log(
            "Hooks updated - restart may be required for changes to take effect",
          );
        }

        return await hookRepository.getHook(id);
      } catch (error) {
        console.error(`Failed to update hook ${id}:`, error);
        throw error;
      }
    },
  );

  /**
   * Delete a hook
   */
  ipcMain.handle("hook:delete", async (_, id: string) => {
    try {
      await hookRepository.deleteHook(id);

      // Reload hooks in the manager
      const mcpServerManager = getMCPServerManager();
      // Access hookManager through aggregatorServer's requestHandlers
      const aggregatorServer = mcpServerManager.getAggregatorServer();
      if (aggregatorServer) {
        // hookManager is private, so we need to reload hooks differently
        // For now, just log that hooks need to be reloaded
        console.log(
          "Hooks updated - restart may be required for changes to take effect",
        );
      }

      return true;
    } catch (error) {
      console.error(`Failed to delete hook ${id}:`, error);
      throw error;
    }
  });

  /**
   * Enable/disable a hook
   */
  ipcMain.handle("hook:setEnabled", async (_, id: string, enabled: boolean) => {
    try {
      await hookRepository.updateHook(id, { enabled });

      // Reload hooks in the manager
      const mcpServerManager = getMCPServerManager();
      // Access hookManager through aggregatorServer's requestHandlers
      const aggregatorServer = mcpServerManager.getAggregatorServer();
      if (aggregatorServer) {
        // hookManager is private, so we need to reload hooks differently
        // For now, just log that hooks need to be reloaded
        console.log(
          "Hooks updated - restart may be required for changes to take effect",
        );
      }

      return await hookRepository.getHook(id);
    } catch (error) {
      console.error(
        `Failed to ${enabled ? "enable" : "disable"} hook ${id}:`,
        error,
      );
      throw error;
    }
  });

  /**
   * Reorder hooks
   */
  ipcMain.handle("hook:reorder", async (_, hookIds: string[]) => {
    try {
      await hookRepository.reorderHooks(hookIds);

      // Reload hooks in the manager
      const mcpServerManager = getMCPServerManager();
      // Access hookManager through aggregatorServer's requestHandlers
      const aggregatorServer = mcpServerManager.getAggregatorServer();
      if (aggregatorServer) {
        // hookManager is private, so we need to reload hooks differently
        // For now, just log that hooks need to be reloaded
        console.log(
          "Hooks updated - restart may be required for changes to take effect",
        );
      }

      return await hookRepository.listHooks();
    } catch (error) {
      console.error("Failed to reorder hooks:", error);
      throw error;
    }
  });

  /**
   * Test a hook with sample context
   */
  ipcMain.handle("hook:test", async (_, id: string, context: HookContext) => {
    try {
      // For now, we can't test hooks directly through IPC
      // This would require exposing the hookManager in the MCPServerManager
      throw new Error("Hook testing is not yet implemented through IPC");
    } catch (error) {
      console.error(`Failed to test hook ${id}:`, error);
      throw error;
    }
  });
}
```

#### apps/electron/src/main/infrastructure/ipc/index.ts (更新)

```typescript
// インポートに追加
import { setupHookHandlers } from "./handlers/hook-handler";

// setupIpcHandlersに追加
export function setupIpcHandlers(databaseService: DatabaseService): void {
  // ... 既存のハンドラー ...
  
  // Hook関連
  setupHookHandlers(databaseService);
}
```

### 5. UIコンポーネントの実装

#### apps/electron/src/renderer/stores/hook-store.ts (新規作成)

```typescript
import { create } from "zustand";
import { immer } from "zustand/middleware/immer";
import { MCPHook, HookContext, HookResult } from "@mcp_router/shared";
import { getPlatformAPI } from "@/renderer/stores";

interface HookStoreState {
  hooks: MCPHook[];
  loading: boolean;
  error: string | null;
  selectedHook: MCPHook | null;
  testResult: HookResult | null;
  testing: boolean;
}

interface HookStoreActions {
  // Data fetching
  fetchHooks: () => Promise<void>;
  
  // CRUD operations
  createHook: (hookData: Omit<MCPHook, 'id' | 'createdAt' | 'updatedAt'>) => Promise<MCPHook>;
  updateHook: (id: string, updates: Partial<Omit<MCPHook, 'id' | 'createdAt' | 'updatedAt'>>) => Promise<void>;
  deleteHook: (id: string) => Promise<void>;
  
  // Hook management
  setHookEnabled: (id: string, enabled: boolean) => Promise<void>;
  reorderHooks: (hookIds: string[]) => Promise<void>;
  
  // Testing
  testHook: (id: string, context: HookContext) => Promise<void>;
  
  // UI state
  setSelectedHook: (hook: MCPHook | null) => void;
  clearTestResult: () => void;
  clearError: () => void;
}

type HookStore = HookStoreState & HookStoreActions;

export const useHookStore = create<HookStore>()(
  immer((set, get) => ({
    // Initial state
    hooks: [],
    loading: false,
    error: null,
    selectedHook: null,
    testResult: null,
    testing: false,

    // Fetch all hooks
    fetchHooks: async () => {
      set((state) => {
        state.loading = true;
        state.error = null;
      });

      try {
        const platformAPI = getPlatformAPI();
        const hooks = await platformAPI.hooks.listHooks();
        
        set((state) => {
          state.hooks = hooks;
          state.loading = false;
        });
      } catch (error) {
        set((state) => {
          state.error = error instanceof Error ? error.message : "Failed to fetch hooks";
          state.loading = false;
        });
      }
    },

    // Create a new hook
    createHook: async (hookData) => {
      try {
        const platformAPI = getPlatformAPI();
        const newHook = await platformAPI.hooks.createHook(hookData);
        
        set((state) => {
          state.hooks.push(newHook);
        });
        
        return newHook;
      } catch (error) {
        set((state) => {
          state.error = error instanceof Error ? error.message : "Failed to create hook";
        });
        throw error;
      }
    },

    // Update an existing hook
    updateHook: async (id, updates) => {
      try {
        const platformAPI = getPlatformAPI();
        const updatedHook = await platformAPI.hooks.updateHook(id, updates);
        
        set((state) => {
          const index = state.hooks.findIndex((h: MCPHook) => h.id === id);
          if (index !== -1 && updatedHook) {
            state.hooks[index] = updatedHook;
          }
          if (state.selectedHook?.id === id && updatedHook) {
            state.selectedHook = updatedHook;
          }
        });
      } catch (error) {
        set((state) => {
          state.error = error instanceof Error ? error.message : "Failed to update hook";
        });
        throw error;
      }
    },

    // Delete a hook
    deleteHook: async (id) => {
      try {
        const platformAPI = getPlatformAPI();
        await platformAPI.hooks.deleteHook(id);
        
        set((state) => {
          state.hooks = state.hooks.filter((h: MCPHook) => h.id !== id);
          if (state.selectedHook?.id === id) {
            state.selectedHook = null;
          }
        });
      } catch (error) {
        set((state) => {
          state.error = error instanceof Error ? error.message : "Failed to delete hook";
        });
        throw error;
      }
    },

    // Enable/disable a hook
    setHookEnabled: async (id, enabled) => {
      try {
        const platformAPI = getPlatformAPI();
        const updatedHook = await platformAPI.hooks.setHookEnabled(id, enabled);
        
        set((state) => {
          const index = state.hooks.findIndex((h: MCPHook) => h.id === id);
          if (index !== -1 && updatedHook) {
            state.hooks[index] = updatedHook;
          }
          if (state.selectedHook?.id === id && updatedHook) {
            state.selectedHook = updatedHook;
          }
        });
      } catch (error) {
        set((state) => {
          state.error = error instanceof Error ? error.message : "Failed to update hook status";
        });
        throw error;
      }
    },

    // Reorder hooks
    reorderHooks: async (hookIds) => {
      try {
        const platformAPI = getPlatformAPI();
        const reorderedHooks = await platformAPI.hooks.reorderHooks(hookIds);
        
        set((state) => {
          state.hooks = reorderedHooks;
        });
      } catch (error) {
        set((state) => {
          state.error = error instanceof Error ? error.message : "Failed to reorder hooks";
        });
        throw error;
      }
    },

    // Test a hook
    testHook: async (id, context) => {
      set((state) => {
        state.testing = true;
        state.testResult = null;
        state.error = null;
      });

      try {
        const platformAPI = getPlatformAPI();
        const result = await platformAPI.hooks.testHook(id, context);
        
        set((state) => {
          state.testResult = result;
          state.testing = false;
        });
      } catch (error) {
        set((state) => {
          state.error = error instanceof Error ? error.message : "Failed to test hook";
          state.testing = false;
        });
      }
    },

    // UI state management
    setSelectedHook: (hook) => {
      set((state) => {
        state.selectedHook = hook;
        state.testResult = null;
      });
    },

    clearTestResult: () => {
      set((state) => {
        state.testResult = null;
      });
    },

    clearError: () => {
      set((state) => {
        state.error = null;
      });
    },
  }))
);
```

#### apps/electron/src/renderer/stores/index.ts (更新)

```typescript
// 最後にエクスポートを追加
export { getPlatformAPI } from "./platform-api-store";
```

#### apps/electron/src/renderer/components/hook/HookManager.tsx (新規作成)

```typescript
import React, { useEffect, useState } from "react";
import { Plus, Play, Edit, Trash2, GripVertical } from "lucide-react";
import { Button } from "@mcp_router/ui";
import PageLayout from "@/renderer/components/layout/PageLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@mcp_router/ui";
import { Badge } from "@mcp_router/ui";
import { useHookStore } from "@/renderer/stores/hook-store";
import { HookEditDialog } from "./HookEditDialog";
import { HookTestDialog } from "./HookTestDialog";
import { MCPHook } from "@mcp_router/shared";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { HookListItem } from "./HookListItem";
import { Alert, AlertDescription } from "@mcp_router/ui";
import { Loader2 } from "lucide-react";

export default function HookManager() {
  const {
    hooks,
    loading,
    error,
    fetchHooks,
    reorderHooks,
    setHookEnabled,
    deleteHook,
    clearError,
  } = useHookStore();

  const [editingHook, setEditingHook] = useState<MCPHook | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [testingHook, setTestingHook] = useState<MCPHook | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  useEffect(() => {
    fetchHooks();
  }, [fetchHooks]);

  const handleDragEnd = async (event: any) => {
    const { active, over } = event;

    if (active.id !== over.id) {
      const oldIndex = hooks.findIndex((h: MCPHook) => h.id === active.id);
      const newIndex = hooks.findIndex((h: MCPHook) => h.id === over.id);

      const newHooks = arrayMove(hooks, oldIndex, newIndex);
      const hookIds = newHooks.map((h: MCPHook) => h.id);
      
      await reorderHooks(hookIds);
    }
  };

  const handleCreate = () => {
    setIsCreating(true);
    setEditingHook(null);
  };

  const handleEdit = (hook: MCPHook) => {
    setEditingHook(hook);
    setIsCreating(false);
  };

  const handleTest = (hook: MCPHook) => {
    setTestingHook(hook);
  };

  const handleToggleEnabled = async (hook: MCPHook) => {
    await setHookEnabled(hook.id, !hook.enabled);
  };

  const handleDelete = async (hook: MCPHook) => {
    if (confirm(`Are you sure you want to delete the hook "${hook.name}"?`)) {
      await deleteHook(hook.id);
    }
  };

  const handleCloseEditDialog = () => {
    setEditingHook(null);
    setIsCreating(false);
  };

  const handleCloseTestDialog = () => {
    setTestingHook(null);
  };

  if (loading) {
    return (
      <PageLayout>
        <div className="flex items-center justify-center h-64">
          <Loader2 className="w-8 h-8 animate-spin" />
        </div>
      </PageLayout>
    );
  }

  return (
    <PageLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Hooks</h1>
            <p className="text-muted-foreground mt-1">
              Configure pre and post hooks for MCP requests
            </p>
          </div>
          <Button onClick={handleCreate}>
            <Plus className="w-4 h-4 mr-2" />
            New Hook
          </Button>
        </div>

        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <Card>
          <CardHeader>
            <CardTitle>Hook Configuration</CardTitle>
          </CardHeader>
          <CardContent>
            {hooks.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <p>No hooks configured yet.</p>
                <p className="mt-2">Create your first hook to get started.</p>
              </div>
            ) : (
              <DndContext
                sensors={sensors}
                collisionDetection={closestCenter}
                onDragEnd={handleDragEnd}
              >
                <SortableContext
                  items={hooks.map((h: MCPHook) => h.id)}
                  strategy={verticalListSortingStrategy}
                >
                  <div className="space-y-2">
                    {hooks.map((hook) => (
                      <HookListItem
                        key={hook.id}
                        hook={hook}
                        onEdit={handleEdit}
                        onTest={handleTest}
                        onToggleEnabled={handleToggleEnabled}
                        onDelete={handleDelete}
                      />
                    ))}
                  </div>
                </SortableContext>
              </DndContext>
            )}
          </CardContent>
        </Card>
      </div>

      {(editingHook || isCreating) && (
        <HookEditDialog
          hook={editingHook}
          isOpen={true}
          onClose={handleCloseEditDialog}
        />
      )}

      {testingHook && (
        <HookTestDialog
          hook={testingHook}
          isOpen={true}
          onClose={handleCloseTestDialog}
        />
      )}
    </PageLayout>
  );
}
```

#### apps/electron/src/renderer/components/hook/HookListItem.tsx (新規作成)

```typescript
import React from "react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { MCPHook } from "@mcp_router/shared";
import { Badge } from "@mcp_router/ui";
import { Button } from "@mcp_router/ui";
import { Switch } from "@mcp_router/ui";
import { GripVertical, Play, Edit, Trash2 } from "lucide-react";
import { cn } from "@mcp_router/ui";

interface HookListItemProps {
  hook: MCPHook;
  onEdit: (hook: MCPHook) => void;
  onTest: (hook: MCPHook) => void;
  onToggleEnabled: (hook: MCPHook) => void;
  onDelete: (hook: MCPHook) => void;
}

export function HookListItem({
  hook,
  onEdit,
  onTest,
  onToggleEnabled,
  onDelete,
}: HookListItemProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: hook.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const getHookTypeBadge = () => {
    switch (hook.hookType) {
      case "pre":
        return <Badge variant="secondary">Pre-hook</Badge>;
      case "post":
        return <Badge variant="secondary">Post-hook</Badge>;
      case "both":
        return <Badge variant="secondary">Pre & Post</Badge>;
    }
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        "flex items-center gap-4 p-4 bg-background border rounded-lg",
        isDragging && "opacity-50"
      )}
    >
      <div
        {...attributes}
        {...listeners}
        className="cursor-grab hover:bg-muted p-1 rounded"
      >
        <GripVertical className="w-4 h-4 text-muted-foreground" />
      </div>

      <div className="flex-1 space-y-1">
        <div className="flex items-center gap-2">
          <h3 className="font-medium">{hook.name}</h3>
          {getHookTypeBadge()}
          {!hook.enabled && (
            <Badge variant="outline" className="text-muted-foreground">
              Disabled
            </Badge>
          )}
        </div>
        {hook.description && (
          <p className="text-sm text-muted-foreground">{hook.description}</p>
        )}
      </div>

      <div className="flex items-center gap-2">
        <Switch
          checked={hook.enabled}
          onCheckedChange={() => onToggleEnabled(hook)}
        />
        <Button
          variant="ghost"
          size="icon"
          onClick={() => onTest(hook)}
          title="Test hook"
        >
          <Play className="w-4 h-4" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          onClick={() => onEdit(hook)}
          title="Edit hook"
        >
          <Edit className="w-4 h-4" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          onClick={() => onDelete(hook)}
          title="Delete hook"
        >
          <Trash2 className="w-4 h-4" />
        </Button>
      </div>
    </div>
  );
}
```

#### apps/electron/src/renderer/components/hook/HookEditDialog.tsx (新規作成)

```typescript
import React, { useState, useEffect } from "react";
import { MCPHook } from "@mcp_router/shared";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@mcp_router/ui";
import { Button } from "@mcp_router/ui";
import { Input } from "@mcp_router/ui";
import { Label } from "@mcp_router/ui";
import { Textarea } from "@mcp_router/ui";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@mcp_router/ui";
import { useHookStore } from "@/renderer/stores/hook-store";
import { CodeEditor } from "@/renderer/components/common/CodeEditor";
import { Alert, AlertDescription } from "@mcp_router/ui";
import { InfoIcon } from "lucide-react";

interface HookEditDialogProps {
  hook: MCPHook | null;
  isOpen: boolean;
  onClose: () => void;
}

const DEFAULT_SCRIPT = `// Hook script example
// Available globals: context, console, sleep, validateToken, getServerInfo

// Apply filtering based on your conditions
if (context.requestType === 'CallTool') {
  // Filter by tool name
  if (context.toolName === 'specific-tool') {
    console.log('Specific tool called:', context.toolName);
  }
}

// Filter by server
if (context.serverName === 'specific-server') {
  console.log('Request to specific server');
}

// Modify request parameters
// context.request.params.someParam = 'modified value';

// For post-hooks, you can access the response
if (context.response) {
  console.log('Response received in', context.duration, 'ms');
}

// Continue with the request
return { continue: true, context };

// To block the request:
// return { 
//   continue: false, 
//   error: { 
//     code: 'BLOCKED', 
//     message: 'Request blocked by hook' 
//   } 
// };`;

export function HookEditDialog({ hook, isOpen, onClose }: HookEditDialogProps) {
  const { createHook, updateHook } = useHookStore();
  
  const [name, setName] = useState(hook?.name || "");
  const [description, setDescription] = useState(hook?.description || "");
  const [hookType, setHookType] = useState<"pre" | "post" | "both">(
    hook?.hookType || "pre"
  );
  const [script, setScript] = useState(hook?.script || DEFAULT_SCRIPT);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSave = async () => {
    if (!name.trim()) {
      setError("Hook name is required");
      return;
    }

    if (!script.trim()) {
      setError("Hook script is required");
      return;
    }

    setSaving(true);
    setError(null);

    try {
      const hookData = {
        name: name.trim(),
        description: description.trim() || undefined,
        enabled: hook?.enabled ?? true,
        executionOrder: hook?.executionOrder ?? 0,
        hookType,
        script,
      };

      if (hook) {
        await updateHook(hook.id, hookData);
      } else {
        await createHook(hookData);
      }

      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save hook");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {hook ? "Edit Hook" : "Create New Hook"}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <div className="grid gap-4">
            <div className="grid gap-2">
              <Label htmlFor="name">Name</Label>
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="My Hook"
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="description">Description (optional)</Label>
              <Textarea
                id="description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="What does this hook do?"
                rows={2}
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="hookType">Hook Type</Label>
              <Select value={hookType} onValueChange={(v: any) => setHookType(v)}>
                <SelectTrigger id="hookType">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="pre">Pre-hook (before request)</SelectItem>
                  <SelectItem value="post">Post-hook (after response)</SelectItem>
                  <SelectItem value="both">Both (pre and post)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-4">
            <Alert>
              <InfoIcon className="h-4 w-4" />
              <AlertDescription>
                Write JavaScript code that will be executed in a sandboxed environment.
                The script should return an object with `continue` (boolean) and optionally `context` or `error`.
                All filtering (by request type, server, tool name) should be done within the script.
              </AlertDescription>
            </Alert>
            
            <div className="h-96">
              <CodeEditor
                value={script}
                onChange={setScript}
                language="javascript"
              />
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? "Saving..." : hook ? "Update Hook" : "Create Hook"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
```

#### apps/electron/src/renderer/components/hook/HookTestDialog.tsx (新規作成)

```typescript
import React, { useState } from "react";
import { MCPHook, HookContext } from "@mcp_router/shared";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@mcp_router/ui";
import { Button } from "@mcp_router/ui";
import { Label } from "@mcp_router/ui";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@mcp_router/ui";
import { useHookStore } from "@/renderer/stores/hook-store";
import { CodeEditor } from "@/renderer/components/common/CodeEditor";
import { Alert, AlertDescription } from "@mcp_router/ui";
import { Loader2 } from "lucide-react";

interface HookTestDialogProps {
  hook: MCPHook;
  isOpen: boolean;
  onClose: () => void;
}

const REQUEST_TYPES = [
  "CallTool",
  "ListTools",
  "ReadResource",
  "ListResources",
  "GetPrompt",
  "ListPrompts",
] as const;

const DEFAULT_CONTEXT: HookContext = {
  requestType: "CallTool",
  serverName: "test-server",
  serverId: "test-server-id",
  clientId: "test-client",
  token: "test-token",
  toolName: "test-tool",
  request: {
    method: "tools/call",
    params: {
      name: "test-tool",
      arguments: {
        test: "value",
      },
    },
  },
  metadata: {},
  startTime: Date.now(),
};

export function HookTestDialog({ hook, isOpen, onClose }: HookTestDialogProps) {
  const { testHook, testResult, testing, error } = useHookStore();
  const [context, setContext] = useState<HookContext>(DEFAULT_CONTEXT);
  const [contextJson, setContextJson] = useState(
    JSON.stringify(DEFAULT_CONTEXT, null, 2)
  );

  const handleTest = async () => {
    try {
      const parsedContext = JSON.parse(contextJson);
      await testHook(hook.id, parsedContext);
    } catch (err) {
      console.error("Failed to parse context:", err);
    }
  };

  const handleContextChange = (value: string) => {
    setContextJson(value);
    try {
      const parsed = JSON.parse(value);
      setContext(parsed);
    } catch {
      // Invalid JSON, ignore
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Test Hook: {hook.name}</DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <div className="space-y-4">
            <div>
              <Label>Test Context</Label>
              <p className="text-sm text-muted-foreground mb-2">
                Edit the context JSON to test different scenarios
              </p>
              <div className="h-64 border rounded">
                <CodeEditor
                  value={contextJson}
                  onChange={handleContextChange}
                  language="json"
                />
              </div>
            </div>

            {testResult && (
              <div>
                <Label>Test Result</Label>
                <div className="mt-2 p-4 bg-muted rounded">
                  <pre className="text-sm">
                    {JSON.stringify(testResult, null, 2)}
                  </pre>
                </div>
              </div>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Close
          </Button>
          <Button onClick={handleTest} disabled={testing}>
            {testing ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Testing...
              </>
            ) : (
              "Run Test"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
```

### 6. 既存コンポーネントへの統合

#### apps/electron/src/renderer/components/Sidebar.tsx (更新)

```typescript
// MCPセクションに以下を追加（Serversの後）
{!isRemoteWorkspace && (
  <SidebarMenuItem>
    <SidebarMenuButton asChild tooltip="Hooks" isActive={location.pathname === "/hooks"}>
      <Link to="/hooks" className="flex items-center gap-3 py-5 px-3 w-full">
        <IconWebhook className="h-6 w-6" />
        <span className="text-base">Hooks</span>
      </Link>
    </SidebarMenuButton>
  </SidebarMenuItem>
)}
```

#### apps/electron/src/renderer/routes.tsx (更新)

```typescript
// インポートに追加
const HookManager = lazy(() => import("@/renderer/components/hook/HookManager"));

// routesに追加
{
  path: "hooks",
  element: <HookManager />,
},
```

#### apps/electron/src/renderer/lib/platform-api.ts (更新)

```typescript
// RemotePlatformAPI classに追加
get hooks() {
  return {
    listHooks: async () => this.invoke<MCPHook[]>("hook:list"),
    getHook: async (id: string) => this.invoke<MCPHook | null>("hook:get", id),
    createHook: async (hookData: Omit<MCPHook, 'id' | 'createdAt' | 'updatedAt'>) =>
      this.invoke<MCPHook>("hook:create", hookData),
    updateHook: async (id: string, updates: Partial<Omit<MCPHook, 'id' | 'createdAt' | 'updatedAt'>>) =>
      this.invoke<MCPHook | null>("hook:update", id, updates),
    deleteHook: async (id: string) =>
      this.invoke<boolean>("hook:delete", id),
    setHookEnabled: async (id: string, enabled: boolean) =>
      this.invoke<MCPHook | null>("hook:setEnabled", id, enabled),
    reorderHooks: async (hookIds: string[]) =>
      this.invoke<MCPHook[]>("hook:reorder", hookIds),
    testHook: async (id: string, context: HookContext) =>
      this.invoke<HookResult>("hook:test", id, context),
  };
}
```

### エラー対処とトラブルシューティング

#### 1. "order"カラムのSQLエラー

問題: SQLiteの予約語である"order"を使用しているため、SQLエラーが発生
解決: `executionOrder`に変更

#### 2. Module not found: '@/renderer/components/ui/*'

問題: UI importパスが間違っている
解決: `@mcp_router/ui`に変更

#### 3. 'getPlatformAPI' doesn't exist

問題: getPlatformAPIがエクスポートされていない
解決: `stores/index.ts`でエクスポートを追加

#### 4. Missing @dnd-kit dependencies

問題: ドラッグ&ドロップ用のライブラリが不足
解決: `pnpm add @dnd-kit/sortable @dnd-kit/utilities @dnd-kit/core`

#### 5. Module not found: 'immer'

問題: zustand/middleware/immerで必要なimmerがない
解決: `pnpm add immer`

#### 6. データベースマイグレーションエラー

問題: 既存のデータベースとスキーマが不一致
解決: データベースファイルを削除して再作成

### 依存パッケージのインストール

```bash
# electronアプリケーションディレクトリで実行
cd apps/electron
pnpm add @dnd-kit/sortable @dnd-kit/utilities @dnd-kit/core immer
```

### テスト手順

1. アプリケーションを起動
2. サイドバーのMCPセクションから「Hooks」を選択
3. 「New Hook」ボタンをクリック
4. フック名、タイプ、スクリプトを入力
5. 「Create Hook」をクリック
6. 作成されたフックが一覧に表示されることを確認
7. ドラッグ&ドロップで順序変更をテスト
8. スイッチで有効/無効を切り替えテスト
9. テストボタンでフックの動作確認