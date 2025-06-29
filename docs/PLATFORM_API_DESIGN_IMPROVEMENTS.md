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
}
```

**問題点：**
- メソッド数が多すぎる
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

## 2. 改善案：ドメイン分割によるモジュール化

### 2.1 シンプルなドメイン分割

フラットなメソッドを、論理的なドメインごとにグループ化します：

```typescript
// 改善前：フラットな構造
interface PlatformAPI {
  login: () => Promise<boolean>;
  logout: () => Promise<boolean>;
  listMcpServers: () => Promise<any>;
  startMcpServer: (id: string) => Promise<boolean>;
  // ... 87個のメソッドが続く
}

// 改善後：ドメインごとにモジュール化
interface PlatformAPI {
  auth: AuthAPI;
  servers: ServerAPI;
  agents: AgentAPI;
  chat: ChatAPI;
  settings: SettingsAPI;
  // ... 各ドメインが整理される
}
```

### 2.2 各ドメインの責任範囲

各ドメインモジュールは明確な責任範囲を持ちます：

- **auth**: 認証・認可に関する操作
- **servers**: MCPサーバーの管理
- **agents**: エージェントの作成・管理、チャット機能とストリーミング（統合）
- **apps**: MCPアプリケーション管理、APIトークン管理（統合）
- **packages**: パッケージ管理、システムユーティリティ（統合）
- **settings**: アプリケーション設定
- **logs**: ログの取得と管理
- **workspaces**: ワークスペース管理

### 2.3 ドメイン統合の理由

いくつかのドメインは概念的に同じものを扱っているため、統合します：

1. **agents + chat**: エージェントとのチャットは本質的にエージェント機能の一部
2. **apps + tokens**: トークンはアプリケーションのアクセス管理に使用される
3. **packages + system**: パッケージ管理とシステムユーティリティは関連性が高い









## 実装計画：ドメイン分割によるAPI改善

### 選択したアプローチ：シンプルなドメイン分割

フラットなメソッドを、ドメインごとに整理された20個のモジュールに再構成します。DDDの全体を採用するのではなく、必要な概念（ドメイン分割）のみを使用します。

### Phase 1: インターフェース設計（現在のフェーズ）

#### 1.1 新しいPlatform API構造

```typescript
// packages/platform-api/src/types/platform-api.ts
export interface PlatformAPI {
  // 認証ドメイン (5 methods → 1 module)
  auth: AuthAPI;
  
  // サーバー管理ドメイン (8 methods → 1 module)
  servers: ServerAPI;
  
  // エージェント管理ドメイン (20 methods → 1 module)
  // エージェント管理 + チャット機能を統合
  agents: AgentAPI;
  
  // アプリ管理ドメイン (6 methods → 1 module)
  // アプリ管理 + トークン管理を統合
  apps: AppAPI;
  
  // パッケージ管理ドメイン (10 methods → 1 module)
  // パッケージ管理 + システムユーティリティを統合
  packages: PackageAPI;
  
  // 設定管理ドメイン (3 methods → 1 module)
  settings: SettingsAPI;
  
  // ログ管理ドメイン (1 method → 1 module)
  logs: LogAPI;
  
  // ワークスペース管理 (9 methods → 1 module)
  workspaces: WorkspaceAPI;
}
```

#### 1.2 各ドメインAPIの詳細設計

```typescript
// 認証ドメイン
export interface AuthAPI {
  signIn(provider?: AuthProvider): Promise<boolean>;
  signOut(): Promise<boolean>;
  getStatus(): Promise<AuthStatus>;
  handleToken(token: string, refreshToken?: string): Promise<boolean>;
  onChange(callback: (status: AuthStatus) => void): Unsubscribe;
}

// サーバー管理ドメイン
export interface ServerAPI {
  list(): Promise<Server[]>;
  get(id: string): Promise<Server>;
  create(config: CreateServerInput): Promise<Server>;
  update(id: string, updates: UpdateServerInput): Promise<Server>;
  delete(id: string): Promise<void>;
  start(id: string): Promise<boolean>;
  stop(id: string): Promise<boolean>;
  getStatus(id: string): Promise<ServerStatus>;
}

// エージェント管理ドメイン（チャット機能統合）
export interface AgentAPI {
  // エージェント管理
  list(): Promise<Agent[]>;
  get(id: string): Promise<Agent | null>;
  create(input: CreateAgentInput): Promise<Agent>;
  update(id: string, updates: UpdateAgentInput): Promise<Agent>;
  delete(id: string): Promise<void>;
  deploy(id: string, target: DeployTarget): Promise<DeploymentResult>;
  
  // ツール管理
  tools: {
    execute(agentId: string, toolName: string, args: any): Promise<ToolResult>;
    list(agentId: string): Promise<Tool[]>;
  };
  
