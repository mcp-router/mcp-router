# Platform API 改善ポイント

このドキュメントでは、現在のPlatform APIの問題点と改善提案をまとめています。

## 1. 型定義の改善

### 現状の問題点

#### 1.1 `any`型の多用
多くのメソッドが`any`型を返しており、型安全性が損なわれています。

```typescript
// 現在の定義
listMcpServers: () => Promise<any>;
getMcpServerStatus: (id: string) => Promise<any>;
getServers: () => Promise<any>;
```

#### 改善案
```typescript
// 改善後
listMcpServers: () => Promise<MCPServer[]>;
getMcpServerStatus: (id: string) => Promise<MCPServerStatus>;
getServers: () => Promise<Server[]>;

interface MCPServerStatus {
  id: string;
  status: "running" | "starting" | "stopping" | "stopped" | "error";
  connectedAt?: Date;
  error?: string;
  capabilities?: {
    tools: boolean;
    resources: boolean;
    prompts: boolean;
  };
}
```

#### 1.2 曖昧な戻り値の型
```typescript
// 現在
updateAgent: (id: string, config: Partial<AgentConfig>) => Promise<Agent | undefined>;
```

#### 改善案
```typescript
// 改善後 - Result型を使用
updateAgent: (id: string, config: Partial<AgentConfig>) => Promise<Result<Agent>>;

interface Result<T> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
  };
}
```

### 1.3 ジェネリックな設定型
```typescript
// 現在
updateMcpServerConfig: (id: string, config: any) => Promise<any>;
```

#### 改善案
```typescript
// 改善後
updateMcpServerConfig: (id: string, config: Partial<MCPServerConfig>) => Promise<MCPServer>;
```

## 2. エラーハンドリングの統一

### 現状の問題点

エラーハンドリングが統一されておらず、メソッドによって異なる形式を返しています。

```typescript
// パターン1: boolean を返す
startMcpServer: (id: string) => Promise<boolean>;

// パターン2: オブジェクトに success フラグを含める
executeAgentTool: (agentId: string, toolName: string, args: Record<string, any>) 
  => Promise<{ success: boolean; result?: any; error?: string }>;

// パターン3: undefined を返す可能性
getAgent: (id: string) => Promise<Agent | undefined>;
```

### 改善案

統一されたResult型を使用：

```typescript
type Result<T> = 
  | { success: true; data: T }
  | { success: false; error: APIError };

interface APIError {
  code: ErrorCode;
  message: string;
  details?: any;
}

enum ErrorCode {
  NOT_FOUND = "NOT_FOUND",
  UNAUTHORIZED = "UNAUTHORIZED",
  VALIDATION_ERROR = "VALIDATION_ERROR",
  SERVER_ERROR = "SERVER_ERROR",
  NETWORK_ERROR = "NETWORK_ERROR",
  TIMEOUT = "TIMEOUT",
  CONFLICT = "CONFLICT",
  RATE_LIMIT = "RATE_LIMIT",
}

// 使用例
startMcpServer: (id: string) => Promise<Result<void>>;
getAgent: (id: string) => Promise<Result<Agent>>;
executeAgentTool: (agentId: string, toolName: string, args: Record<string, any>) 
  => Promise<Result<ToolExecutionResult>>;
```

## 3. API の整理と統合

### 現状の問題点

#### 3.1 重複したメソッド
```typescript
listMcpServers: () => Promise<any>;
getServers: () => Promise<any>; // listMcpServersのエイリアス
```

#### 改善案
エイリアスメソッドを削除し、一つに統一。

#### 3.2 不明確な責任分担
```typescript
// Agent関連のメソッドが分散
listAgents: () => Promise<Agent[]>;
getDeployedAgents: () => Promise<DeployedAgent[]>;
// Session管理も別カテゴリに
getSessions: (agentId: string, options?: any) => Promise<...>;
```

#### 改善案
関連するメソッドをネームスペースでグループ化：

