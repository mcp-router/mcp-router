import { app } from "electron";
import * as fs from "fs";
import * as path from "path";
import {
  SharedConfig,
  ISharedConfigManager,
  AppSettings,
  Token,
  DEFAULT_APP_SETTINGS,
} from "@mcp_router/shared";
import { SqliteManager } from "./database/sqlite-manager";

/**
 * 共通設定ファイルマネージャー
 * ワークスペース間で共有される設定をJSONファイルで管理
 */
export class SharedConfigManager implements ISharedConfigManager {
  private static instance: SharedConfigManager | null = null;
  private configPath: string;
  private config: SharedConfig;
  private readonly configFileName = "shared-config.json";

  private constructor() {
    this.configPath = path.join(app.getPath("userData"), this.configFileName);
    this.config = this.loadConfig();
  }

  /**
   * シングルトンインスタンスを取得
   */
  public static getInstance(): SharedConfigManager {
    if (!SharedConfigManager.instance) {
      SharedConfigManager.instance = new SharedConfigManager();
    }
    return SharedConfigManager.instance;
  }

  /**
   * インスタンスをリセット（テスト用）
   */
  public static resetInstance(): void {
    SharedConfigManager.instance = null;
  }

  /**
   * 設定ファイルを読み込み
   */
  private loadConfig(): SharedConfig {
    try {
      if (fs.existsSync(this.configPath)) {
        const data = fs.readFileSync(this.configPath, "utf-8");
        const config = JSON.parse(data);

        // 既存のトークンデータを正規化（マイグレーション後の不正なデータを修正）
        if (config.mcpApps?.tokens) {
          config.mcpApps.tokens = config.mcpApps.tokens.map((token: any) => {
            // フィールド名を正規化
            const normalizedToken: Token = {
              id: token.id,
              clientId: token.clientId || token.client_id,
              issuedAt: token.issuedAt || token.issued_at,
              serverIds: [],
            };

            // serverIdsを配列に変換
            const serverIdsValue = token.serverIds || token.server_ids;
            if (serverIdsValue) {
              try {
                normalizedToken.serverIds =
                  typeof serverIdsValue === "string"
                    ? JSON.parse(serverIdsValue)
                    : serverIdsValue;
              } catch (e) {
                normalizedToken.serverIds = [];
              }
            }

            return normalizedToken;
          });
        }

        return config;
      }
    } catch (error) {
      console.error("[SharedConfigManager] Failed to load config:", error);
    }

    // デフォルト設定を返す
    return {
      settings: { ...DEFAULT_APP_SETTINGS },
      mcpApps: {
        tokens: [],
      },
      _meta: {
        version: "1.0.0",
        lastModified: new Date().toISOString(),
      },
    };
  }

  /**
   * 設定ファイルを保存
   */
  private saveConfig(): void {
    try {
      // メタ情報を更新
      if (!this.config._meta) {
        this.config._meta = {
          version: "1.0.0",
          lastModified: new Date().toISOString(),
        };
      } else {
        this.config._meta.lastModified = new Date().toISOString();
      }

      // ファイルに書き込み
      fs.writeFileSync(
        this.configPath,
        JSON.stringify(this.config, null, 2),
        "utf-8",
      );
    } catch (error) {
      console.error("[SharedConfigManager] Failed to save config:", error);
      throw error;
    }
  }

  /**
   * 初期化
   */
  async initialize(): Promise<void> {
    // 設定ファイルが存在しない場合は、既存のデータベースからマイグレーション
    if (!fs.existsSync(this.configPath)) {
      await this.migrateFromDatabase("local-default");
    }
  }

