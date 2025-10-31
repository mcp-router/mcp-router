# ADR: データベーススキーマ管理の統一化

## ステータス
承認済み（2025年8月実装）

## コンテキスト
MCP Routerプロジェクトでは、複数のデータベーステーブルを管理するために、9つのリポジトリクラスが存在していた。
当初、これらのリポジトリクラスは各自のinitializeTable()メソッド内でSQL文を直接記述していた。
また、一部のテーブル（hooks）はマイグレーションファイルでも作成されており、以下の問題が発生していた：

1. **テーブル定義の重複**：同じテーブル定義が複数箇所に存在
2. **管理の不統一**：スキーマ定義ファイルが存在するが活用されていない
3. **保守性の低下**：テーブル構造の変更時に複数箇所の修正が必要
4. **責任の曖昧さ**：テーブル作成の責任が分散

## 決定事項

### 1. スキーマ定義の一元管理
全てのテーブル定義を`schema/tables/`ディレクトリ配下のTypeScriptファイルで管理する。各スキーマファイルは以下の構造を持つ：

```typescript
import { DatabaseTableSchema } from "@mcp_router/shared";

export const TABLE_NAME_SCHEMA: DatabaseTableSchema = {
  createSQL: `CREATE TABLE IF NOT EXISTS ...`,
  indexes: [
    "CREATE INDEX IF NOT EXISTS ...",
    // 他のインデックス
  ]
};

export const TABLE_NAME_REQUIRED_COLUMNS = ["col1", "col2"];
```

### 2. リポジトリクラスの統一パターン
全てのリポジトリクラスは、対応するスキーマ定義をインポートし、initializeTable()メソッドで使用する：

```typescript
import { TABLE_SCHEMA } from "../../schema/tables/table-name";

protected initializeTable(): void {
  try {
    // スキーマ定義を使用してテーブルを作成
    this.db.execute(TABLE_SCHEMA.createSQL);

    // スキーマ定義からインデックスを作成
    if (TABLE_SCHEMA.indexes) {
      TABLE_SCHEMA.indexes.forEach((indexSQL) => {
        this.db.execute(indexSQL);
      });
    }

    console.log(`[${this.constructor.name}] テーブルの初期化が完了しました`);
  } catch (error) {
    console.error(`[${this.constructor.name}] テーブルの初期化中にエラー:`, error);
    throw error;
  }
}
```

### 3. DATABASE_SCHEMAオブジェクトによる集約
`database-schema.ts`ファイルで全てのスキーマ定義を集約：

```typescript
export const DATABASE_SCHEMA = {
  servers: SERVERS_SCHEMA,
  requestLogs: REQUEST_LOGS_SCHEMA,
  settings: SETTINGS_SCHEMA,
  migrations: MIGRATIONS_SCHEMA,
  workspaces: WORKSPACES_SCHEMA,
  hooks: HOOKS_SCHEMA,
  tokens: TOKENS_SCHEMA,
} as const;
```

### 4. マイグレーションの責任範囲
マイグレーションは既存テーブルの変更（ALTER TABLE）のみを担当し、新規テーブル作成は行わない。テーブル作成はリポジトリクラスの初期化時に実行される。

## 実装詳細

### リポジトリクラス一覧と対応

| リポジトリクラス | テーブル名 | スキーマファイル | BaseRepository継承 |
|---|---|---|---|
| HookRepository | hooks | hooks.ts | ✓ |
| McpLoggerRepository | requestLogs | request-logs.ts | ✓ |
| McpServerManagerRepository | servers | servers.ts | ✓ |
| SettingsRepository | settings | settings.ts | ✗ |
| McpAppsManagerRepository | tokens | tokens.ts | ✓ |
| WorkspaceRepository | workspaces | workspaces.ts | ✓ |

### SettingsRepositoryの特殊対応
SettingsRepositoryはBaseRepositoryを継承していないため、独自のinitializeTable()メソッドを実装。ただし、同じパターンでスキーマ定義を使用する。

## 結果

### 利点
1. **DRY原則の実現**：テーブル定義の重複を完全に排除
2. **保守性の向上**：テーブル構造の変更は一箇所で管理
3. **型安全性**：DatabaseTableSchema型による型チェック
4. **一貫性**：全テーブルが同じパターンで管理される
5. **可読性**：役割が明確で理解しやすい構造

### 欠点
1. **初期実装コスト**：既存の9つのリポジトリクラスの修正が必要
2. **間接性**：テーブル定義を確認するために別ファイルを参照する必要がある

## 代替案

### 代替案1：SQL文の直接記述を継続
各リポジトリクラスでSQL文を直接記述する現状を維持する。
- 利点：直接的で理解しやすい
- 欠点：重複が多く、保守性が低い

### 代替案2：ORMの導入
TypeORMやPrismaなどのORMを導入する。
- 利点：より高度な抽象化、マイグレーション管理
- 欠点：学習コスト、依存関係の増加、パフォーマンスオーバーヘッド

### 代替案3：スキーマ定義の自動生成
データベースから逆生成でスキーマ定義を作成する。
- 利点：既存DBとの整合性が保証される
- 欠点：初期DBの作成方法が別途必要、CI/CD環境での課題

## 今後の検討事項

1. **スキーマバージョニング**：スキーマのバージョン管理方法の検討
2. **マイグレーション戦略**：より複雑なマイグレーションへの対応
3. **テスト戦略**：スキーマ定義の正確性を保証するテストの追加
4. **ドキュメント生成**：スキーマ定義からのドキュメント自動生成

## 参照
- [DATABASE_ARCHITECTURE.md](DATABASE_ARCHITECTURE.md) - データベースアーキテクチャ全体の設計
