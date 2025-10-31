# ADR: Platform API アーキテクチャ

## ステータス
採用済み（Accepted）

## コンテキスト

MCP Routerは、MCPサーバーを中心に管理するクロスプラットフォーム（Electron/Web）アプリケーションです。フロントエンドとバックエンドの通信を抽象化し、プラットフォーム固有の実装を隠蔽するためのAPIレイヤーが必要でした。

### 背景

当初、Electronの`window.electronAPI`をそのまま抽象化したフラットな構造で実装されていましたが、以下の課題がありました：

1. **責任範囲が不明確**: 関連する機能が分散しており、メソッドの検索や理解が困難
2. **型安全性の欠如**: 多くのメソッドが`any`型を使用
3. **エラーハンドリングの不統一**: メソッドごとに異なるエラー処理パターン
4. **プラットフォーム差異の不透明性**: Web版で利用できない機能が実行時まで分からない

## 決定

### ドメイン駆動設計によるモジュール化

関連する機能を論理的なドメインに再編成し、主要なドメインAPIに整理しました：

```typescript
// packages/shared/src/types/platform-api/ipc.ts
interface PlatformAPI {
  app: AppAPI;             // アプリケーション管理（トークン管理含む）
  auth: AuthAPI;           // 認証・認可
  hooks: HookAPI;          // MCPフック管理
  log: LogAPI;             // ログ管理
  package: PackageAPI;     // パッケージ管理（システムユーティリティ含む）
  server: ServerAPI;       // MCPサーバー管理
  settings: SettingsAPI;   // アプリケーション設定
  workspace: WorkspaceAPI; // ワークスペース管理
}
```

## 実装詳細

### 現在のコードベース構造

1. **型定義の配置**
   - `packages/shared/src/types/platform-api/ipc.ts`: メインのインターフェース定義
   - `packages/shared/src/types/platform-api/domains/`: 各ドメインAPIの型定義
   - `apps/electron/src/lib/platform-api/types/platform-api.ts`: Electron固有の型定義

2. **実装**
   - `apps/electron/src/frontend/lib/electron-platform-api.ts`: Electron環境での実装
   - `apps/electron/src/frontend/lib/remote-platform-api.ts`: リモート（Web）環境での実装

3. **バックエンド管理**
   - `apps/electron/src/main/platform-api-manager.ts`: ワークスペースに応じたAPIの切り替え

### 各ドメインAPIの責務

#### ServerAPI
- MCPサーバーのCRUD操作
- サーバーの起動・停止・再起動
- ステータスとメトリクスの取得
- ログ管理

#### AuthAPI
- ログイン・ログアウト
- 認証ステータスの取得
- 認証状態変更の監視

#### AppAPI
- 外部URLを開く
- バージョン情報の取得
- トークン管理（生成、検証、破棄）
- アップデート管理

#### PackageAPI
- パッケージコマンドの解決
- パッケージの更新
- パッケージマネージャーの管理
- システムコマンドのチェック

#### SettingsAPI
- アプリケーション設定の取得・更新・リセット
- 設定変更の監視
- オーバーレイカウント管理

#### LogAPI
- ログのクエリ
- ログのクリア・エクスポート
- リアルタイムログ更新の監視

#### WorkspaceAPI
- ワークスペースのCRUD操作
- アクティブワークスペースの管理
- ワークスペース変更の監視

#### HookAPI
- MCPフックのCRUD操作
- フックの有効化・無効化
- フックの実行順序管理
- プリ・ポストフック処理

## アーキテクチャの特徴

### 1. プラットフォーム抽象化

```typescript
// Electron実装例
class ElectronPlatformAPI implements PlatformAPI {
  auth: AuthAPI = {
    signIn: (provider) => window.electronAPI.login(provider),
    signOut: () => window.electronAPI.logout(),
    // ...
  };
}
```

### 2. 型安全性

すべてのAPIメソッドは明確な型定義を持ち、`any`型の使用を避けています：

```typescript
interface ServerAPI {
  list(): Promise<MCPServer[]>;
  get(id: string): Promise<MCPServer | null>;
  create(input: CreateServerInput): Promise<MCPServer>;
  // ...
}
```

### 3. 統一されたコールバックパターン

イベントリスナーは`Unsubscribe`関数を返す統一パターンを採用：

```typescript
export type Unsubscribe = () => void;

interface AuthAPI {
  onAuthChange(callback: (status: AuthStatus) => void): Unsubscribe;
}
```

## 影響と利点

### プラス面

1. **開発効率の向上**
   - ドメインごとに整理されたAPIで検索が容易
   - IDE補完の精度向上

2. **保守性の改善**
   - 関連機能がグループ化され理解しやすい
   - 新機能追加時の影響範囲が明確

3. **型安全性**
   - 厳密な型定義によるランタイムエラーの削減
   - リファクタリングの安全性向上

4. **拡張性**
   - 新しいドメインの追加が容易
   - プラットフォーム固有の実装を隠蔽

### 考慮事項

1. **学習曲線**: 新しいAPI構造に慣れる必要がある
2. **ドメイン境界**: 機能の配置で迷う場合がある（例：トークン管理をAppAPIに含めるか独立させるか）

## 今後の方向性

1. **エラーハンドリングの改善**: Result型パターンの導入検討
2. **非同期操作の改善**: 長時間実行操作のJob API導入
3. **バッチ操作**: 複数操作の一括実行サポート

## 結論

Platform APIのドメイン駆動設計による再構成により、コードベースの構造が明確になり、開発効率と保守性が向上しました。このアーキテクチャは、MCP Routerのクロスプラットフォーム要件を満たしながら、将来の拡張にも対応できる柔軟性を持っています。
