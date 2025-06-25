# Platform API Reference

Platform APIは、MCP Routerのフロントエンドとバックエンドをつなぐ抽象化レイヤーです。これにより、同じフロントエンドコードがElectronとWebの両方のプラットフォームで動作します。

## Architecture Overview

```typescript
// Electron環境
import { electronPlatformAPI } from "@/frontend/lib/electron-platform-api";
const useServerStore = createServerStore(electronPlatformAPI);

// Web環境
import { webPlatformAPI } from "@/lib/platform-api/web-platform-api";
const useServerStore = createServerStore(webPlatformAPI);
```

## API Categories

### 1. Authentication & Authorization

#### Core Methods

##### `login(idp?: string): Promise<boolean>`
ユーザーのログインフローを開始します。
- **Parameters**: 
  - `idp` (optional): Identity Provider ("github" | "google" など)
- **Returns**: ログイン成功/失敗
- **Web Implementation**: 認証不要のため常に`true`を返す

##### `logout(): Promise<boolean>`
ユーザーをログアウトします。
- **Returns**: ログアウト成功/失敗
- **Web Implementation**: 認証不要のため常に`true`を返す

##### `getAuthStatus(forceRefresh?: boolean): Promise<AuthStatus>`
現在の認証状態を取得します。
```typescript
interface AuthStatus {
  authenticated: boolean;
  userId?: string;
  user?: any;
  token?: string;
}
```
- **Web Implementation**: ダミーの認証済みユーザーを返す

##### `checkActivation(): Promise<boolean>`
アプリケーションのアクティベーション状態を確認します。
- **Web Implementation**: 常に`true`（アクティベーション不要）

##### `submitInvitationCode(code: string): Promise<boolean>`
招待コードを送信してアプリをアクティベートします。
- **Web Implementation**: 常に`true`（アクティベーション不要）

#### Event Listeners

##### `onAuthStatusChanged(callback: (status) => void): () => void`
認証状態の変更を監視します。
- **Returns**: アンサブスクライブ関数
- **Web Implementation**: 空の関数を返す（認証なし）

### 2. MCP Server Management

#### Core Methods

##### `listMcpServers(): Promise<MCPServer[]>`
設定されているすべてのMCPサーバーを取得します。
- **Web Implementation**: GET `/api/mcp/servers`

##### `startMcpServer(id: string): Promise<boolean>`
指定したMCPサーバーを起動します。
- **Parameters**: サーバーID
- **Web Implementation**: POST `/api/mcp/servers/{id}/start`
- **Note**: Web版ではリモートサーバーのみサポート

##### `stopMcpServer(id: string): Promise<boolean>`
指定したMCPサーバーを停止します。
- **Web Implementation**: POST `/api/mcp/servers/{id}/stop`

##### `addMcpServer(serverConfig: MCPServerConfig): Promise<MCPServer>`
新しいMCPサーバーを追加します。
```typescript
interface MCPServerConfig {
  id: string;
  name: string;
  env: Record<string, string>;
  serverType: "local" | "remote" | "remote-streamable";
  // リモートサーバー用
  remoteUrl?: string;
  bearerToken?: string;
  // ローカルサーバー用（Web版では使用不可）
  command?: string;
  args?: string[];
}
```
- **Web Implementation**: POST `/api/mcp/servers`
- **Web Limitations**: `serverType: "local"`はサポートされない

##### `removeMcpServer(id: string): Promise<boolean>`
MCPサーバーを削除します。
- **Web Implementation**: DELETE `/api/mcp/servers/{id}`

##### `updateMcpServerConfig(id: string, config: any): Promise<MCPServer>`
MCPサーバーの設定を更新します。
- **Web Implementation**: PATCH `/api/mcp/servers/{id}`

#### Discovery Methods

##### `fetchMcpServersFromIndex(page?, limit?, search?, isVerified?): Promise<any>`
MCPサーバーディレクトリを検索します。
- **Web Implementation**: GET `/api/mcp/index` with query params

##### `fetchMcpServerVersionDetails(displayId: string, version: string): Promise<any>`
特定バージョンの詳細を取得します。
- **Web Implementation**: GET `/api/mcp/index/{displayId}/versions/{version}`

### 3. Agent Management

#### Core Methods

##### `listAgents(): Promise<Agent[]>`
すべての開発中エージェントを取得します。
- **Web Implementation**: GET `/api/agents`

##### `getAgent(id: string): Promise<Agent | undefined>`
特定のエージェントの詳細を取得します。
- **Web Implementation**: GET `/api/agents/{id}`

