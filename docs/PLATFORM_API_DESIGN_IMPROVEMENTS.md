# Platform API 設計改善提案

現在のPlatform APIの設計における根本的な問題点と改善案をまとめます。

## 1. 現在の設計の問題点

### 1.1 Electron APIの直接的な移植

現在のPlatform APIは、Electron の `window.electronAPI` をそのまま抽象化したものになっています。これにより以下の問題が発生しています：

```typescript
// 現在：Electronのpreload APIをそのまま使用
interface PlatformAPI {
  login: (idp?: string) => Promise<boolean>;
  logout: () => Promise<boolean>;
  startMcpServer: (id: string) => Promise<boolean>;
  stopMcpServer: (id: string) => Promise<boolean>;
  // ... 91個のメソッド
}
```

**問題点：**
- メソッド数が多すぎる（91個）
- 責任範囲が不明確
- Electron特有の設計がWebに適さない
- テストが困難

### 1.2 フラットな構造

すべてのメソッドが同一階層にあり、機能の関連性が見えません：

```typescript
// 認証、サーバー管理、エージェント、ログなどがすべて同じレベル
interface PlatformAPI {
  // 認証
  login: (...) => ...;
  // サーバー
  startMcpServer: (...) => ...;
  // エージェント
  createAgent: (...) => ...;
  // ログ
  getRequestLogs: (...) => ...;
  // ... 続く
}
```

## 2. 改善案：ドメイン駆動設計

### 2.1 レイヤードアーキテクチャ

```typescript
// レベル1: Platform API（エントリーポイント）
interface PlatformAPI {
  auth: AuthService;
  servers: ServerService;
  agents: AgentService;
  system: SystemService;
}

// レベル2: ドメインサービス
interface AuthService {
  getCurrentUser(): Promise<User | null>;
  signIn(provider?: AuthProvider): Promise<void>;
  signOut(): Promise<void>;
  onAuthStateChange(callback: (user: User | null) => void): Unsubscribe;
}

interface ServerService {
  list(): Promise<Server[]>;
  get(id: string): Promise<Server>;
  create(config: CreateServerInput): Promise<Server>;
  update(id: string, updates: UpdateServerInput): Promise<Server>;
  delete(id: string): Promise<void>;
  
  // サーバー操作
  connect(id: string): Promise<ServerConnection>;
  disconnect(id: string): Promise<void>;
}

// レベル3: ドメインオブジェクト
interface Server {
  id: string;
  name: string;
  type: ServerType;
  status: ServerStatus;
  
  // メソッドを持つドメインオブジェクト
  start(): Promise<void>;
  stop(): Promise<void>;
  getTools(): Promise<Tool[]>;
  executeCommand(command: ServerCommand): Promise<CommandResult>;
}
```

### 2.2 Repository パターンの導入

データアクセスをRepositoryに分離：

```typescript
interface ServerRepository {
  findAll(filter?: ServerFilter): Promise<Server[]>;
  findById(id: string): Promise<Server | null>;
  save(server: Server): Promise<Server>;
  delete(id: string): Promise<void>;
}

// Platform固有の実装
class ElectronServerRepository implements ServerRepository {
  async findAll(filter?: ServerFilter): Promise<Server[]> {
    // IPC経由でメインプロセスと通信
    return window.electronAPI.listMcpServers();
  }
}

class WebServerRepository implements ServerRepository {
  async findAll(filter?: ServerFilter): Promise<Server[]> {
    // REST API経由で取得
    const response = await fetch('/api/servers');
    return response.json();
  }
}
```

## 3. Use Case ベースの設計

### 3.1 現在の問題

現在のAPIは技術的な操作に基づいており、ユーザーのユースケースが見えません：

```typescript
// 現在：技術的な操作の羅列
startMcpServer(id: string): Promise<boolean>;
getMcpServerStatus(id: string): Promise<any>;
updateMcpServerConfig(id: string, config: any): Promise<any>;
```

### 3.2 改善案：ユースケース中心

