# Platform API 実践的な改善提案

現在のPlatform APIの実装における具体的な問題点（重複、パフォーマンス、一貫性など）と改善案をまとめます。

## 1. 細分化されすぎたメソッド

```typescript
// 現在の問題：チャットストリーム用に4つの送信メソッド
sendChatStreamStart(streamData: any): Promise<Result>;
sendChatStreamChunk(chunkData: any): Promise<Result>;
sendChatStreamEnd(endData: any): Promise<Result>;
sendChatStreamError(errorData: any): Promise<Result>;

// さらに4つのリスナーメソッド
onChatStreamStart(callback: Function): Unsubscribe;
onChatStreamChunk(callback: Function): Unsubscribe;
onChatStreamEnd(callback: Function): Unsubscribe;
onChatStreamError(callback: Function): Unsubscribe;
```

**改善案：**
```typescript
interface ChatStream {
  send(event: ChatStreamEvent): Promise<void>;
  on(event: 'message' | 'error' | 'end', callback: Function): Unsubscribe;
  close(): Promise<void>;
}

// 使用例
const stream = await platform.chat.createStream(agentId);
stream.on('message', (msg) => console.log(msg));
await stream.send({ type: 'user', content: 'Hello' });
```

## 2. パフォーマンスの問題

### 2.1 N+1 問題

```typescript
// 現在の問題：サーバーのステータスを個別に取得
const servers = await platform.listMcpServers();
for (const server of servers) {
  const status = await platform.getMcpServerStatus(server.id); // N回のAPI呼び出し
  // ...
}
```

**改善案：**
```typescript
interface ServerAPI {
  // 一括でステータスを含めて取得
  list(options?: {
    includeStatus?: boolean;
    includeTools?: boolean;
    ids?: string[];
  }): Promise<Server[]>;
  
  // バッチ取得
  getMany(ids: string[]): Promise<Server[]>;
  
  // GraphQLライクなフィールド選択
  query(options: {
    select: Array<keyof Server>;
    where?: ServerFilter;
  }): Promise<Partial<Server>[]>;
}
```

### 2.2 不要なポーリング

```typescript
// 現在の問題：ステータス更新のためにポーリング
useEffect(() => {
  const interval = setInterval(async () => {
    const status = await platform.getMcpServerStatus(serverId);
    setStatus(status);
  }, 1000); // 毎秒APIを呼ぶ
}, [serverId]);
```

**改善案：**
```typescript
interface ServerAPI {
  // WebSocketまたはSSEでリアルタイム更新
  watchStatus(serverId: string): Observable<ServerStatus>;
  
  // 複数サーバーの監視
  watchMany(serverIds: string[]): Observable<Map<string, ServerStatus>>;
}

// 使用例
const subscription = platform.servers
  .watchStatus(serverId)
  .subscribe(status => setStatus(status));
```

### 2.3 大量データの取得

```typescript
// 現在の問題：全ログを一度に取得
getRequestLogs(options?: {
  limit?: number; // デフォルトなし
}): Promise<{ logs: any[]; total: number }>;
```

**改善案：**
```typescript
interface LogAPI {
  // カーソルベースのページネーション
  page(cursor?: string, limit: number = 50): Promise<{
    entries: LogEntry[];
    nextCursor?: string;
    hasMore: boolean;
  }>;
  
  // 集計データのみ取得
  summary(options: LogSummaryOptions): Promise<LogSummary>;
}

// 使用例
for await (const log of platform.logs.stream({ follow: true })) {
  console.log(log);
}
```

## 3. データの一貫性問題

### 3.1 キャッシュの不整合

```typescript
// 現在の問題：各ストアが独自にキャッシュ
const useServerStore = create(() => ({
  servers: [], // ローカルキャッシュ
  async fetchServers() {
    this.servers = await platform.listMcpServers();
  }
}));

const useAgentStore = create(() => ({
  agents: [], // 別のローカルキャッシュ
  // サーバー情報も含むが、serverStoreと同期されない
}));
```

