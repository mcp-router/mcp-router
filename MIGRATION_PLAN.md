⏺ MCP Router モノレポ移行計画

1. パッケージ構成設計

```
mcp-router/
├── apps/
│   ├── electron/        # Electronアプリケーション
│   └── web/            # Next.js Webアプリケーション
├── packages/
│   ├── api/            # バックエンドAPI・サービス層
│   ├── frontend/       # 共通フロントエンドコンポーネント
│   ├── shared/         # 共通型定義・ユーティリティ
│   └── database/       # データベース層（新規）
└── pnpm-workspace.yaml
```

2. 段階的移行計画

フェーズ1: 基盤整備

1. packages/shared の構築
   - src/lib/types/ → packages/shared/src/types/
   - src/types.ts → packages/shared/src/types/index.ts
   - src/lib/utils/ の共通ユーティリティ → packages/shared/src/utils/
   - src/locales/ → packages/shared/src/locales/
2. packages/database の作成
   - src/lib/database/ → packages/database/src/
   - SQLiteマネージャーとリポジトリパターンの移行
   - better-sqlite3依存関係の移動

フェーズ2: API層の分離

1. packages/api の拡張
   - src/lib/services/ → packages/api/src/services/
   - src/main/handlers/ → packages/api/src/handlers/
   - tRPCルーターの統合（既存のボイラープレートを拡張）
   - MCP固有のAPIエンドポイント追加
2. 依存関係の整理
   - @electron-monorepo/shared と @electron-monorepo/database への依存追加
   - サービスクラスのtRPCプロシージャへの変換

フェーズ3: フロントエンドの統合

1. packages/frontend の拡張
   - src/components/ → packages/frontend/src/components/
   - src/hooks/ → packages/frontend/src/hooks/
   - src/lib/stores/ → packages/frontend/src/stores/
   - スタイルファイルの移行
2. コンポーネントの整理
   - Electron固有コンポーネントの分離
   - Web/Electron共通コンポーネントの識別
   - プラットフォーム固有のロジックの抽象化

フェーズ4: Electronアプリの再構築

1. apps/electron の更新
   - src/main.ts → apps/electron/src/main.ts
   - src/main/ → apps/electron/src/main/
   - src/preload.ts → apps/electron/src/preload.ts
   - レンダラープロセスの統合
2. IPC通信の再設計
   - electron-trpcを使用したIPC通信への移行
   - 既存のIPCハンドラーをtRPCプロシージャに変換

フェーズ5: Webアプリケーションの実装

1. apps/web の拡張
   - 共通コンポーネントの利用
   - tRPC APIクライアントの設定
   - 認証フローの実装
   - MCPサーバー管理UIの実装

3. 技術的考慮事項

依存関係の管理

- React バージョンの統一（18.2.0 or 19.1.0）
- TypeScript設定の統一
- ESLint/Prettier設定の共有

ビルドシステム

- 各パッケージに独立したビルドスクリプト
- TypeScript プロジェクトリファレンスの設定
- 共通のtsconfig.base.jsonの作成

データベースアクセス

- Electron: 直接データベースアクセス
- Web: API経由でのアクセス（tRPC）

認証・セキュリティ

- 共通認証ロジックのpackages/apiへの集約
- プラットフォーム固有の認証フローの分離

4. 移行作業の優先順位

1. 高優先度
   - shared パッケージの作成（型定義の共有）
   - database パッケージの分離
   - API層のtRPC化
2. 中優先度
   - フロントエンドコンポーネントの移行
   - Electronアプリの再構築
3. 低優先度
   - Webアプリの新機能実装
   - 最適化・リファクタリング

5. リスクと対策

リスク

- 既存機能の破壊
- パフォーマンスの低下
- 開発効率の一時的低下

対策

- 段階的移行による影響範囲の限定
- 十分なテストの実施
- 古いコードと新しいコードの並行運用期間の設定
- ロールバック計画の準備

6. 成功指標

- すべてのテストが通過
- ビルド時間の短縮
- コードの再利用率向上
- 新機能追加の容易さ
- Web版とElectron版の機能パリティ

