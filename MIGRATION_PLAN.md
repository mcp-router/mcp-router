# MCP Router Migration Plan - Platform API Architecture

## 概要
MCP RouterをElectronアプリケーションからWeb対応アプリケーションへ移行するための計画書です。Platform APIを活用することで、同一のフロントエンドコードベースでElectron版とWeb版の両方に対応します。

## アーキテクチャ方針

### Platform API抽象化レイヤー
- **目的**: プラットフォーム固有の実装を隠蔽し、フロントエンドコードの再利用を最大化
- **設計**: インターフェースベースの抽象化により、Electron/Web両環境で動作
- **利点**: 
  - フロントエンドコンポーネントの変更不要
  - ストア層の変更不要
  - 段階的な機能追加が容易

### 実装構造
```
platform-api/
├── platform-api-interface.ts    # 共通インターフェース定義
├── electron-platform-api.ts     # Electron実装
├── web-platform-api.ts         # Web実装（新規作成）
└── platform-api-factory.ts     # 環境に応じた実装の選択
```

## Phase 1: パッケージ整理とリファクタリング

### 1.1 パッケージ構造の再編成
**目的**: Electron専用コードとプラットフォーム共通コードの明確な分離

#### 移動対象（packages/ → apps/electron/）
```
- @mcp-router/database → apps/electron/src/lib/database/
  理由: better-sqlite3はElectron環境専用

- @mcp-router/frontend → apps/electron/src/frontend/
  理由: 現状Electron専用のため

- @mcp-router/shared/utils → apps/electron/src/lib/utils/
  理由: 多くがElectron固有の実装
```

#### 維持対象（packages/に残す）
```
- @mcp-router/shared （型定義のみ）
  - types/ のみ維持
  - utils/ はElectronに移動
  
- @mcp-router/platform-api # プラットフォーム抽象化層
```

### 1.2 import文の更新
```typescript
// Before
import { getServerRepository } from '@mcp-router/database';
import { someUtil } from '@mcp-router/shared/utils';

// After  
import { getServerRepository } from '@/lib/database';
import { someUtil } from '@/lib/utils';

// 型定義は引き続きpackagesから
import { MCPServer } from '@mcp-router/shared/types';
```

**推定工数**: 3日

## Phase 2: Web Platform API実装

### 2.1 WebPlatformAPI クラスの作成
```typescript
// apps/web/lib/web-platform-api.ts
export class WebPlatformAPI implements PlatformAPI {
  private apiClient: ApiClient;
  private websocket?: WebSocket;
  
  // 認証関連（Phase 1では未実装）
  async login(): Promise<void> {
    throw new Error('Authentication not implemented in Phase 1');
  }
  
  // MCPサーバー管理（リモートのみ）
  async listMcpServers(): Promise<MCPServer[]> {
    const response = await this.apiClient.get('/api/servers');
    return response.data;
  }
  
  async startMcpServer(id: string): Promise<void> {
    const server = await this.getMcpServer(id);
    if (server.serverType !== 'remote') {
      throw new Error('Only remote servers are supported in web version');
    }
    await this.apiClient.post(`/api/servers/${id}/start`);
  }
}
```

### 2.2 API Routes実装
```typescript
// apps/web/app/api/servers/route.ts
export async function GET(request: Request) {
  const servers = await prisma.server.findMany();
  return Response.json(servers);
}

export async function POST(request: Request) {
  const data = await request.json();
  // リモートサーバーのみ許可
  if (data.serverType !== 'remote') {
    return Response.json(
      { error: 'Only remote servers are supported' },
      { status: 400 }
    );
  }
  const server = await prisma.server.create({ data });
  return Response.json(server);
}
```

**推定工数**: 1週間

## Phase 3: データベース層の実装

### 3.1 Prismaスキーマ定義
```prisma
// apps/web/prisma/schema.prisma
model Server {
  id               String   @id @default(cuid())
  name             String   @unique
  serverType       String   @default("remote")
  remoteUrl        String?
  bearerToken      String?
  env              Json?
  disabled         Boolean  @default(false)
  autoStart        Boolean  @default(false)
  toolPermissions  Json?
  createdAt        DateTime @default(now())
  updatedAt        DateTime @updatedAt
}

model Agent {
  id              String   @id @default(cuid())
  name            String
  purpose         String
  description     String?
  instructions    String
  mcpServers      Json
  toolPermissions Json?
  autoExecuteTool Boolean  @default(false)
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt
}

model Log {
  id              String   @id @default(cuid())
  clientId        String
  serverId        String
  requestType     String
  requestParams   Json?
  responseStatus  String
  responseData    Json?
  duration        Int
  errorMessage    String?
  timestamp       DateTime @default(now())
  
  @@index([clientId])
  @@index([serverId])
  @@index([timestamp])
}
```