  /**
   * 既存のデータベースからマイグレーション
   */
  async migrateFromDatabase(workspaceId: string): Promise<void> {
    try {
      // ワークスペースのデータベースパスを構築
      const dbPath =
        workspaceId === "local-default"
          ? path.join(app.getPath("userData"), "mcprouter.db")
          : path.join(
              app.getPath("userData"),
              "workspaces",
              workspaceId,
              "database.db",
            );

      if (!fs.existsSync(dbPath)) {
        return;
      }

      const db = new SqliteManager(dbPath);

      // settingsテーブルからデータを移行
      try {
        const settingsRows = db.all<{ key: string; value: string }>(
          "SELECT key, value FROM settings",
        );

        const settings: AppSettings = { ...DEFAULT_APP_SETTINGS };
        settingsRows.forEach((row) => {
          const key = row.key as keyof AppSettings;
          if (key in settings) {
            try {
              settings[key] = JSON.parse(row.value);
            } catch (_) {
              settings[key] = row.value as any;
            }
          }
        });
        this.config.settings = settings;
      } catch (error) {
        console.error(
          "[SharedConfigManager] Failed to migrate settings:",
          error,
        );
      }

      // 現在のワークスペースのすべてのサーバーIDを取得
      let allServerIds: string[] = [];
      const serverRows = db.all<{ id: string }>("SELECT id FROM servers");
      allServerIds = serverRows.map((row) => row.id);

      // tokensテーブルからデータを移行
      try {
        const tokenRows = db.all<any>("SELECT * FROM tokens");

        // フィールド名を正しい形式に変換
        this.config.mcpApps.tokens = tokenRows.map((row) => {
          const token: Token = {
            id: row.id,
            clientId: row.client_id || row.clientId,
            issuedAt: row.issued_at || row.issuedAt,
            serverIds: [],
          };

          // serverIdsを配列に変換
          if (row.server_ids || row.serverIds) {
            const serverIdsValue = row.server_ids || row.serverIds;
            try {
              // JSON文字列の場合はパース
              token.serverIds =
                typeof serverIdsValue === "string"
                  ? JSON.parse(serverIdsValue)
                  : serverIdsValue;
            } catch (e) {
              // パースエラーの場合は空配列
              console.warn(
                `[SharedConfigManager] Failed to parse serverIds for token ${row.id}:`,
                e,
              );
              token.serverIds = [];
            }
          }

          // マイグレーション時は、現在のワークスペースのすべてのサーバーへのアクセス権を付与
          // 既存のserverIdsとマージして重複を除去
          const uniqueServerIds = new Set([
            ...token.serverIds,
            ...allServerIds,
          ]);
          token.serverIds = Array.from(uniqueServerIds);

          return token;
        });

        console.log(
          `[SharedConfigManager] Migrated ${tokenRows.length} tokens with access to all servers`,
        );
      } catch (error) {
        console.error("[SharedConfigManager] Failed to migrate tokens:", error);
      }

      // メタ情報を記録
      this.config._meta = {
        version: "1.0.0",
        migratedAt: new Date().toISOString(),
        lastModified: new Date().toISOString(),
      };

      // 設定を保存
      this.saveConfig();

      db.close();
      console.log("[SharedConfigManager] Migration completed successfully");
    } catch (error) {
      console.error("[SharedConfigManager] Migration failed:", error);
      throw error;
    }
  }

  /**
   * アプリケーション設定を取得
   */
  getSettings(): AppSettings {
    return { ...this.config.settings };
  }

  /**
   * アプリケーション設定を保存
   */
  saveSettings(settings: AppSettings): void {
    this.config.settings = { ...settings };
    this.saveConfig();
  }

  /**
   * トークンリストを取得
   */
  getTokens(): Token[] {
    return [...this.config.mcpApps.tokens];
  }

  /**
   * トークンを取得
   */
  getToken(tokenId: string): Token | undefined {
    return this.config.mcpApps.tokens.find((t) => t.id === tokenId);
  }

  /**
   * トークンを保存
   */
  saveToken(token: Token): void {
    const index = this.config.mcpApps.tokens.findIndex(
      (t) => t.id === token.id,
    );
    if (index >= 0) {
      this.config.mcpApps.tokens[index] = token;
    } else {
      this.config.mcpApps.tokens.push(token);
    }
    this.saveConfig();
  }

  /**
   * トークンを削除
   */
  deleteToken(tokenId: string): void {
    this.config.mcpApps.tokens = this.config.mcpApps.tokens.filter(
      (t) => t.id !== tokenId,
    );
    this.saveConfig();
  }

  /**
   * クライアントIDに関連するトークンを削除
   */
  deleteClientTokens(clientId: string): void {
    this.config.mcpApps.tokens = this.config.mcpApps.tokens.filter(
      (t) => t.clientId !== clientId,
    );
    this.saveConfig();
  }

  /**
   * クライアントIDでトークンを取得
   */
  getTokensByClientId(clientId: string): Token[] {
    return this.config.mcpApps.tokens.filter((t) => t.clientId === clientId);
  }

  /**
   * トークンのサーバーIDリストを更新
   */
  updateTokenServerIds(tokenId: string, serverIds: string[]): void {
    const token = this.config.mcpApps.tokens.find((t) => t.id === tokenId);
    if (token) {
      token.serverIds = serverIds;
      this.saveConfig();
    }
  }

  /**
   * ワークスペースのサーバーリストとトークンを同期
   * 新しいサーバーがあれば自動的にトークンに追加
   */
  syncTokensWithWorkspaceServers(serverIds: string[]): void {
    let updated = false;

    this.config.mcpApps.tokens.forEach((token) => {
      // 既存のserverIdsと新しいserverIdsをマージして重複を除去
      const currentServerIds = new Set(token.serverIds);
      const initialSize = currentServerIds.size;

      // 新しいサーバーIDを追加
      serverIds.forEach((id) => currentServerIds.add(id));

      // 変更があった場合のみ更新
      if (currentServerIds.size > initialSize) {
        token.serverIds = Array.from(currentServerIds);
        updated = true;
        console.log(
          `[SharedConfigManager] Updated token ${token.id} with ${currentServerIds.size - initialSize} new server(s)`,
        );
      }
    });

    // 変更があった場合は保存
    if (updated) {
      this.saveConfig();
      console.log(
        "[SharedConfigManager] Tokens synchronized with workspace servers",
      );
    }
  }
}

/**
 * SharedConfigManagerのシングルトンインスタンスを取得
 */
export function getSharedConfigManager(): SharedConfigManager {
  return SharedConfigManager.getInstance();
}