```typescript
interface PlatformAPI {
  auth: AuthAPI;
  servers: ServerAPI;
  agents: AgentAPI;
  sessions: SessionAPI;
  settings: SettingsAPI;
  system: SystemAPI;
}

interface AgentAPI {
  // 開発用エージェント
  dev: {
    list: () => Promise<Result<Agent[]>>;
    get: (id: string) => Promise<Result<Agent>>;
    create: (config: CreateAgentConfig) => Promise<Result<Agent>>;
    update: (id: string, config: UpdateAgentConfig) => Promise<Result<Agent>>;
    delete: (id: string) => Promise<Result<void>>;
    deploy: (id: string) => Promise<Result<DeployedAgent>>;
  };
  
  // デプロイ済みエージェント
  deployed: {
    list: () => Promise<Result<DeployedAgent[]>>;
    get: (id: string) => Promise<Result<DeployedAgent>>;
    update: (id: string, config: UpdateDeployedAgentConfig) => Promise<Result<DeployedAgent>>;
    delete: (id: string) => Promise<Result<void>>;
  };
  
  // 共有機能
  sharing: {
    export: (id: string) => Promise<Result<string>>;
    import: (shareCode: string) => Promise<Result<DeployedAgent>>;
  };
  
  // ツール実行
  tools: {
    list: (agentId: string, serverId: string) => Promise<Result<Tool[]>>;
    execute: (agentId: string, toolName: string, args: any) => Promise<Result<ToolResult>>;
  };
}
```

## 4. イベントシステムの改善

### 現状の問題点

イベントリスナーの型が不明確で、管理が困難：

```typescript
onAuthStatusChanged: (callback: (status: {
  loggedIn: boolean;
  userId?: string;
  user?: any;
}) => void) => () => void;
```

### 改善案

型付きイベントエミッターパターン：

```typescript
interface PlatformEvents {
  "auth:changed": AuthStatus;
  "server:status": { serverId: string; status: ServerStatus };
  "chat:stream:start": ChatStreamStartEvent;
  "chat:stream:chunk": ChatStreamChunkEvent;
  "chat:stream:end": ChatStreamEndEvent;
  "chat:stream:error": ChatStreamErrorEvent;
  "update:available": { version: string; releaseNotes: string };
}

interface EventAPI {
  on<K extends keyof PlatformEvents>(
    event: K,
    handler: (data: PlatformEvents[K]) => void
  ): () => void;
  
  once<K extends keyof PlatformEvents>(
    event: K,
    handler: (data: PlatformEvents[K]) => void
  ): void;
  
  off<K extends keyof PlatformEvents>(
    event: K,
    handler: (data: PlatformEvents[K]) => void
  ): void;
}
```

## 5. 非同期操作の改善

### 現状の問題点

長時間実行される操作（デプロイ、パッケージインストールなど）の進捗状況が不明：

```typescript
deployAgent: (id: string) => Promise<DeployedAgent | undefined>;
installPackageManagers: () => Promise<{ success: boolean; ... }>;
```

### 改善案

進捗状況を追跡できるJob APIの導入：

```typescript
interface Job<T> {
  id: string;
  status: "pending" | "running" | "completed" | "failed" | "cancelled";
  progress?: {
    current: number;
    total: number;
    message?: string;
  };
  result?: T;
  error?: APIError;
  createdAt: Date;
  updatedAt: Date;
}

interface JobAPI {
  // ジョブを開始して、ジョブIDを返す
  deployAgent: (id: string) => Promise<Result<string>>;
  
  // ジョブの状態を取得
  getJob: <T>(jobId: string) => Promise<Result<Job<T>>>;
  
  // ジョブをキャンセル
  cancelJob: (jobId: string) => Promise<Result<void>>;
  
  // ジョブの進捗を監視
  watchJob: <T>(jobId: string, callback: (job: Job<T>) => void) => () => void;
}
```

## 6. プラットフォーム機能の明確化

### 現状の問題点

Web版で利用できない機能が実行時まで分からない：

```typescript
checkCommandExists: (command: string) => Promise<boolean>;
// Web版では常にfalseを返す
```

### 改善案

プラットフォーム機能を明確に分離：

```typescript
interface PlatformCapabilities {
  localProcesses: boolean;
  fileSystem: boolean;
  packageManagers: boolean;
  systemNotifications: boolean;
  deepLinks: boolean;
  autoUpdate: boolean;
}

interface PlatformAPI {
  // プラットフォームの機能を取得
  getCapabilities: () => PlatformCapabilities;
  
  // 条件付きAPI（Electronのみ）
  electron?: {
    checkCommandExists: (command: string) => Promise<Result<boolean>>;
    installPackageManagers: () => Promise<Result<InstallResult>>;
    checkForUpdates: () => Promise<Result<UpdateInfo>>;
    handleProtocolUrl: (url: string) => Promise<Result<void>>;
  };
}
```

## 7. バッチ操作のサポート

### 現状の問題点

複数の操作を行う際、個別にAPIを呼ぶ必要がある：

```typescript
// 複数のサーバーを起動する場合
for (const serverId of serverIds) {
  await startMcpServer(serverId);
}
```

### 改善案

