# ADR: データベースアーキテクチャ

## ステータス
承認済み

## コンテキスト
Electron アプリケーションのデータベース層は、複数のワークスペースをサポートし、各種エンティティ（サーバー、エージェント、ログなど）を永続化する必要があります。以下の要件を満たす必要がありました：

- **マルチワークスペース対応**: 各ワークスペースが独立したデータベースを持つ
- **型安全性**: TypeScriptの型システムを活用した安全なデータアクセス
- **パフォーマンス**: 大量のログデータの効率的な処理
- **保守性**: 新しいエンティティの追加が容易
- **トランザクション管理**: データの整合性を保証

## 決定

### ディレクトリ構造

```
apps/electron/src/main/infrastructure/database/
├── core/                      # 核となるデータベース機能
│   ├── base-repository.ts     # リポジトリ基底クラス
│   ├── database-context.ts    # データベースコンテキスト管理
│   └── sqlite-manager.ts      # SQLite接続管理
├── factories/                 # ファクトリパターン実装
│   └── repository-factory.ts  # リポジトリインスタンス管理
├── migrations/                # データベースマイグレーション
│   ├── main-database-migration.ts  # 基本マイグレーション
│   └── workspace-main-database-migration.ts
├── repositories/              # リポジトリ実装
│   ├── log/                  # ログリポジトリ
│   ├── server/               # サーバーリポジトリ
│   ├── settings/             # 設定リポジトリ
│   ├── token/                # トークンリポジトリ
│   └── workspace/            # ワークスペースリポジトリ
├── schema/                   # スキーマ定義
│   ├── database-schema.ts    # 統合スキーマ
│   ├── schema-utils.ts       # スキーマユーティリティ
│   └── tables/               # 個別テーブル定義
│       ├── hooks.ts
│       ├── migrations.ts
│       ├── request-logs.ts
│       ├── servers.ts
│       ├── settings.ts
│       ├── tokens.ts
│       └── workspaces.ts
└── ipc.ts                  # パブリックAPI
```

### アーキテクチャパターン

#### 1. Repository パターン
```typescript
export abstract class BaseRepository<T extends { id: string }> {
  protected db: SqliteManager;
  protected tableName: string;
  
  // 共通のCRUD操作
  public getAll(options: any = {}): T[]
  public getById(id: string): T | undefined
  public create(data: Omit<T, 'id'>): T
  public update(id: string, data: Partial<T>): T | undefined
  public delete(id: string): boolean
}
```

各エンティティのリポジトリは `BaseRepository` を継承し、エンティティ固有の操作を追加します。

#### 2. Factory パターン
```typescript
export class RepositoryFactory {
  private static instances: RepositoryInstances = {
    server: null,
    log: null,
    // ...
  };
  
  public static getServerRepository(db: SqliteManager): ServerRepository {
    if (this.isDatabaseChanged(db)) {
      this.resetAllInstances();
      this.currentDb = db;
    }
    
    if (!this.instances.server) {
      this.instances.server = new ServerRepository(db);
    }
    
    return this.instances.server;
  }
}
```

リポジトリインスタンスの生成と管理を一元化し、データベース切り替え時の整合性を保証します。

#### 3. Context パターン
```typescript
export class DatabaseContext {
  private currentDatabase: SqliteManager | null = null;
  
  public async getCurrentDatabase(): Promise<SqliteManager> {
    if (this.currentDatabase) {
      return this.currentDatabase;
    }
    
    if (!this.databaseProvider) {
      throw new Error("Database provider not configured");
    }
    
    return await this.databaseProvider();
  }
}
```

現在のワークスペースのデータベースコンテキストを管理し、アプリケーション全体で一貫性を保ちます。

### データベース選択：SQLite + better-sqlite3

#### 選択理由
1. **組み込みデータベース**: 外部プロセス不要
2. **高パフォーマンス**: better-sqlite3は同期APIで高速
3. **トランザクションサポート**: ACID特性を保証
4. **軽量**: Electronアプリに最適
5. **型安全性**: TypeScriptとの相性が良い

### マルチワークスペース対応

