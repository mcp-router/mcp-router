import { HookModule } from "@mcp_router/shared";
import { getHookRepository, HookRepository } from "./hook.repository";
import vm from "vm";

/**
 * Hook Moduleドメインサービス
 * Hook Moduleのビジネスロジックとバックエンドサービスを提供
 */
export class HookService {
  private static instance: HookService | null = null;
  private repository: HookRepository;

  private constructor() {
    this.repository = getHookRepository();
  }

  /**
   * シングルトンインスタンスの取得
   */
  public static getInstance(): HookService {
    if (!HookService.instance) {
      HookService.instance = new HookService();
    }
    return HookService.instance;
  }

  /**
   * テスト用にインスタンスをリセット
   */
  public static resetInstance(): void {
    HookService.instance = null;
  }

  /**
   * 全てのHook Moduleを取得
   */
  public async getAllHookModules(): Promise<HookModule[]> {
    return this.repository.getAllHookModules();
  }

  /**
   * IDでHook Moduleを取得
   */
  public async getHookModuleById(id: string): Promise<HookModule | null> {
    return this.repository.getHookModuleById(id);
  }

  /**
   * 名前でHook Moduleを取得
   */
  public async getHookModuleByName(name: string): Promise<HookModule | null> {
    return this.repository.getHookModuleByName(name);
  }

  /**
   * Hook Moduleを作成
   */
  public async createHookModule(
    module: Omit<HookModule, "id">,
  ): Promise<HookModule> {
    // バリデーション
    this.validateHookModule(module);

    // スクリプトの構文チェック
    const validation = await this.validateHookScript(module.script);
    if (!validation.valid) {
      throw new Error(`Invalid hook script: ${validation.error}`);
    }

    return this.repository.createHookModule(module);
  }

  /**
   * Hook Moduleを更新
   */
  public async updateHookModule(
    id: string,
    updates: Partial<Omit<HookModule, "id">>,
  ): Promise<HookModule | null> {
    // スクリプトが更新される場合はバリデーション
    if (updates.script) {
      const validation = await this.validateHookScript(updates.script);
      if (!validation.valid) {
        throw new Error(`Invalid hook script: ${validation.error}`);
      }
    }

    // 名前が更新される場合は重複チェック
    if (updates.name) {
      const existing = await this.getHookModuleByName(updates.name);
      if (existing && existing.id !== id) {
        throw new Error(
          `Hook module with name "${updates.name}" already exists`,
        );
      }
    }

    return this.repository.updateHookModule(id, updates);
  }

  /**
   * Hook Moduleを削除
   */
  public async deleteHookModule(id: string): Promise<boolean> {
    // WorkflowでこのHookModuleが使用されているかチェック
    const { WorkflowService } = await import("./workflow.service");
    const workflowService = WorkflowService.getInstance();
    const workflows = await workflowService.getAllWorkflows();

    // 使用しているWorkflowを検索
    const usingWorkflows: string[] = [];
    for (const workflow of workflows) {
      for (const node of workflow.nodes) {
        if (node.type === "hook") {
          const hook = node.data?.hook as any;
          if (hook?.hookModuleId === id) {
            usingWorkflows.push(workflow.name);
          }
        }
      }
    }

    // 使用されている場合はエラーを投げる
    if (usingWorkflows.length > 0) {
      throw new Error(
        `Cannot delete hook module. It is used by workflow(s): ${usingWorkflows.join(", ")}`,
      );
    }

    return this.repository.deleteHookModule(id);
  }

  /**
   * Hook Moduleをインポート（名前の重複を回避）
   */
  public async importHookModule(
    module: Omit<HookModule, "id">,
  ): Promise<HookModule> {
    // バリデーション
    this.validateHookModule(module);

    // スクリプトの構文チェック
    const validation = await this.validateHookScript(module.script);
    if (!validation.valid) {
      throw new Error(`Invalid hook script: ${validation.error}`);
    }

    return this.repository.importHookModule(module);
  }

  /**
   * Hook Moduleを実行（テスト用）
   */
  public async executeHookModule(id: string, context: any): Promise<any> {
    const module = await this.getHookModuleById(id);
    if (!module) {
      throw new Error(`Hook module not found: ${id}`);
    }

    return this.executeHookScript(module.script, context);
  }

  /**
   * Hook スクリプトを実行
   */
  public async executeHookScript(script: string, context: any): Promise<any> {
    try {
      // サンドボックス環境を作成
      const sandbox = {
        context,
        console: {
          log: (...args: any[]) => console.log(`[Hook]`, ...args),
          error: (...args: any[]) => console.error(`[Hook]`, ...args),
          warn: (...args: any[]) => console.warn(`[Hook]`, ...args),
        },
        // 必要に応じて他のグローバルオブジェクトを追加
        JSON,
        Object,
        Array,
        String,
        Number,
        Boolean,
        Date,
        Math,
        Promise,
      };

      // スクリプトをラップして戻り値を取得
      const wrappedScript = `
        (async function() {
          ${script}
        })()
      `;

      // VMコンテキストでスクリプトを実行
      const vmScript = new vm.Script(wrappedScript);
      const vmContext = vm.createContext(sandbox);

      // タイムアウトを設定（5秒）
      const result = await vmScript.runInContext(vmContext, {
        timeout: 5000,
        displayErrors: true,
      });

      return result;
    } catch (error: any) {
      console.error("Hook execution error:", error);
      throw new Error(`Hook execution failed: ${error.message}`);
    }
  }

  /**
   * Hook スクリプトのバリデーション
   */
  public async validateHookScript(
    script: string,
  ): Promise<{ valid: boolean; error?: string }> {
    try {
      // 構文チェックのみ（実行はしない）
      new vm.Script(script);
      return { valid: true };
    } catch (error: any) {
      return {
        valid: false,
        error: error.message || "Invalid JavaScript syntax",
      };
    }
  }

  /**
   * Hook Moduleのバリデーション
   */
  private validateHookModule(module: any): void {
    if (!module.name || module.name.trim().length === 0) {
      throw new Error("Hook module name is required");
    }

    if (!module.script || module.script.trim().length === 0) {
      throw new Error("Hook module script is required");
    }

    // 名前の長さ制限
    if (module.name.length > 100) {
      throw new Error("Hook module name is too long (max 100 characters)");
    }

    // スクリプトのサイズ制限（1MB）
    if (module.script.length > 1024 * 1024) {
      throw new Error("Hook module script is too large (max 1MB)");
    }
  }
}

/**
 * HookServiceのシングルトンインスタンスを取得
 */
export function getHookService(): HookService {
  return HookService.getInstance();
}