**改善案：**
```typescript
interface CacheManager {
  // 統一されたキャッシュ
  get<T>(key: string): T | undefined;
  set<T>(key: string, value: T, ttl?: number): void;
  invalidate(pattern: string): void;
  
  // リレーションを考慮したキャッシュ
  invalidateRelated(entity: string, id: string): void;
}

interface PlatformAPI {
  cache: CacheManager;
  
  // キャッシュを考慮したAPI
  servers: {
    list(options?: { 
      cache?: boolean | { ttl: number } 
    }): Promise<Server[]>;
  };
}
```

### 3.2 楽観的更新の不整合

```typescript
// 現在の問題：UIの即時更新とAPIレスポンスの不一致
async function updateServer(id: string, updates: any) {
  // UIを先に更新
  setServers(prev => prev.map(s => s.id === id ? {...s, ...updates} : s));
  
  try {
    await platform.updateMcpServerConfig(id, updates);
    // 成功しても、実際のデータと異なる可能性
  } catch {
    // エラー時のロールバック処理が複雑
  }
}
```

**改善案：**
```typescript
interface OptimisticUpdate<T> {
  execute(): Promise<T>;
  rollback(): void;
  
  // 楽観的更新用のデータ
  optimisticData: T;
  
  // 実際のレスポンスとの差分
  reconcile(actualData: T): T;
}

interface ServerCommands {
  // 楽観的更新をサポート
  update(
    id: string, 
    updates: UpdateServerInput
  ): OptimisticUpdate<Server>;
}

// 使用例
const update = platform.servers.update(id, { name: 'New Name' });
setServer(update.optimisticData); // 即座にUI更新

try {
  const actual = await update.execute();
  setServer(update.reconcile(actual)); // 実データと調整
} catch (error) {
  update.rollback();
  setServer(previousServer); // 元に戻す
}
```

## 4. エラーハンドリングの不一致

### 4.1 エラー形式の不統一

```typescript
// 現在の問題：メソッドによって異なるエラーハンドリング
startMcpServer(id: string): Promise<boolean>; // false = エラー
getAgent(id: string): Promise<Agent | undefined>; // undefined = not found
executeAgentTool(...): Promise<{ success: boolean; error?: string }>; // error フィールド
```

**改善案：**
```typescript
// 統一されたエラー型
type Result<T, E = Error> = 
  | { ok: true; value: T }
  | { ok: false; error: E };

interface ServerAPI {
  start(id: string): Promise<Result<void, ServerError>>;
  get(id: string): Promise<Result<Server, NotFoundError>>;
}

// 使用例
const result = await platform.servers.start(serverId);
if (result.ok) {
  console.log('Started successfully');
} else {
  console.error(`Failed: ${result.error.message}`);
}
```

## 5. 型の不整合

### 5.1 any 型の濫用

```typescript
// 現在の問題
updateMcpServerConfig(id: string, config: any): Promise<any>;
fetchSessionMessages(sessionId: string): Promise<any[]>;
onBackgroundChatStart(callback: (data: any) => void): () => void;
```

**改善案：**
```typescript
// 明確な型定義
updateMcpServerConfig(
  id: string, 
  config: Partial<MCPServerConfig>
): Promise<Server>;

fetchSessionMessages(sessionId: string): Promise<Message[]>;

onBackgroundChatStart(
  callback: (event: BackgroundChatStartEvent) => void
): Unsubscribe;
```

## 6. API バージョニング

### 6.1 後方互換性の問題

```typescript
// 現在の問題：APIの変更が破壊的
interface PlatformAPI {
  // v1: 単純なboolean
  checkActivation(): Promise<boolean>;
  
  // v2で詳細情報が必要になったら？
  // 新しいメソッドを追加？既存を変更？
}
```

**改善案：**
```typescript
interface PlatformAPI {
  v1: APIV1;
  v2: APIV2;
  
  // デフォルトは最新版
  get current(): APIV2;
}

// バージョン付きレスポンス
interface VersionedResponse<T> {
  apiVersion: string;
  data: T;
  deprecations?: string[];
}
```

