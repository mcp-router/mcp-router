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
│   ├── domain/             # ドメイン層（ビジネスロジック）
│   │   ├── agent/          # エージェント管理
│   │   ├── auth/           # 認証
│   │   ├── mcp-core/       # MCPコア機能
│   │   │   ├── client/     # MCPクライアント
│   │   │   ├── hook/       # MCPフック
│   │   │   ├── package/    # パッケージ管理
│   │   │   ├── rule/       # ルール管理
│   │   │   ├── server/     # サーバー管理
│   │   │   └── token/      # トークン管理
│   │   └── workspace/      # ワークスペース管理
│   ├── infrastructure/     # インフラストラクチャ層
│   │   ├── database/       # データベースアクセス
│   │   │   ├── core/       # 基盤クラス
│   │   │   ├── factories/  # ファクトリ
│   │   │   ├── migrations/ # マイグレーション
│   │   │   ├── repositories/ # リポジトリ実装
│   │   │   └── schema/     # スキーマ定義
│   │   │       └── tables/ # テーブル定義
│   │   └── ipc/            # IPC通信
│   │       └── handlers/   # IPCハンドラー
│   ├── application/        # アプリケーション層
│   │   ├── core/           # 基盤サービス
│   │   ├── mcp-core/       # MCPアプリケーション機能
│   │   │   ├── apps/       # MCPアプリ管理
│   │   │   ├── log/        # ログ管理
│   │   │   ├── mcp-manager/ # MCPマネージャー
│   │   │   ├── registry/   # レジストリ
│   │   │   └── server-processors/ # サーバー処理
│   │   ├── settings/       # 設定管理
│   │   ├── ui/             # UI関連（メニュー、トレイ）
│   │   └── workspace/      # ワークスペース管理
│   └── utils/              # メインプロセス用ユーティリティ
├── renderer/               # レンダラープロセス
│   ├── components/         # UIコンポーネント
│   │   ├── agent/          # エージェント関連UI
│   │   ├── auth/           # 認証UI
│   │   ├── common/         # 共通コンポーネント
│   │   ├── hook/           # フック管理UI
│   │   ├── layout/         # レイアウト
│   │   ├── mcp/            # MCP関連UI
│   │   ├── setting/        # 設定UI
│   │   └── workspace/      # ワークスペースUI
│   ├── platform-api/       # Platform API
│   ├── services/           # レンダラーサービス
│   ├── stores/             # 状態管理（Zustand）
│   └── utils/              # レンダラー用ユーティリティ
└── types/                  # 型定義
```

### レイヤーの責務

#### 1. ドメイン層 (`main/domain/`)
- **責務**: ビジネスロジックとビジネスルール
- **依存**: 他のレイヤーに依存しない
- **内容**: 
  - エンティティ
  - ドメインサービス
  - ビジネスルールの実装

#### 2. インフラストラクチャ層 (`main/infrastructure/`)
- **責務**: 外部システムとの接続
- **依存**: ドメイン層
- **内容**:
  - データベースアクセス（Repository実装）
    - 統一されたスキーマ定義（`schema/tables/`）
    - BaseRepositoryパターン
    - RepositoryFactoryによる管理
  - IPC通信ハンドラー
    - 各機能別ハンドラー（agent, hook, server等）
  - 外部APIクライアント

#### 3. アプリケーション層 (`main/application/`)
- **責務**: アプリケーション固有のビジネスロジック
- **依存**: ドメイン層、インフラストラクチャ層
- **内容**:
  - アプリケーションサービス
  - MCPコア機能
    - Aggregator Server（リクエスト集約）
    - Hook Manager（フック管理）
    - MCP Apps Service（アプリ管理）
    - DXT Processor（データ変換）
  - ユースケースの実装
  - Platform API Manager

#### 4. プレゼンテーション層 (`renderer/`)
- **責務**: ユーザーインターフェース
- **依存**: IPC経由でメインプロセスと通信
- **内容**:
  - Reactコンポーネント
    - Agent管理UI（作成・使用）
    - Hook管理UI
    - MCP Apps UI
    - Server管理UI
  - 状態管理（Zustand）
    - hook-store（新規追加）
  - Platform API抽象化
  - UIロジック

### インポートルール

1. **ドメイン層** は他のレイヤーに依存してはいけない
2. **インフラストラクチャ層** はドメイン層のみに依存可能
3. **アプリケーション層** はドメイン層とインフラストラクチャ層に依存可能
4. **プレゼンテーション層** は直接メインプロセスのコードをインポートしない

### パスエイリアス

TypeScriptのパスエイリアスを使用して、インポートを明確にします：

```typescript
// ドメイン層
import { ServerService } from "@/main/domain/server/server-service";

// インフラストラクチャ層
import { getServerRepository } from "@/main/infrastructure/database";

// アプリケーション層
import { getPlatformAPIManager } from "@/main/application/platform-api-manager";

// レンダラー層
import { ServerList } from "@/renderer/components/server/ServerList";

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
- **2025年8月**: 実際のディレクトリ構造に合わせて更新
  - MCP Hook System関連のディレクトリを追加
  - MCPアプリケーション機能の詳細を追加
  - スキーマ管理の統一化を反映
  - 新規追加されたサービスとコンポーネントを記載

## 参考文献
- [Clean Architecture by Robert C. Martin](https://blog.cleancoder.com/uncle-bob/2012/08/13/the-clean-architecture.html)
- [Domain-Driven Design by Eric Evans](https://www.domainlanguage.com/ddd/)
- [Electron Best Practices](https://www.electronjs.org/docs/latest/tutorial/security)
- [DATABASE_ARCHITECTURE.md](./DATABASE_ARCHITECTURE.md) - データベースアーキテクチャ
- [DATABASE_SCHEMA_MANAGEMENT.md](./DATABASE_SCHEMA_MANAGEMENT.md) - スキーマ管理戦略