#### データベースの分離
- **メインデータベース** (`mcprouter.db`): ワークスペース情報とグローバル設定
- **ワークスペースデータベース** (`workspace-{id}.db`): 各ワークスペース固有のデータ

#### ワークスペース切り替え時の処理
1. 現在のデータベース接続をクローズ
2. 新しいワークスペースのデータベースを開く
3. RepositoryFactoryがすべてのリポジトリインスタンスをリセット
4. 新しいデータベースでリポジトリを再作成

### スキーマ管理

#### 型定義との統合
```typescript
// スキーマ定義
export const serversTableSchema = {
  id: "TEXT PRIMARY KEY",
  name: "TEXT NOT NULL",
  config: "TEXT NOT NULL", // JSON
  // ...
};

// 型定義と自動的に同期
export type ServerRecord = {
  id: string;
  name: string;
  config: string;
  // ...
};
```

#### マイグレーション戦略
1. **自動マイグレーション**: アプリ起動時に実行
2. **バージョン管理**: migrationsテーブルで管理
3. **後方互換性**: 既存データの保護

### パフォーマンス最適化

#### 1. インデックス戦略
```sql
CREATE INDEX IF NOT EXISTS idx_request_logs_timestamp ON request_logs(timestamp);
CREATE INDEX IF NOT EXISTS idx_request_logs_serverId ON request_logs(serverId);
CREATE INDEX IF NOT EXISTS idx_request_logs_clientId ON request_logs(clientId);
```

#### 2. バッチ処理
```typescript
// トランザクション内でバッチ処理
this.db.transaction(() => {
  for (const item of items) {
    stmt.run(item);
  }
})();
```

#### 3. プリペアドステートメント
```typescript
const stmt = this.db.prepare("INSERT INTO servers VALUES (?, ?, ?)");
// 再利用可能
```

## 結果

### 利点
1. **型安全性**: コンパイル時エラー検出
2. **パフォーマンス**: 同期APIによる高速アクセス
3. **保守性**: 明確な責務分離
4. **拡張性**: 新しいエンティティの追加が容易
5. **信頼性**: トランザクションによるデータ整合性

### 欠点
1. **SQLite制限**: 同時書き込みの制限
2. **メモリ使用**: 大量データ時のメモリ消費
3. **バックアップ**: 手動でのバックアップが必要

## 代替案

### 1. IndexedDB
- **却下理由**: メインプロセスでは使用不可、APIが複雑

### 2. PostgreSQL/MySQL
- **却下理由**: 外部プロセスが必要、デプロイが複雑

### 3. LevelDB
- **却下理由**: SQLクエリ不可、リレーショナルデータに不向き

## セキュリティ考慮事項

1. **SQLインジェクション対策**: プリペアドステートメントの使用
2. **データ暗号化**: 機密データ（トークン）の暗号化
3. **アクセス制御**: ファイルシステムレベルでの保護

## 今後の拡張可能性

1. **リモートデータベース**: クラウド同期のサポート
2. **キャッシュレイヤー**: Redis互換キャッシュの追加
3. **読み取り専用レプリカ**: パフォーマンス向上
4. **自動バックアップ**: 定期バックアップ機能

## 更新履歴
- **2025年8月**: スキーマ管理の統一化
  - 全リポジトリがスキーマ定義ファイルを使用するよう更新
  - DATABASE_SCHEMAオブジェクトによる一元管理を実装
  - マイグレーションの責任範囲を既存テーブルの変更のみに限定
  - hooksとtokensテーブルのスキーマ定義を追加

## 参考文献
- [better-sqlite3 Documentation](https://github.com/WiseLibs/better-sqlite3)
- [Repository Pattern](https://martinfowler.com/eaaCatalog/repository.html)
- [SQLite Best Practices](https://www.sqlite.org/bestpractice.html)
- [DATABASE_SCHEMA_MANAGEMENT.md](DATABASE_SCHEMA_MANAGEMENT.md) - スキーマ管理戦略
- [DATABASE_DESIGN_PATTERNS.md](DATABASE_DESIGN_PATTERNS.md) - データベース設計パターン
