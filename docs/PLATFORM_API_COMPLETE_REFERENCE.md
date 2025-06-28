# Platform API Complete Reference

このドキュメントは、Platform APIインターフェースのすべてのメソッドを網羅的に記載しています。

## Table of Contents

1. [Authentication](#1-authentication)
2. [MCP Server Management](#2-mcp-server-management)
3. [Logging](#3-logging)
4. [Settings](#4-settings)
5. [MCP Apps](#5-mcp-apps)
6. [Command Utilities](#6-command-utilities)
7. [Agent Management](#7-agent-management)
8. [Agent Deployment](#8-agent-deployment)
9. [Package Management](#9-package-management)
10. [Agent Tools](#10-agent-tools)
11. [Background Chat](#11-background-chat)
12. [Session Management](#12-session-management)
13. [Chat Stream Communication](#13-chat-stream-communication)
14. [Chat Stream Listeners](#14-chat-stream-listeners)
15. [Token Management](#15-token-management)
16. [Feedback](#16-feedback)
17. [Updates](#17-updates)
18. [Protocol Handling](#18-protocol-handling)
19. [Package Manager Utilities](#19-package-manager-utilities)

---

## 1. Authentication

### `login(idp?: string): Promise<boolean>`
ユーザーのログインフローを開始します。

**Parameters:**
- `idp` (optional): Identity Provider の識別子（"github", "google" など）

**Returns:** ログインが成功したかどうか

**Electron Implementation:**
- OAuthフローを開始し、ブラウザを開く
- コールバックURLを処理

**Web Implementation:**
```typescript
async login(idp?: string): Promise<boolean> {
  return true; // 認証なし
}
```

---

### `logout(): Promise<boolean>`
現在のユーザーをログアウトします。

**Returns:** ログアウトが成功したかどうか

**Electron Implementation:**
- ローカルの認証データをクリア
- セッションを無効化

**Web Implementation:**
```typescript
async logout(): Promise<boolean> {
  return true; // 認証なし
}
```

---

### `getAuthStatus(forceRefresh?: boolean): Promise<AuthStatus>`
現在の認証状態を取得します。

**Parameters:**
- `forceRefresh` (optional): キャッシュを無視して最新の状態を取得

**Returns:**
```typescript
interface AuthStatus {
  authenticated: boolean;
  userId?: string;
  user?: any;
  token?: string;
}
```

**Web Implementation:**
```typescript
async getAuthStatus(forceRefresh?: boolean) {
  return {
    authenticated: true,
    userId: "web-user",
    user: { id: "web-user", name: "Web User" },
    token: "dummy-token"
  };
}
```

---

### `handleAuthToken(token: string, state?: string): Promise<boolean>`
OAuthコールバックからのトークンを処理します。

**Parameters:**
- `token`: 認証トークン
- `state` (optional): OAuth state パラメータ

**Returns:** トークンの処理が成功したかどうか

**Web Implementation:**
```typescript
async handleAuthToken(token: string, state?: string): Promise<boolean> {
  return true; // 認証なし
}
```

---

### `onAuthStatusChanged(callback: Function): () => void`
認証状態の変更を監視します。

**Parameters:**
- `callback`: 認証状態が変更されたときに呼ばれる関数
  ```typescript
  (status: {
    loggedIn: boolean;
    userId?: string;
    user?: any;
  }) => void
  ```

**Returns:** イベントリスナーを解除する関数

**Web Implementation:**
```typescript
onAuthStatusChanged(callback: (status: any) => void): () => void {
  return () => {}; // 認証なし
}
```

---

## 2. MCP Server Management

### `listMcpServers(): Promise<any>`
設定されているすべてのMCPサーバーを取得します。

**Returns:** MCPサーバーの配列

**Web Implementation:**
```typescript
async listMcpServers() {
  return this.fetch("/mcp/servers");
}
```

---

### `startMcpServer(id: string): Promise<boolean>`
指定したMCPサーバーを起動します。

**Parameters:**
- `id`: サーバーID

**Returns:** 起動が成功したかどうか

**Electron Implementation:**
- ローカルサーバー: プロセスを spawn
- リモートサーバー: HTTP/SSE 接続を確立

**Web Implementation:**
```typescript
async startMcpServer(id: string): Promise<boolean> {
  const result = await this.fetch(`/mcp/servers/${id}/start`, {
    method: "POST",
  });
  return result.success;
}
```

**Note:** Web版ではリモートサーバーのみサポート

---

### `stopMcpServer(id: string): Promise<boolean>`
指定したMCPサーバーを停止します。

**Parameters:**
- `id`: サーバーID

**Returns:** 停止が成功したかどうか

**Web Implementation:**
```typescript
async stopMcpServer(id: string): Promise<boolean> {
  const result = await this.fetch(`/mcp/servers/${id}/stop`, {
    method: "POST",
  });
  return result.success;
}
```

---

### `addMcpServer(serverConfig: MCPServerConfig): Promise<any>`
新しいMCPサーバーを追加します。

**Parameters:**
```typescript
interface MCPServerConfig {
  id: string;
  name: string;
  env: Record<string, string>;
  setupInstructions?: string;
  autoStart?: boolean;
  disabled?: boolean;
  description?: string;
  serverType: "local" | "remote" | "remote-streamable";
  command?: string;          // ローカルサーバー用
  args?: string[];           // ローカルサーバー用
  remoteUrl?: string;        // リモートサーバー用
  bearerToken?: string;      // リモートサーバー用
  inputParams?: Record<string, { default: string; description: string }>;
  required?: string[];
  latestVersion?: string;
  verificationStatus?: "verified" | "unverified";
  version?: string;
  toolPermissions?: MCPServerToolPermissions;
}
```

**Returns:** 作成されたMCPサーバー

**Web Implementation:**
```typescript
async addMcpServer(serverConfig: MCPServerConfig) {
  return this.fetch("/mcp/servers", {
    method: "POST",
    body: JSON.stringify(serverConfig),
  });
}
```

**Note:** Web版では `serverType: "local"` はサポートされない

---

### `removeMcpServer(id: string): Promise<any>`
MCPサーバーを削除します。

**Parameters:**
- `id`: サーバーID

**Returns:** 削除結果

**Web Implementation:**
```typescript
async removeMcpServer(id: string) {
  return this.fetch(`/mcp/servers/${id}`, {
    method: "DELETE",
  });
}
```

---

### `getMcpServerStatus(id: string): Promise<any>`
MCPサーバーのステータスを取得します。

**Parameters:**
- `id`: サーバーID

**Returns:** サーバーステータス情報

**Web Implementation:**
```typescript
async getMcpServerStatus(id: string) {
  return this.fetch(`/mcp/servers/${id}/status`);
}
```

---

### `updateMcpServerConfig(id: string, config: any): Promise<any>`
MCPサーバーの設定を更新します。

**Parameters:**
- `id`: サーバーID
- `config`: 更新する設定

**Returns:** 更新されたサーバー情報

**Web Implementation:**
```typescript
async updateMcpServerConfig(id: string, config: any) {
  return this.fetch(`/mcp/servers/${id}`, {
    method: "PATCH",
    body: JSON.stringify(config),
  });
}
```

---

### `fetchMcpServersFromIndex(page?, limit?, search?, isVerified?): Promise<any>`
MCPサーバーディレクトリを検索します。

**Parameters:**
- `page` (optional): ページ番号
- `limit` (optional): 1ページあたりの件数
- `search` (optional): 検索キーワード
- `isVerified` (optional): 認証済みサーバーのみ表示

**Returns:** 検索結果

**Web Implementation:**
```typescript
async fetchMcpServersFromIndex(
  page?: number,
  limit?: number,
  search?: string,
  isVerified?: boolean
) {
  const params = new URLSearchParams();
  if (page !== undefined) params.set("page", page.toString());
  if (limit !== undefined) params.set("limit", limit.toString());
  if (search) params.set("search", search);
  if (isVerified !== undefined) params.set("isVerified", isVerified.toString());

  return this.fetch(`/mcp/index?${params}`);
}
```

---

### `fetchMcpServerVersionDetails(displayId: string, version: string): Promise<any>`
特定バージョンの詳細情報を取得します。

**Parameters:**
- `displayId`: サーバーの表示ID
- `version`: バージョン番号

**Returns:** バージョン詳細情報

**Web Implementation:**
```typescript
async fetchMcpServerVersionDetails(displayId: string, version: string) {
  return this.fetch(`/mcp/index/${displayId}/versions/${version}`);
}
```

---

## 3. Logging

### `getRequestLogs(options?): Promise<LogsResponse>`
リクエストログを取得します。

**Parameters:**
```typescript
interface LogOptions {
  clientId?: string;
  serverId?: string;
  requestType?: string;
  startDate?: Date;
  endDate?: Date;
  responseStatus?: "success" | "error";
  offset?: number;
  limit?: number;
}
```

**Returns:**
```typescript
interface LogsResponse {
  logs: any[];
  total: number;
}
```

**Web Implementation:**
```typescript
async getRequestLogs(options?: any) {
  const params = new URLSearchParams();
  if (options) {
    Object.entries(options).forEach(([key, value]) => {
      if (value !== undefined) {
        params.set(key, value.toString());
      }
    });
  }
  return this.fetch(`/mcp/logs?${params}`);
}
```

```

---

## 4. Settings

### `getSettings(): Promise<AppSettings>`
アプリケーション設定を取得します。

**Returns:**
```typescript
interface AppSettings {
  language: string;
  theme: "light" | "dark" | "system";
  autoStart: boolean;
  packageManagerOverlayCount?: number;
}
```

**Web Implementation:**
```typescript
async getSettings(): Promise<AppSettings> {
  return this.fetch("/settings");
}
```

---

### `saveSettings(settings: AppSettings): Promise<boolean>`
アプリケーション設定を保存します。

**Parameters:**
- `settings`: 保存する設定

**Returns:** 保存が成功したかどうか

**Web Implementation:**
```typescript
async saveSettings(settings: AppSettings): Promise<boolean> {
  const result = await this.fetch("/settings", {
    method: "POST",
    body: JSON.stringify(settings),
  });
  return result.success;
}
```

---

### `incrementPackageManagerOverlayCount(): Promise<{success: boolean; count: number}>`
パッケージマネージャーオーバーレイの表示回数をインクリメントします。

**Returns:** 成功フラグと新しいカウント値

**Web Implementation:**
```typescript
async incrementPackageManagerOverlayCount() {
  return { success: true, count: 0 }; // Web版では未実装
}
```

---

## 5. MCP Apps

### `listMcpApps(): Promise<McpApp[]>`
すべてのMCPアプリ設定を取得します。

**Returns:**
```typescript
interface McpApp {
  name: string;
  configPath: string;
  servers: string[];
  tokens?: any[];
}
```

**Web Implementation:**
```typescript
async listMcpApps(): Promise<McpApp[]> {
  return []; // Web版では未実装
}
```

---

### `addMcpAppConfig(appName: string): Promise<McpAppsManagerResult>`
新しいMCPアプリ設定を追加します。

**Parameters:**
- `appName`: アプリケーション名

**Returns:**
```typescript
interface McpAppsManagerResult {
  success: boolean;
  message?: string;
  app?: McpApp;
}
```

**Web Implementation:**
```typescript
async addMcpAppConfig(appName: string): Promise<McpAppsManagerResult> {
  return { success: false, message: "Not implemented in web version" };
}
```

---

### `deleteMcpApp(appName: string): Promise<boolean>`
MCPアプリ設定を削除します。

**Parameters:**
- `appName`: アプリケーション名

**Returns:** 削除が成功したかどうか

**Web Implementation:**
```typescript
async deleteMcpApp(appName: string): Promise<boolean> {
  return false; // Web版では未実装
}
```

---

### `updateAppServerAccess(appName: string, serverIds: string[]): Promise<McpAppsManagerResult>`
アプリケーションのサーバーアクセス権限を更新します。

**Parameters:**
- `appName`: アプリケーション名
- `serverIds`: アクセスを許可するサーバーIDの配列

**Returns:** 更新結果

**Web Implementation:**
```typescript
async updateAppServerAccess(
  appName: string,
  serverIds: string[]
): Promise<McpAppsManagerResult> {
  return { success: false, message: "Not implemented in web version" };
}
```

---

### `unifyAppConfig(appName: string): Promise<McpAppsManagerResult>`
アプリケーション設定を統一します。

**Parameters:**
- `appName`: アプリケーション名

**Returns:** 統一結果

**Web Implementation:**
```typescript
async unifyAppConfig(appName: string): Promise<McpAppsManagerResult> {
  return { success: false, message: "Not implemented in web version" };
}
```

---

## 6. Command Utilities

### `checkCommandExists(command: string): Promise<boolean>`
指定したコマンドがシステムに存在するか確認します。

**Parameters:**
- `command`: チェックするコマンド名

**Returns:** コマンドが存在するかどうか

**Electron Implementation:**
- `which` コマンドまたは同等の方法でチェック

**Web Implementation:**
```typescript
async checkCommandExists(command: string): Promise<boolean> {
  return false; // Web版では利用不可
}
```

---

## 7. Agent Management

### `listAgents(): Promise<Agent[]>`
すべての開発中エージェントを取得します。

**Returns:** エージェントの配列

**Web Implementation:**
```typescript
async listAgents(): Promise<Agent[]> {
  return this.fetch("/agents");
}
```

---

### `getAgent(id: string): Promise<Agent | undefined>`
特定のエージェントを取得します。

**Parameters:**
- `id`: エージェントID

**Returns:** エージェント情報またはundefined

**Web Implementation:**
```typescript
async getAgent(id: string): Promise<Agent | undefined> {
  return this.fetch(`/agents/${id}`);
}
```

---

### `createAgent(agentConfig: Omit<AgentConfig, "id">): Promise<Agent>`
新しいエージェントを作成します。

**Parameters:**
```typescript
interface AgentConfig {
  name: string;
  description?: string;
  systemPrompt?: string;
  model: string;
  temperature?: number;
  maxTokens?: number;
  autoExecuteTool?: boolean;
  enabledServers: string[];
  customInstructions?: string;
}
```

**Returns:** 作成されたエージェント

**Web Implementation:**
```typescript
async createAgent(agentConfig: Omit<AgentConfig, "id">): Promise<Agent> {
  return this.fetch("/agents", {
    method: "POST",
    body: JSON.stringify(agentConfig),
  });
}
```

---

### `updateAgent(id: string, config: Partial<AgentConfig>): Promise<Agent | undefined>`
エージェントを更新します。

**Parameters:**
- `id`: エージェントID
- `config`: 更新する設定

**Returns:** 更新されたエージェントまたはundefined

**Web Implementation:**
```typescript
async updateAgent(
  id: string,
  config: Partial<AgentConfig>
): Promise<Agent | undefined> {
  return this.fetch(`/agents/${id}`, {
    method: "PATCH",
    body: JSON.stringify(config),
  });
}
```

---

### `deleteAgent(id: string): Promise<boolean>`
エージェントを削除します。

**Parameters:**
- `id`: エージェントID

**Returns:** 削除が成功したかどうか

**Web Implementation:**
```typescript
async deleteAgent(id: string): Promise<boolean> {
  const result = await this.fetch(`/agents/${id}`, {
    method: "DELETE",
  });
  return result.success;
}
```

---

### `shareAgent(id: string): Promise<string>`
エージェントの共有コードを生成します。

**Parameters:**
- `id`: エージェントID

**Returns:** 共有コード

**Web Implementation:**
```typescript
async shareAgent(id: string): Promise<string> {
  const result = await this.fetch(`/agents/${id}/share`, {
    method: "POST",
  });
  return result.shareCode;
}
```

---

### `importAgent(shareCode: string): Promise<DeployedAgent | undefined>`
共有コードからエージェントをインポートします。

**Parameters:**
- `shareCode`: 共有コード

**Returns:** インポートされたエージェントまたはundefined

**Web Implementation:**
```typescript
async importAgent(shareCode: string): Promise<DeployedAgent | undefined> {
  return this.fetch("/agents/import", {
    method: "POST",
    body: JSON.stringify({ shareCode }),
  });
}
```


---

## 8. Agent Deployment

### `deployAgent(id: string): Promise<DeployedAgent | undefined>`
開発中のエージェントをデプロイします。

**Parameters:**
- `id`: エージェントID

**Returns:** デプロイされたエージェントまたはundefined

**Web Implementation:**
```typescript
async deployAgent(id: string): Promise<DeployedAgent | undefined> {
  return this.fetch(`/agents/${id}/deploy`, {
    method: "POST",
  });
}
```

---

### `getDeployedAgents(): Promise<DeployedAgent[] | undefined>`
すべてのデプロイ済みエージェントを取得します。

**Returns:** デプロイ済みエージェントの配列またはundefined

**Web Implementation:**
```typescript
async getDeployedAgents(): Promise<DeployedAgent[] | undefined> {
  return this.fetch("/agents/deployed");
}
```


---

### `updateDeployedAgent(id: string, config: any): Promise<DeployedAgent | undefined>`
デプロイ済みエージェントを更新します。

**Parameters:**
- `id`: エージェントID
- `config`: 更新する設定

**Returns:** 更新されたエージェントまたはundefined

**Web Implementation:**
```typescript
async updateDeployedAgent(
  id: string,
  config: any
): Promise<DeployedAgent | undefined> {
  return this.fetch(`/agents/deployed/${id}`, {
    method: "PATCH",
    body: JSON.stringify(config),
  });
}
```

---

### `deleteDeployedAgent(id: string): Promise<boolean>`
デプロイ済みエージェントを削除します。

**Parameters:**
- `id`: エージェントID

**Returns:** 削除が成功したかどうか

**Web Implementation:**
```typescript
async deleteDeployedAgent(id: string): Promise<boolean> {
  const result = await this.fetch(`/agents/deployed/${id}`, {
    method: "DELETE",
  });
  return result.success;
}
```

---

## 9. Package Management

### `resolvePackageVersionsInArgs(argsString: string, packageManager: "pnpm" | "uvx"): Promise<Result>`
パッケージバージョンを解決します。

**Parameters:**
- `argsString`: パッケージ引数文字列
- `packageManager`: パッケージマネージャー

**Returns:**
```typescript
interface Result {
  success: boolean;
  resolvedArgs?: string;
  error?: string;
}
```

**Electron Implementation:**
- 実際にパッケージマネージャーを実行してバージョンを解決

**Web Implementation:**
```typescript
async resolvePackageVersionsInArgs(
  argsString: string,
  packageManager: "pnpm" | "uvx"
) {
  return { success: false, error: "Not available in web version" };
}
```

---

### `checkMcpServerPackageUpdates(args: string[], packageManager: "pnpm" | "uvx"): Promise<Result>`
MCPサーバーパッケージの更新を確認します。

**Parameters:**
- `args`: パッケージ引数の配列
- `packageManager`: パッケージマネージャー

**Returns:**
```typescript
interface Result {
  success: boolean;
  updates?: ServerPackageUpdates;
}
```

**Web Implementation:**
```typescript
async checkMcpServerPackageUpdates(
  args: string[],
  packageManager: "pnpm" | "uvx"
) {
  return { success: false }; // Web版では利用不可
}
```

---

## 10. Agent Tools

### `getAgentMCPServerTools(agentId: string, serverId: string, isDev?: boolean): Promise<Result>`
エージェントが利用可能なMCPサーバーツールを取得します。

**Parameters:**
- `agentId`: エージェントID
- `serverId`: サーバーID
- `isDev` (optional): 開発モードかどうか

**Returns:**
```typescript
interface Result {
  success: boolean;
  tools: any[];
  error?: string;
}
```

**Web Implementation:**
```typescript
async getAgentMCPServerTools(
  agentId: string,
  serverId: string,
  isDev?: boolean
) {
  const params = new URLSearchParams();
  if (isDev !== undefined) params.set("isDev", isDev.toString());
  
  return this.fetch(`/agents/${agentId}/servers/${serverId}/tools?${params}`);
}
```

---

### `executeAgentTool(agentId: string, toolName: string, args: Record<string, any>): Promise<Result>`
エージェントツールを実行します。

**Parameters:**
- `agentId`: エージェントID
- `toolName`: ツール名
- `args`: ツール引数

**Returns:**
```typescript
interface Result {
  success: boolean;
  result?: any;
  error?: string;
}
```

**Web Implementation:**
```typescript
async executeAgentTool(
  agentId: string,
  toolName: string,
  args: Record<string, any>
) {
  return this.fetch(`/agents/${agentId}/tools/execute`, {
    method: "POST",
    body: JSON.stringify({ toolName, args }),
  });
}
```

---

## 11. Background Chat

### `startBackgroundChat(sessionId: string | undefined, agentId: string, query: string): Promise<Result>`
バックグラウンドでチャットを開始します。

**Parameters:**
- `sessionId` (optional): セッションID
- `agentId`: エージェントID
- `query`: クエリ文字列

**Returns:**
```typescript
interface Result {
  success: boolean;
  error?: string;
}
```

**Electron Implementation:**
- バックグラウンドプロセスでチャットを実行

**Web Implementation:**
```typescript
async startBackgroundChat(
  sessionId: string | undefined,
  agentId: string,
  query: string
) {
  return { success: true }; // SSEで実装予定
}
```

---

### `stopBackgroundChat(agentId: string): Promise<Result>`
実行中のバックグラウンドチャットを停止します。

**Parameters:**
- `agentId`: エージェントID

**Returns:**
```typescript
interface Result {
  success: boolean;
  error?: string;
}
```

**Web Implementation:**
```typescript
async stopBackgroundChat(agentId: string) {
  return { success: true }; // SSE接続を閉じる
}
```

---

### `onBackgroundChatStart(callback: (data: any) => void): () => void`
バックグラウンドチャット開始イベントを監視します。

**Parameters:**
- `callback`: イベント発生時のコールバック

**Returns:** イベントリスナーを解除する関数

**Web Implementation:**
```typescript
onBackgroundChatStart(callback: (data: any) => void): () => void {
  // SSEリスナーを実装
  return () => {};
}
```

---

### `onBackgroundChatStop(callback: (data: any) => void): () => void`
バックグラウンドチャット停止イベントを監視します。

**Parameters:**
- `callback`: イベント発生時のコールバック

**Returns:** イベントリスナーを解除する関数

**Web Implementation:**
```typescript
onBackgroundChatStop(callback: (data: any) => void): () => void {
  // SSEリスナーを実装
  return () => {};
}
```

---

## 12. Session Management

### `fetchSessionMessages(sessionId: string): Promise<any[]>`
セッションのメッセージを取得します。

**Parameters:**
- `sessionId`: セッションID

**Returns:** メッセージの配列

**Web Implementation:**
```typescript
async fetchSessionMessages(sessionId: string) {
  return this.fetch(`/agents/sessions/${sessionId}/messages`);
}
```

---

### `getSessions(agentId: string, options?: any): Promise<SessionsResponse>`
エージェントのセッション一覧を取得します。

**Parameters:**
- `agentId`: エージェントID
- `options` (optional): ページネーションオプションなど

**Returns:**
```typescript
interface SessionsResponse {
  sessions: any[];
  hasMore: boolean;
  nextCursor?: string;
}
```

**Web Implementation:**
```typescript
async getSessions(agentId: string, options?: any) {
  const params = new URLSearchParams();
  if (options) {
    Object.entries(options).forEach(([key, value]) => {
      if (value !== undefined) {
        params.set(key, value.toString());
      }
    });
  }
  return this.fetch(`/agents/${agentId}/sessions?${params}`);
}
```

---

### `createSession(agentId: string, initialMessages?: any[]): Promise<any>`
新しいセッションを作成します。

**Parameters:**
- `agentId`: エージェントID
- `initialMessages` (optional): 初期メッセージ

**Returns:** 作成されたセッション

**Web Implementation:**
```typescript
async createSession(agentId: string, initialMessages?: any[]) {
  return this.fetch(`/agents/${agentId}/sessions`, {
    method: "POST",
    body: JSON.stringify({ initialMessages }),
  });
}
```

---

### `updateSessionMessages(sessionId: string, messages: any[]): Promise<any>`
セッションのメッセージを更新します。

**Parameters:**
- `sessionId`: セッションID
- `messages`: 更新するメッセージ

**Returns:** 更新結果

**Web Implementation:**
```typescript
async updateSessionMessages(sessionId: string, messages: any[]) {
  return this.fetch(`/agents/sessions/${sessionId}/messages`, {
    method: "PUT",
    body: JSON.stringify({ messages }),
  });
}
```

---

### `deleteSession(sessionId: string): Promise<boolean>`
セッションを削除します。

**Parameters:**
- `sessionId`: セッションID

**Returns:** 削除が成功したかどうか

**Web Implementation:**
```typescript
async deleteSession(sessionId: string): Promise<boolean> {
  const result = await this.fetch(`/agents/sessions/${sessionId}`, {
    method: "DELETE",
  });
  return result.success;
}
```

---

## 13. Chat Stream Communication

### `sendChatStreamStart(streamData: any): Promise<Result>`
チャットストリームを開始します。

**Parameters:**
- `streamData`: ストリーム開始データ

**Returns:**
```typescript
interface Result {
  success: boolean;
  error?: string;
}
```

**Electron Implementation:**
- IPCでレンダラープロセスに通知

**Web Implementation:**
```typescript
async sendChatStreamStart(streamData: any) {
  return { success: true }; // fetch with streaming
}
```

---

### `sendChatStreamChunk(chunkData: any): Promise<Result>`
チャットストリームのチャンクを送信します。

**Parameters:**
- `chunkData`: チャンクデータ

**Returns:**
```typescript
interface Result {
  success: boolean;
  error?: string;
}
```

**Web Implementation:**
```typescript
async sendChatStreamChunk(chunkData: any) {
  return { success: true }; // stream chunk
}
```

---

### `sendChatStreamEnd(endData: any): Promise<Result>`
チャットストリームを終了します。

**Parameters:**
- `endData`: 終了データ

**Returns:**
```typescript
interface Result {
  success: boolean;
  error?: string;
}
```

**Web Implementation:**
```typescript
async sendChatStreamEnd(endData: any) {
  return { success: true }; // end stream
}
```

---

### `sendChatStreamError(errorData: any): Promise<Result>`
チャットストリームのエラーを送信します。

**Parameters:**
- `errorData`: エラーデータ

**Returns:**
```typescript
interface Result {
  success: boolean;
  error?: string;
}
```

**Web Implementation:**
```typescript
async sendChatStreamError(errorData: any) {
  return { success: true }; // send error
}
```

---

## 14. Chat Stream Listeners

### `onChatStreamStart(callback: (data: any) => void): () => void`
チャットストリーム開始イベントを監視します。

**Parameters:**
- `callback`: イベント発生時のコールバック

**Returns:** イベントリスナーを解除する関数

**Web Implementation:**
```typescript
onChatStreamStart(callback: (data: any) => void): () => void {
  // SSEリスナーを実装
  return () => {};
}
```

---

### `onChatStreamChunk(callback: (data: any) => void): () => void`
チャットストリームチャンクイベントを監視します。

**Parameters:**
- `callback`: イベント発生時のコールバック

**Returns:** イベントリスナーを解除する関数

**Web Implementation:**
```typescript
onChatStreamChunk(callback: (data: any) => void): () => void {
  // SSEリスナーを実装
  return () => {};
}
```

---

### `onChatStreamEnd(callback: (data: any) => void): () => void`
チャットストリーム終了イベントを監視します。

**Parameters:**
- `callback`: イベント発生時のコールバック

**Returns:** イベントリスナーを解除する関数

**Web Implementation:**
```typescript
onChatStreamEnd(callback: (data: any) => void): () => void {
  // SSEリスナーを実装
  return () => {};
}
```

---

### `onChatStreamError(callback: (data: any) => void): () => void`
チャットストリームエラーイベントを監視します。

**Parameters:**
- `callback`: イベント発生時のコールバック

**Returns:** イベントリスナーを解除する関数

**Web Implementation:**
```typescript
onChatStreamError(callback: (data: any) => void): () => void {
  // SSEリスナーを実装
  return () => {};
}
```

---

## 15. Token Management

### `updateTokenScopes(tokenId: string, scopes: TokenScope[]): Promise<McpAppsManagerResult>`
トークンのスコープを更新します。

**Parameters:**
- `tokenId`: トークンID
- `scopes`: スコープの配列

**Returns:**
```typescript
interface McpAppsManagerResult {
  success: boolean;
  message?: string;
  app?: McpApp;
}
```

**Web Implementation:**
```typescript
async updateTokenScopes(
  tokenId: string,
  scopes: TokenScope[]
): Promise<McpAppsManagerResult> {
  return { success: false, message: "Not implemented in web version" };
}
```

---

## 16. Feedback

### `submitFeedback(feedback: string): Promise<boolean>`
ユーザーフィードバックを送信します。

**Parameters:**
- `feedback`: フィードバック内容

**Returns:** 送信が成功したかどうか

**Web Implementation:**
```typescript
async submitFeedback(feedback: string): Promise<boolean> {
  const result = await this.fetch("/feedback", {
    method: "POST",
    body: JSON.stringify({ feedback }),
  });
  return result.success;
}
```

---

## 17. Updates

### `checkForUpdates(): Promise<{updateAvailable: boolean}>`
アプリケーションの更新を確認します。

**Returns:** 更新が利用可能かどうか

**Electron Implementation:**
- Electron autoUpdaterを使用

**Web Implementation:**
```typescript
async checkForUpdates() {
  return { updateAvailable: false }; // Web版では不要
}
```

---

### `installUpdate(): Promise<boolean>`
利用可能な更新をインストールします。

**Returns:** インストールが成功したかどうか

**Web Implementation:**
```typescript
async installUpdate(): Promise<boolean> {
  return false; // Web版では不要
}
```

---

### `onUpdateAvailable(callback: (available: boolean) => void): () => void`
更新利用可能イベントを監視します。

**Parameters:**
- `callback`: 更新が利用可能になったときのコールバック

**Returns:** イベントリスナーを解除する関数

**Web Implementation:**
```typescript
onUpdateAvailable(callback: (available: boolean) => void): () => void {
  return () => {}; // Web版では不要
}
```

---

## 18. Protocol Handling

### `onProtocolUrl(callback: (url: string) => void): () => void`
プロトコルURL（ディープリンク）を監視します。

**Parameters:**
- `callback`: URLを受信したときのコールバック

**Returns:** イベントリスナーを解除する関数

**Electron Implementation:**
- `mcp-router://` URLを処理

**Web Implementation:**
```typescript
onProtocolUrl(callback: (url: string) => void): () => void {
  return () => {}; // Web版では不要
}
```

---

## 19. Package Manager Utilities

### `checkPackageManagers(): Promise<PackageManagerStatus>`
インストールされているパッケージマネージャーを確認します。

**Returns:**
```typescript
interface PackageManagerStatus {
  node: boolean;
  pnpm: boolean;
  uv: boolean;
}
```

**Electron Implementation:**
- システムコマンドをチェック

**Web Implementation:**
```typescript
async checkPackageManagers() {
  return { node: false, pnpm: false, uv: false }; // Web版では利用不可
}
```

---

### `installPackageManagers(): Promise<InstallResult>`
不足しているパッケージマネージャーをインストールします。

**Returns:**
```typescript
interface InstallResult {
  success: boolean;
  installed: { node: boolean; pnpm: boolean; uv: boolean };
  errors?: { node?: string; pnpm?: string; uv?: string };
}
```

**Web Implementation:**
```typescript
async installPackageManagers() {
  return {
    success: false,
    installed: { node: false, pnpm: false, uv: false },
    errors: { node: "Not available in web version" },
  };
}
```

---

### `restartApp(): Promise<boolean>`
アプリケーションを再起動します。

**Returns:** 再起動が成功したかどうか

**Electron Implementation:**
- `app.relaunch()` を使用

**Web Implementation:**
```typescript
async restartApp(): Promise<boolean> {
  window.location.reload(); // ページをリロード
  return true;
}
```

---

## Summary

Platform APIは、MCP Routerのフロントエンドとバックエンドを接続する重要な抽象化レイヤーです。このAPIにより：

1. **プラットフォーム独立性**: 同じフロントエンドコードがElectronとWebで動作
2. **明確な責任分離**: UIロジックとプラットフォーム固有の実装を分離
3. **拡張性**: 新しいプラットフォーム（モバイルなど）への対応が容易

Web版実装時の主な制限：
- ローカルプロセス管理機能なし
- パッケージマネージャー操作なし
- システムレベルの機能（更新、プロトコルハンドリング）なし
- 初期実装では認証機能なし

これらの制限を理解した上で、適切なフォールバック処理とユーザー体験の設計が重要です。