# ADR: Electron App ディレクトリ構造とレイヤー分離

## ステータス
承認済み

## コンテキスト
Electron アプリケーションのディレクトリ構造が複雑化し、責務の混在と依存関係の不明確さが保守性を低下させていました。特に以下の問題がありました：

- フロントエンドコードとバックエンドコードの混在
- ビジネスロジックの分散
- 循環依存の可能性
- テストの困難さ

## 決定
クリーンアーキテクチャの原則に基づき、明確なレイヤー分離を実装します。

### 新しいディレクトリ構造

```
apps/electron/src/
├── main/                    # メインプロセス
│   ├── modules/            # モジュール層（ビジネスロジック）
│   │   ├── auth/           # 認証
│   │   ├── mcp-apps-manager/ # MCPアプリ管理
│   │   │   └── (mcp-client, token-manager等)
│   │   ├── mcp-logger/     # MCPログ管理
│   │   ├── mcp-server-manager/ # MCPサーバー管理
│   │   │   └── dxt-processor/ # DXTデータ処理
│   │   ├── mcp-server-runtime/ # MCPサーバーランタイム
│   │   │   └── http/       # HTTPサーバー
│   │   ├── settings/       # 設定管理
│   │   ├── system/         # システム管理
│   │   ├── workflow/       # ワークフロー・フック管理
│   │   └── workspace/      # ワークスペース管理
│   ├── infrastructure/     # インフラストラクチャ層
│   │   ├── database/       # データベースアクセス
│   │   └── ipc.ts          # IPC通信
│   ├── ui/                 # UI関連
│   │   ├── menu.ts         # メニュー
│   │   └── tray.ts         # トレイ
│   └── utils/              # メインプロセス用ユーティリティ
├── renderer/               # レンダラープロセス
│   ├── components/         # UIコンポーネント
│   │   ├── auth/           # 認証UI
│   │   ├── common/         # 共通コンポーネント
│   │   ├── layout/         # レイアウト
│   │   ├── mcp/            # MCP関連UI
│   │   ├── setting/        # 設定UI
│   │   ├── workflow/       # ワークフロー・フック管理UI
│   │   └── workspace/      # ワークスペースUI
│   ├── platform-api/       # Platform API
│   ├── services/           # レンダラーサービス
│   ├── stores/             # 状態管理（Zustand）
│   └── utils/              # レンダラー用ユーティリティ
└── types/                  # 型定義
```

### レイヤーの責務

#### 1. モジュール層 (`main/modules/`)
- **責務**: ビジネスロジックとビジネスルール、アプリケーション機能
- **依存**: インフラストラクチャ層に依存
- **内容**: 
  - 各機能モジュール（auth, workspace等）
  - サービスクラス
  - リポジトリインターフェース
  - ビジネスルールの実装

#### 2. インフラストラクチャ層 (`main/infrastructure/`)
- **責務**: データベースとIPC通信の基盤
- **依存**: 外部ライブラリのみ
- **内容**:
  - データベース基盤
    - SQLiteManager
    - BaseRepository
    - マイグレーション管理
  - IPC通信基盤

#### 3. UI層 (`main/ui/`)
- **責務**: メインプロセス側のUI制御
- **依存**: Electronフレームワーク
- **内容**:
  - メニュー管理
  - トレイアイコン管理

#### 4. レンダラー層 (`renderer/`)
- **責務**: ユーザーインターフェース
- **依存**: IPC経由でメインプロセスと通信
- **内容**:
  - Reactコンポーネント
    - Hook管理UI
    - MCP Apps UI
    - Server管理UI
  - 状態管理（Zustand）
    - hook-store
    - workflow-store
    - theme-store
    - view-preferences-store
  - Platform API抽象化
  - UIロジック

### インポートルール

1. **インフラストラクチャ層** は他のアプリケーションコードに依存しない
2. **モジュール層** はインフラストラクチャ層に依存可能
3. **UI層** はElectronフレームワークに依存
4. **レンダラー層** は直接メインプロセスのコードをインポートしない（IPC経由）

### パスエイリアス

TypeScriptのパスエイリアスを使用して、インポートを明確にします：

```typescript
// モジュール層
import { ServerService } from "@/main/modules/mcp-server-manager/server-service";
import { WorkspaceService } from "@/main/modules/workspace/workspace-service";

// インフラストラクチャ層
import { BaseRepository } from "@/main/infrastructure/database/base-repository";

// レンダラー層
import { ServerList } from "@/renderer/components/mcp/ServerList";

// 共有
import { ServerConfig } from "@/shared/types";
```

## 結果

### 利点
1. **明確な責務分離**: 各レイヤーの役割が明確
2. **依存関係の整理**: 依存の方向が一方向に統一
3. **テスタビリティの向上**: 各レイヤーを独立してテスト可能
4. **保守性の向上**: 変更の影響範囲が限定的
5. **拡張性**: 新機能追加時の影響を最小限に

### 欠点
1. **初期の複雑性**: ファイル数とディレクトリ数の増加
2. **学習曲線**: 新規開発者がアーキテクチャを理解する必要
3. **ボイラープレート**: レイヤー間の通信にコードが必要

## 代替案

### 1. 機能別ディレクトリ構造
```
src/
├── features/
│   ├── server/
│   ├── workspace/
│   └── auth/
```
- **却下理由**: レイヤー間の責務が不明確になる

### 2. フラットな構造の維持
- **却下理由**: 現在の問題が解決されない

## 更新履歴
- **2025年9月**: モジュール層への移行を反映
  - domain層をmodules層に変更
  - application層を廃止し、機能をmodules層に統合
  - 新しいモジュール構成を反映（mcp-apps-manager, mcp-server-manager等）
  - workflow（フック管理含む）、system、mcp-loggerモジュールを追加
- **2025年8月**: 実際のディレクトリ構造に合わせて更新
  - MCP Hook System関連のディレクトリを追加
  - MCPアプリケーション機能の詳細を追加
  - スキーマ管理の統一化を反映
  - 新規追加されたサービスとコンポーネントを記載

## 参考文献
- [Clean Architecture by Robert C. Martin](https://blog.cleancoder.com/uncle-bob/2012/08/13/the-clean-architecture.html)
- [Domain-Driven Design by Eric Evans](https://www.domainlanguage.com/ddd/)
- [Electron Best Practices](https://www.electronjs.org/docs/latest/tutorial/security)
- [DATABASE_ARCHITECTURE.md](./database/DATABASE_ARCHITECTURE.md) - データベースアーキテクチャ
- [DATABASE_SCHEMA_MANAGEMENT.md](./database/DATABASE_SCHEMA_MANAGEMENT.md) - スキーマ管理戦略