バッチ操作をサポート：

```typescript
interface BatchOperation<T> {
  id: string;
  operation: T;
}

interface BatchResult<T> {
  succeeded: Array<{ id: string; result: T }>;
  failed: Array<{ id: string; error: APIError }>;
}

interface ServerAPI {
  // 単一操作
  start: (id: string) => Promise<Result<void>>;
  stop: (id: string) => Promise<Result<void>>;
  
  // バッチ操作
  batch: {
    start: (ids: string[]) => Promise<BatchResult<void>>;
    stop: (ids: string[]) => Promise<BatchResult<void>>;
    update: (updates: Array<{ id: string; config: Partial<MCPServerConfig> }>) 
      => Promise<BatchResult<MCPServer>>;
  };
}
```

## 8. ページネーションの統一

### 現状の問題点

ページネーションの実装が統一されていない：

```typescript
getRequestLogs: (options?: { offset?: number; limit?: number; ... }) => Promise<{ logs: any[]; total: number; }>;
getSessions: (agentId: string, options?: any) => Promise<{ sessions: any[]; hasMore: boolean; nextCursor?: string }>;
```

### 改善案

統一されたページネーション型：

```typescript
interface PaginationRequest {
  limit?: number;
  cursor?: string;
  sort?: {
    field: string;
    order: "asc" | "desc";
  };
}

interface PaginatedResponse<T> {
  items: T[];
  pagination: {
    total?: number;
    hasMore: boolean;
    nextCursor?: string;
    prevCursor?: string;
  };
}

// 使用例
getRequestLogs: (
  filters?: LogFilters, 
  pagination?: PaginationRequest
) => Promise<Result<PaginatedResponse<LogEntry>>>;

getSessions: (
  agentId: string, 
  pagination?: PaginationRequest
) => Promise<Result<PaginatedResponse<Session>>>;
```

## 9. リアルタイム通信の改善

### 現状の問題点

チャットストリームAPIが低レベルすぎる：

```typescript
sendChatStreamStart: (streamData: any) => Promise<{ success: boolean; error?: string }>;
sendChatStreamChunk: (chunkData: any) => Promise<{ success: boolean; error?: string }>;
sendChatStreamEnd: (endData: any) => Promise<{ success: boolean; error?: string }>;
```

### 改善案

高レベルなストリーミングAPI：

```typescript
interface StreamAPI {
  chat: {
    // ストリームを作成して、ストリームIDを返す
    create: (config: ChatStreamConfig) => Promise<Result<string>>;
    
    // ストリームにメッセージを送信
    send: (streamId: string, message: ChatMessage) => Promise<Result<void>>;
    
    // ストリームを購読
    subscribe: (
      streamId: string, 
      handlers: {
        onMessage?: (message: ChatMessage) => void;
        onToolCall?: (toolCall: ToolCall) => void;
        onError?: (error: APIError) => void;
        onComplete?: () => void;
      }
    ) => () => void;
    
    // ストリームを閉じる
    close: (streamId: string) => Promise<Result<void>>;
  };
}
```

## 10. 検証とバリデーション

### 現状の問題点

クライアント側でのバリデーションが不足：

```typescript
addMcpServer: (serverConfig: MCPServerConfig) => Promise<any>;
// serverConfigの妥当性チェックはサーバー側のみ
```

### 改善案

バリデーションスキーマの提供：

```typescript
import { z } from "zod";

// バリデーションスキーマをエクスポート
export const MCPServerConfigSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  serverType: z.enum(["local", "remote", "remote-streamable"]),
  env: z.record(z.string()),
  // ... その他のフィールド
});

// APIメソッドでバリデーション
interface ServerAPI {
  add: (serverConfig: z.infer<typeof MCPServerConfigSchema>) => Promise<Result<MCPServer>>;
}

// 使用例
try {
  const validConfig = MCPServerConfigSchema.parse(userInput);
  const result = await api.servers.add(validConfig);
} catch (error) {
  // バリデーションエラーの処理
}
```

## まとめ

これらの改善により、Platform APIは以下の利点を得られます：

1. **型安全性の向上** - TypeScriptの型システムを最大限活用
2. **エラーハンドリングの統一** - 一貫性のあるエラー処理
3. **開発者体験の向上** - 直感的で使いやすいAPI
4. **保守性の向上** - 明確な責任分担と構造
5. **拡張性の確保** - 新機能追加が容易
6. **プラットフォーム差異の明確化** - 実行時エラーの削減

これらの改善は段階的に実装可能で、既存のAPIとの後方互換性を保ちながら移行できます。