### 3.2 リポジトリパターンの実装
```typescript
// apps/web/lib/repositories/server-repository.ts
export class ServerRepository {
  async getAllServers(): Promise<MCPServer[]> {
    const servers = await prisma.server.findMany();
    return servers.map(this.mapToMCPServer);
  }
  
  async addServer(config: MCPServerConfig): Promise<MCPServer> {
    const server = await prisma.server.create({
      data: this.mapToDbServer(config)
    });
    return this.mapToMCPServer(server);
  }
}
```

**推定工数**: 5日

## Phase 4: リアルタイム通信の実装

### 4.1 WebSocket/SSE設定
```typescript
// apps/web/lib/realtime/websocket-manager.ts
export class WebSocketManager {
  private connections = new Map<string, WebSocket>();
  
  handleConnection(ws: WebSocket, userId: string) {
    this.connections.set(userId, ws);
    
    ws.on('message', (data) => {
      const message = JSON.parse(data.toString());
      this.handleMessage(userId, message);
    });
  }
  
  broadcast(event: string, data: any) {
    this.connections.forEach((ws) => {
      ws.send(JSON.stringify({ event, data }));
    });
  }
}
```

### 4.2 ログストリーミング
```typescript
// apps/web/app/api/logs/stream/route.ts
export async function GET(request: Request) {
  const stream = new ReadableStream({
    start(controller) {
      const interval = setInterval(async () => {
        const logs = await getRecentLogs();
        controller.enqueue(`data: ${JSON.stringify(logs)}\n\n`);
      }, 1000);
      
      request.signal.addEventListener('abort', () => {
        clearInterval(interval);
        controller.close();
      });
    }
  });
  
  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive'
    }
  });
}
```

**推定工数**: 1週間

## Phase 5: UI統合とテスト

### 5.1 ProvidersへのPlatform API統合
```typescript
// apps/web/components/providers.tsx
import { PlatformAPIProvider } from '@mcp-router/platform-api';
import { WebPlatformAPI } from '@/lib/web-platform-api';

export function Providers({ children }: ProvidersProps) {
  const platformAPI = useMemo(() => new WebPlatformAPI(), []);
  
  return (
    <PlatformAPIProvider platformAPI={platformAPI}>
      {children}
    </PlatformAPIProvider>
  );
}
```

### 5.2 機能制限の実装
```typescript
// apps/web/lib/web-platform-api.ts
export class WebPlatformAPI implements PlatformAPI {
  getCapabilities(): PlatformCapabilities {
    return {
      supportsLocalServers: false,
      supportsAutoUpdate: false,
      supportsSystemTray: false,
      supportsFileSystemAccess: false,
      supportsProtocolHandler: false
    };
  }
}
```

**推定工数**: 3日

## 移行スケジュール

### Week 1: 基盤準備
- パッケージ整理とリファクタリング
- Web Platform API基本実装
- データベーススキーマ定義

### Week 2-3: コア機能実装
- リモートMCPサーバー管理
- ログ記録と表示
- エージェント基本機能

### Week 4: リアルタイム機能
- WebSocket/SSE実装
- ログストリーミング
- ステータス更新

### Week 5: 統合とテスト
- UI統合
- エラーハンドリング
- パフォーマンス最適化

### Week 6: 最終調整
- バグ修正
- ドキュメント作成
- デプロイ準備

## 技術スタック

### フロントエンド（共通）
- React 19
- Zustand（状態管理）
- Radix UI + Tailwind CSS
- @mcp-router/platform-api

### Electron版
- Electron 35.x
- better-sqlite3
- Node.js child_process

### Web版
- Next.js 15 (App Router)
- PostgreSQL + Prisma
- WebSocket/SSE
- Docker（オプション：将来的なローカルサーバー対応）

## リスクと対策

### 1. パフォーマンスの違い
**リスク**: SQLiteからPostgreSQLへの移行によるレスポンス時間の増加
**対策**: 
- インデックスの最適化
- クエリの効率化
- キャッシング戦略の実装

### 2. リアルタイム性の確保
**リスク**: WebSocket接続の不安定性
**対策**:
- 自動再接続機構
- SSEフォールバック
- 楽観的更新の実装

### 3. 機能の差異
**リスク**: ユーザーの期待値とのギャップ
**対策**:
- 明確な機能比較表の提供
- 段階的な機能追加のロードマップ
- ユーザーフィードバックの収集

## 成功指標

1. **コード再利用率**: 80%以上のフロントエンドコード再利用
2. **パフォーマンス**: 平均レスポンスタイム500ms以下
3. **機能カバレッジ**: リモートサーバー機能の100%実装
4. **ユーザー体験**: Electron版と同等のUI/UX

## まとめ

Platform APIアプローチにより、以下の利点が得られます：

1. **開発効率**: 既存コードの最大限の再利用
2. **保守性**: 単一のコードベースで両プラットフォーム対応
3. **拡張性**: 将来的な機能追加が容易
4. **段階的移行**: リスクを最小限に抑えた実装

この計画により、約6週間でMCP Router Web版の基本機能を実装し、将来的な拡張の基盤を構築できます。