  // セッション管理
  sessions: {
    create(agentId: string): Promise<ChatSession>;
    get(sessionId: string): Promise<ChatSession | null>;
    list(agentId?: string): Promise<ChatSession[]>;
    delete(sessionId: string): Promise<void>;
    update(sessionId: string, updates: Partial<ChatSession>): Promise<void>;
  };
  
  // ストリーミングチャット
  stream: {
    start(sessionId: string, message: ChatMessage): Promise<void>;
    send(sessionId: string, chunk: string): Promise<void>;
    end(sessionId: string): Promise<void>;
    error(sessionId: string, error: Error): Promise<void>;
    onChunk(callback: (sessionId: string, chunk: string) => void): Unsubscribe;
    onEnd(callback: (sessionId: string) => void): Unsubscribe;
    onError(callback: (sessionId: string, error: Error) => void): Unsubscribe;
  };
  
  // バックグラウンドチャット
  background: {
    start(agentId: string, sessionId: string): Promise<void>;
    send(message: ChatMessage): Promise<void>;
    end(): Promise<void>;
    onStart(callback: () => void): Unsubscribe;
  };
}

// アプリ管理ドメイン（トークン管理統合）
export interface AppAPI {
  // アプリ管理
  list(): Promise<McpApp[]>;
  create(appName: string): Promise<AppResult>;
  delete(appName: string): Promise<void>;
  updateServerAccess(appName: string, serverIds: string[]): Promise<AppResult>;
  unifyConfig(appName: string): Promise<AppResult>;
  
  // トークン管理
  tokens: {
    updateScopes(tokenId: string, scopes: TokenScope[]): Promise<TokenResult>;
    generate(options: TokenGenerateOptions): Promise<string>;
    revoke(tokenId: string): Promise<void>;
    list(): Promise<Token[]>;
  };
}

// パッケージ管理ドメイン（システムユーティリティ統合）
export interface PackageAPI {
  // パッケージ管理
  resolveVersions(argsString: string, manager: PackageManager): Promise<ResolveResult>;
  checkUpdates(args: string[], manager: PackageManager): Promise<UpdateResult>;
  checkManagers(): Promise<ManagerStatus>;
  installManagers(): Promise<InstallResult>;
  
  // システムユーティリティ
  system: {
    getPlatform(): Promise<Platform>;
    checkCommand(command: string): Promise<boolean>;
    restartApp(): Promise<void>;
    checkForUpdates(): Promise<UpdateInfo>;
    installUpdate(): Promise<boolean>;
    onUpdateAvailable(callback: (available: boolean) => void): Unsubscribe;
  };
}
```

### Phase 2: 移行戦略

#### 2.1 アダプター層の実装

既存のフラットAPIと新しいドメイン分割APIの間にアダプター層を実装し、段階的な移行を可能にします。

```typescript
// packages/platform-api/src/adapters/legacy-adapter.ts
export class LegacyPlatformAPIAdapter implements PlatformAPI {
  constructor(private legacyAPI: LegacyPlatformAPI) {}
  
  auth: AuthAPI = {
    signIn: (provider) => this.legacyAPI.login(provider),
    signOut: () => this.legacyAPI.logout(),
    getStatus: () => this.legacyAPI.getAuthStatus(),
    handleToken: (token, refreshToken) => 
      this.legacyAPI.handleAuthToken(token, refreshToken),
    onChange: (callback) => this.legacyAPI.onAuthStatusChanged(callback)
  };
  
  servers: ServerAPI = {
    list: () => this.legacyAPI.listMcpServers(),
    get: (id) => this.legacyAPI.getMcpServer(id),
    create: (config) => this.legacyAPI.addMcpServer(config),
    update: (id, updates) => this.legacyAPI.updateMcpServer(id, updates),
    delete: (id) => this.legacyAPI.removeMcpServer(id),
    start: (id) => this.legacyAPI.startMcpServer(id),
    stop: (id) => this.legacyAPI.stopMcpServer(id),
    getStatus: (id) => this.legacyAPI.getMcpServerStatus(id)
  };
  