```typescript
interface ServerUseCases {
  // ユーザーストーリー：「MCPサーバーを追加して使えるようにしたい」
  setupNewServer(input: {
    source: ServerSource; // 'manual' | 'directory' | 'import'
    config?: ServerConfig;
    importUrl?: string;
  }): Promise<SetupResult>;
  
  // ユーザーストーリー：「サーバーの状態を監視したい」
  monitorServer(serverId: string): {
    status: Observable<ServerStatus>;
    logs: Observable<LogEntry[]>;
    metrics: Observable<ServerMetrics>;
  };
  
  // ユーザーストーリー：「サーバーをアップデートしたい」
  updateServer(serverId: string): Promise<UpdateResult>;
}

interface SetupResult {
  server: Server;
  steps: SetupStep[];
  warnings?: string[];
}

interface SetupStep {
  name: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  message?: string;
}
```

## 4. イベント駆動アーキテクチャ

### 4.1 現在の問題

現在のコールバックベースのイベントは型安全性に欠け、管理が困難：

```typescript
// 現在：個別のコールバック登録
onAuthStatusChanged: (callback: Function) => () => void;
onBackgroundChatStart: (callback: Function) => () => void;
onChatStreamChunk: (callback: Function) => () => void;
```

### 4.2 改善案：統一されたイベントシステム

```typescript
// イベントバス
interface EventBus {
  emit<T extends keyof AppEvents>(event: T, data: AppEvents[T]): void;
  on<T extends keyof AppEvents>(event: T, handler: Handler<AppEvents[T]>): Unsubscribe;
  once<T extends keyof AppEvents>(event: T, handler: Handler<AppEvents[T]>): void;
}

// アプリケーションイベントの定義
interface AppEvents {
  // 認証イベント
  'auth:signIn': { user: User };
  'auth:signOut': { reason?: string };
  
  // サーバーイベント
  'server:created': { server: Server };
  'server:updated': { server: Server; changes: Partial<Server> };
  'server:deleted': { serverId: string };
  'server:statusChanged': { serverId: string; status: ServerStatus };
  
  // エージェントイベント
  'agent:messageReceived': { agentId: string; message: Message };
  'agent:toolExecuted': { agentId: string; tool: string; result: any };
}

// 使用例
const unsubscribe = platform.events.on('server:statusChanged', ({ serverId, status }) => {
  console.log(`Server ${serverId} is now ${status}`);
});
```

## 5. Command/Query 分離（CQRS）

### 5.1 現在の問題

読み取りと書き込みが混在：

```typescript
// 現在：読み取りと書き込みが区別されない
interface PlatformAPI {
  getAgent(id: string): Promise<Agent>;  // Query
  createAgent(config: AgentConfig): Promise<Agent>;  // Command
  updateAgent(id: string, config: any): Promise<Agent>;  // Command
}
```

### 5.2 改善案：明確な分離

```typescript
interface PlatformAPI {
  // Queries（読み取り専用）
  queries: {
    servers: ServerQueries;
    agents: AgentQueries;
    logs: LogQueries;
  };
  
  // Commands（状態変更）
  commands: {
    servers: ServerCommands;
    agents: AgentCommands;
  };
}

interface ServerQueries {
  list(filter?: ServerFilter): Promise<Server[]>;
  get(id: string): Promise<Server>;
  search(query: string): Promise<SearchResult<Server>>;
}

interface ServerCommands {
  create(input: CreateServerInput): Promise<CommandResult<Server>>;
  update(id: string, updates: UpdateServerInput): Promise<CommandResult<Server>>;
  delete(id: string): Promise<CommandResult<void>>;
  
  // バッチコマンド
  batch(commands: ServerCommand[]): Promise<BatchResult>;
}

interface CommandResult<T> {
  success: boolean;
  data?: T;
  error?: CommandError;
  events: AppEvent[];  // 発生したイベント
}
```

## 6. ストリーム/リアクティブ設計

### 6.1 現在の問題

ポーリングや個別のコールバック：

```typescript
// 現在：個別のストリームメソッド
sendChatStreamStart(...);
sendChatStreamChunk(...);
sendChatStreamEnd(...);
onChatStreamChunk(callback);
```

### 6.2 改善案：Observable パターン

```typescript
interface ChatService {
  // ストリーミングチャット
  chat(agentId: string, input: ChatInput): ChatStream;
}

interface ChatStream {
  messages: Observable<Message>;
  status: Observable<StreamStatus>;
  
  send(message: string): Promise<void>;
  stop(): Promise<void>;
}

// 使用例
const stream = platform.chat.chat(agentId, { sessionId });

stream.messages.subscribe(message => {
  // メッセージの処理
});

stream.status.subscribe(status => {
  // ステータスの処理
});

await stream.send("Hello");
```