##### `createAgent(agentConfig: Omit<AgentConfig, "id">): Promise<Agent>`
新しいエージェントを作成します。
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
}
```
- **Web Implementation**: POST `/api/agents`

##### `updateAgent(id: string, config: Partial<AgentConfig>): Promise<Agent>`
エージェントの設定を更新します。
- **Web Implementation**: PATCH `/api/agents/{id}`

##### `deleteAgent(id: string): Promise<boolean>`
エージェントを削除します。
- **Web Implementation**: DELETE `/api/agents/{id}`

#### Deployment Methods

##### `deployAgent(id: string): Promise<DeployedAgent>`
開発中のエージェントをデプロイします。
- **Web Implementation**: POST `/api/agents/{id}/deploy`

##### `getDeployedAgents(): Promise<DeployedAgent[]>`
すべてのデプロイ済みエージェントを取得します。
- **Web Implementation**: GET `/api/agents/deployed`

#### Sharing Methods

##### `shareAgent(id: string): Promise<string>`
エージェントの共有コードを生成します。
- **Web Implementation**: POST `/api/agents/{id}/share`

##### `importAgent(shareCode: string): Promise<DeployedAgent>`
共有コードからエージェントをインポートします。
- **Web Implementation**: POST `/api/agents/import`

### 4. Chat & Sessions

#### Session Management

##### `getSessions(agentId: string, options?): Promise<SessionsResponse>`
エージェントのチャットセッションを取得します。
```typescript
interface SessionsResponse {
  sessions: ChatSession[];
  hasMore: boolean;
  nextCursor?: string;
}
```
- **Web Implementation**: GET `/api/agents/{agentId}/sessions`

##### `createSession(agentId: string, initialMessages?): Promise<ChatSession>`
新しいチャットセッションを作成します。
- **Web Implementation**: POST `/api/agents/{agentId}/sessions`

##### `fetchSessionMessages(sessionId: string): Promise<Message[]>`
セッションのメッセージを取得します。
- **Web Implementation**: GET `/api/agents/sessions/{sessionId}/messages`

##### `updateSessionMessages(sessionId: string, messages: Message[]): Promise<void>`
セッションのメッセージを更新します。
- **Web Implementation**: PUT `/api/agents/sessions/{sessionId}/messages`

#### Background Chat

##### `startBackgroundChat(sessionId, agentId, query): Promise<{success: boolean}>`
バックグラウンドでチャットを開始します。
- **Web Implementation**: Server-Sent Events (SSE)を使用

##### `stopBackgroundChat(agentId: string): Promise<{success: boolean}>`
実行中のチャットを停止します。
- **Web Implementation**: SSE接続を閉じる

### 5. Settings & Configuration

##### `getSettings(): Promise<AppSettings>`
アプリケーション設定を取得します。
```typescript
interface AppSettings {
  language: string;
  theme: "light" | "dark" | "system";
  autoStart: boolean;
  packageManagerOverlayCount?: number;
}
```
- **Web Implementation**: GET `/api/settings`

##### `saveSettings(settings: AppSettings): Promise<boolean>`
アプリケーション設定を保存します。
- **Web Implementation**: POST `/api/settings`

### 6. Logging & Analytics

##### `getRequestLogs(options?): Promise<LogsResponse>`
リクエストログを取得します。
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
- **Web Implementation**: GET `/api/mcp/logs` with query params

## Implementation Guidelines

### Web版の制限事項

1. **ローカルプロセス管理なし**
   - `serverType: "local"`のMCPサーバーはサポートされない
   - リモートサーバー（HTTP/SSE）のみ対応

2. **認証なし（初期実装）**
   - すべての認証関連APIはダミー実装
   - 将来的に追加可能な設計

3. **パッケージマネージャー操作なし**
   - `checkPackageManagers`、`installPackageManagers`は利用不可
   - `resolvePackageVersionsInArgs`、`checkMcpServerPackageUpdates`は利用不可

4. **アップデート機能なし**
   - `checkForUpdates`、`installUpdate`は利用不可

5. **プロトコルハンドリングなし**
   - `onProtocolUrl`は利用不可（ディープリンクなし）

### エラーハンドリング

すべてのAPIメソッドは以下のパターンでエラーを処理します：

```typescript
try {
  const response = await fetch(`${baseUrl}/api/endpoint`);
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || response.statusText);
  }
  return response.json();
} catch (error) {
  console.error('API Error:', error);
  throw error;
}
```

### リアルタイム通信

Web版では以下の方法でリアルタイム通信を実装：

1. **Server-Sent Events (SSE)**
   - チャットストリーミング
   - バックグラウンドチャット更新

2. **Polling（必要に応じて）**
   - サーバーステータス更新
   - ログの自動更新

## Migration Guide

### Electron → Web

1. **Platform API インスタンスの変更**
```typescript
// Before (Electron)
import { electronPlatformAPI } from "@/frontend/lib/electron-platform-api";

// After (Web)
import { webPlatformAPI } from "@/lib/platform-api/web-platform-api";
```

2. **ローカルサーバーの除外**
```typescript
// Web版ではリモートサーバーのみ表示
const remoteServers = servers.filter(s => s.serverType !== 'local');
```

3. **認証チェックの省略**
```typescript
// Web版では認証不要
const isAuthenticated = true; // 常にtrue
```

## Future Enhancements

1. **認証システムの追加**
   - OAuth2.0 (GitHub, Google)
   - JWTトークン管理
   - セッション管理

2. **WebSocket対応**
   - リアルタイムログストリーミング
   - サーバーステータスの即時更新

3. **プログレッシブWebアプリ（PWA）**
   - オフライン対応
   - プッシュ通知

4. **マルチテナント対応**
   - ユーザーごとのデータ分離
   - 組織管理機能