## 7. 認証・認可の一貫性

### 7.1 認証状態の分散管理

```typescript
// 現在の問題：複数の場所で認証チェック
getAuthStatus(forceRefresh?: boolean): Promise<AuthStatus>;
```

**改善案：**
```typescript
interface AuthContext {
  user: User | null;
  permissions: Permission[];
  subscription: SubscriptionInfo;
  
  // 統一された認証チェック
  can(action: Action, resource?: Resource): boolean;
  
  // 認証が必要なAPIの自動ラップ
  requireAuth<T>(
    operation: () => Promise<T>
  ): Promise<T>;
}
```

## 8. トランザクション処理

### 8.1 複数操作の原子性がない

```typescript
// 現在の問題：エージェント作成時の複数ステップ
const agent = await platform.createAgent(config);
await platform.updateAgent(agent.id, { setupComplete: false });
for (const serverId of serverIds) {
  await platform.updateAppServerAccess(agent.id, [serverId]);
}
// 途中で失敗したら不整合な状態に
```

**改善案：**
```typescript
interface Transaction {
  // トランザクション内で実行
  servers: TransactionalServerAPI;
  agents: TransactionalAgentAPI;
  
  // コミット/ロールバック
  commit(): Promise<void>;
  rollback(): Promise<void>;
}

// 使用例
const tx = await platform.beginTransaction();
try {
  const agent = await tx.agents.create(config);
  await tx.agents.setupServers(agent.id, serverIds);
  await tx.commit();
} catch (error) {
  await tx.rollback();
  throw error;
}
```

## 9. メトリクスとモニタリング

### 9.1 パフォーマンス計測の欠如

```typescript
// 現在の問題：API呼び出しのパフォーマンスが不明
await platform.listMcpServers(); // 時間がかかっても原因不明
```

**改善案：**
```typescript
interface PlatformAPI {
  // メトリクス収集
  metrics: {
    getCallStats(): CallStatistics;
    getSlowQueries(threshold: number): SlowQuery[];
    enableProfiling(enabled: boolean): void;
  };
  
  // インターセプター
  use(interceptor: APIInterceptor): void;
}

interface APIInterceptor {
  request?(config: RequestConfig): RequestConfig;
  response?(response: any, config: RequestConfig): any;
  error?(error: Error, config: RequestConfig): void;
}

// 使用例
platform.use({
  request(config) {
    config.metadata = { startTime: Date.now() };
    return config;
  },
  response(response, config) {
    const duration = Date.now() - config.metadata.startTime;
    console.log(`${config.method} took ${duration}ms`);
    return response;
  }
});
```

## 10. リトライとレジリエンス

### 10.1 ネットワークエラーへの脆弱性

```typescript
// 現在の問題：単一試行で失敗
const servers = await platform.listMcpServers(); // ネットワークエラーで即失敗
```

**改善案：**
```typescript
interface RetryConfig {
  maxAttempts: number;
  backoff: 'exponential' | 'linear' | 'fixed';
  initialDelay: number;
  maxDelay: number;
  retryIf?: (error: Error) => boolean;
}

interface PlatformAPI {
  // デフォルトのリトライ設定
  setDefaultRetryConfig(config: RetryConfig): void;
  
  // メソッドごとのリトライ設定
  servers: {
    list(options?: { 
      retry?: RetryConfig | false 
    }): Promise<Server[]>;
  };
  
  // サーキットブレーカー
  circuitBreaker: {
    getStatus(service: string): CircuitStatus;
    reset(service: string): void;
  };
}
```

## まとめ

これらの実践的な改善により：

1. **パフォーマンス向上** - N+1問題の解決、バッチ処理、キャッシング
2. **信頼性向上** - リトライ、サーキットブレーカー、トランザクション
3. **開発効率向上** - 型安全性、一貫性のあるエラーハンドリング
4. **保守性向上** - メトリクス、バージョニング、明確なAPI
5. **スケーラビリティ** - ストリーミング、ページネーション、最適化されたデータ取得

これらは既存のAPIを段階的に改善していくことで実現可能です。