  agents: AgentAPI = {
    // エージェント管理
    list: () => this.legacyAPI.listAgents(),
    get: (id) => this.legacyAPI.getAgent(id),
    create: (input) => this.legacyAPI.createAgent(input),
    update: (id, updates) => this.legacyAPI.updateAgent(id, updates),
    delete: (id) => this.legacyAPI.deleteAgent(id),
    deploy: (id) => this.legacyAPI.deployAgent(id),
    
    // ツール管理
    tools: {
      execute: (agentId, toolName, args) => 
        this.legacyAPI.executeAgentTool(agentId, toolName, args),
      list: (agentId) => this.legacyAPI.getAgentMCPServerTools(agentId)
    },
    
    // セッション管理
    sessions: {
      create: (agentId) => this.legacyAPI.createSession(agentId),
      get: (sessionId) => this.legacyAPI.fetchSessionMessages(sessionId),
      list: (agentId) => this.legacyAPI.getSessions(agentId),
      delete: (sessionId) => this.legacyAPI.deleteSession(sessionId),
      update: (sessionId, updates) => 
        this.legacyAPI.updateSessionMessages(sessionId, updates)
    },
    
    // ストリーミングチャット
    stream: {
      start: (sessionId, message) => 
        this.legacyAPI.sendChatStreamStart({ sessionId, message }),
      send: (sessionId, chunk) => 
        this.legacyAPI.sendChatStreamChunk({ sessionId, chunk }),
      end: (sessionId) => 
        this.legacyAPI.sendChatStreamEnd({ sessionId }),
      error: (sessionId, error) => 
        this.legacyAPI.sendChatStreamError({ sessionId, error }),
      onChunk: (callback) => this.legacyAPI.onChatStreamChunk(callback),
      onEnd: (callback) => this.legacyAPI.onChatStreamEnd(callback),
      onError: (callback) => this.legacyAPI.onChatStreamError(callback)
    },
    
    // バックグラウンドチャット
    background: {
      start: (agentId, sessionId) => 
        this.legacyAPI.startBackgroundChat(sessionId, agentId, ''),
      send: () => Promise.resolve(),
      end: () => this.legacyAPI.stopBackgroundChat(''),
      onStart: (callback) => this.legacyAPI.onBackgroundChatStart(callback)
    }
  };
  
  // ... 他の統合ドメインも同様に実装
}
```

#### 2.2 移行手順

1. **Phase 2a: アダプター実装** (1週間)
   - LegacyPlatformAPIAdapterの完全実装
   - 既存のテストケースでの動作確認
   - パフォーマンステストの実施

2. **Phase 2b: Electron実装の更新** (2週間)
   - Electronのpreload.jsを新しいドメイン構造で再実装
   - IPCハンドラーをドメインごとに整理
   - 既存の機能テストの実行

3. **Phase 2c: UIコンポーネントの移行** (3週間)
   - 最も使用頻度の高いコンポーネントから順次移行
   - Zustandストアの更新
   - E2Eテストの実行

4. **Phase 2d: Web実装** (2週間)
   - Web版のPlatform API実装
   - REST APIエンドポイントの設計
   - 統合テストの実施

### Phase 3: 最適化と改善

#### 3.1 型安全性の強化

```typescript
// 厳密な型定義
export type ServerStatus = 
  | { type: 'stopped' }
  | { type: 'starting'; progress: number }
  | { type: 'running'; connectedAt: Date; stats: ServerStats }
  | { type: 'stopping' }
  | { type: 'error'; error: string };

// ジェネリクスを使用した柔軟な設計
export interface QueryResult<T> {
  data: T;
  metadata: {
    timestamp: Date;
    cached: boolean;
    source: 'cache' | 'fresh';
  };
}
```

#### 3.2 エラーハンドリングの統一

```typescript
// ドメイン固有のエラー型
export class ServerError extends Error {
  constructor(
    public code: ServerErrorCode,
    message: string,
    public serverId?: string
  ) {
    super(message);
  }
}

export enum ServerErrorCode {
  NOT_FOUND = 'SERVER_NOT_FOUND',
  ALREADY_RUNNING = 'SERVER_ALREADY_RUNNING',
  START_FAILED = 'SERVER_START_FAILED',
  INVALID_CONFIG = 'SERVER_INVALID_CONFIG'
}
```

### Phase 4: 移行完了後の改善

#### 4.1 パフォーマンス最適化

- バッチ操作の実装
- キャッシング戦略の導入
- 遅延読み込みの実装

#### 4.2 開発者体験の向上

- 自動補完の改善
- ドキュメント生成の自動化
- デバッグツールの提供

## メリットと期待される成果

1. **開発効率の向上**
   - メソッド検索時間
   - IDE補完の精度向上
   - コードレビュー時間の短縮

2. **保守性の改善**
   - 関連機能がグループ化され、理解しやすい
   - 新機能追加時の影響範囲が明確
   - テストの書きやすさ向上

3. **拡張性の確保**
   - 新しいドメインの追加が容易
   - プラットフォーム固有の実装を隠蔽
   - プラグインシステムへの発展が可能

4. **型安全性の向上**
   - より厳密な型定義
   - ランタイムエラーの削減
   - リファクタリングの安全性向上

## リスクと対策

### リスク1: 既存コードの大規模な変更
**対策**: アダプター層による段階的移行

### リスク2: パフォーマンスの低下
**対策**: アダプター層のオーバーヘッド測定と最適化

### リスク3: 開発期間の延長
**対策**: 機能ごとの優先順位付けと段階的リリース

## まとめ

このドメイン分割アプローチにより：

1. **フラットなメソッドを論理的なモジュールに整理**
2. **段階的な移行により、既存機能を維持しながら改善**
3. **将来の拡張性と保守性を確保**
4. **開発者体験の大幅な向上**

Platform APIは単なるElectron APIのラッパーではなく、アプリケーションの機能を適切に表現する抽象化層となります。