## 7. プラグイン/拡張アーキテクチャ

### 7.1 機能の拡張性

```typescript
interface PlatformPlugin {
  name: string;
  version: string;
  
  // プラグインの初期化
  initialize(context: PluginContext): Promise<void>;
  
  // APIの拡張
  extend?(api: PlatformAPI): void;
  
  // イベントの購読
  subscribe?(events: EventBus): void;
}

interface PluginContext {
  config: any;
  logger: Logger;
  storage: Storage;
}

// プラグインの例
class GitHubIntegrationPlugin implements PlatformPlugin {
  name = 'github-integration';
  version = '1.0.0';
  
  async initialize(context: PluginContext) {
    // GitHub APIの初期化
  }
  
  extend(api: PlatformAPI) {
    // GitHub関連のAPIを追加
    api.github = {
      importServer: async (repo: string) => { /* ... */ },
      syncAgents: async () => { /* ... */ }
    };
  }
}
```

## 8. 状態管理の統合

### 8.1 現在の問題

Zustandストアが直接Platform APIを呼び出し、状態管理が分散：

```typescript
// 現在：ストアが直接APIを呼ぶ
const useServerStore = create((set, get) => ({
  servers: [],
  fetchServers: async () => {
    const servers = await platformAPI.listMcpServers();
    set({ servers });
  }
}));
```

### 8.2 改善案：統合された状態管理

```typescript
interface PlatformState {
  auth: AuthState;
  servers: ServerState;
  agents: AgentState;
}

interface StateManager {
  // 現在の状態を取得
  getState(): PlatformState;
  
  // 状態の変更を購読
  subscribe(listener: (state: PlatformState) => void): Unsubscribe;
  
  // 特定の部分を選択
  select<T>(selector: (state: PlatformState) => T): Observable<T>;
}

// Platform APIに統合
interface PlatformAPI {
  state: StateManager;
  // ... その他のサービス
}

// 使用例
const servers = platform.state.select(state => state.servers.list);
servers.subscribe(serverList => {
  // UIを更新
});
```

## 9. エラー処理の階層化

### 9.1 ビジネスエラーと技術的エラーの分離

```typescript
// ビジネスエラー
class BusinessError extends Error {
  constructor(
    public code: BusinessErrorCode,
    public message: string,
    public context?: any
  ) {
    super(message);
  }
}

enum BusinessErrorCode {
  SERVER_ALREADY_EXISTS = 'SERVER_ALREADY_EXISTS',
  AGENT_LIMIT_EXCEEDED = 'AGENT_LIMIT_EXCEEDED',
  INVALID_SERVER_CONFIG = 'INVALID_SERVER_CONFIG',
}

// 技術的エラー
class TechnicalError extends Error {
  constructor(
    public code: TechnicalErrorCode,
    public message: string,
    public cause?: Error
  ) {
    super(message);
  }
}

enum TechnicalErrorCode {
  NETWORK_ERROR = 'NETWORK_ERROR',
  TIMEOUT = 'TIMEOUT',
  PLATFORM_NOT_SUPPORTED = 'PLATFORM_NOT_SUPPORTED',
}
```

## 10. テスタビリティの向上

### 10.1 依存性注入

```typescript
interface PlatformConfig {
  repositories: {
    server: ServerRepository;
    agent: AgentRepository;
  };
  services: {
    auth: AuthService;
    notification: NotificationService;
  };
  plugins?: PlatformPlugin[];
}

class Platform implements PlatformAPI {
  constructor(private config: PlatformConfig) {
    // 依存性の注入
  }
}

// テスト時
const mockPlatform = new Platform({
  repositories: {
    server: new MockServerRepository(),
    agent: new MockAgentRepository(),
  },
  services: {
    auth: new MockAuthService(),
    notification: new MockNotificationService(),
  }
});
```

## まとめ

これらの設計改善により：

1. **責任の明確化** - 各コンポーネントの役割が明確
2. **テスタビリティ** - モックやスタブが容易
3. **拡張性** - 新機能の追加が簡単
4. **保守性** - コードの理解と変更が容易
5. **型安全性** - TypeScriptの利点を最大限活用
6. **プラットフォーム独立性** - 真の抽象化を実現

この設計により、Platform APIは単なるElectron APIのラッパーではなく、アプリケーションのビジネスロジックを表現する真のドメインレイヤーとなります。