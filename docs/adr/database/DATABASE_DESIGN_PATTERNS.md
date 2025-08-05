# ADR: データベース設計パターン

## ステータス
承認済み（2025年8月）

## コンテキスト
MCP Routerプロジェクトのデータベース層は、SQLiteを使用し、Better-SQLite3ライブラリを通じてアクセスしている。プロジェクトの成長に伴い、以下の設計パターンを確立する必要があった：

1. データアクセス層の抽象化
2. エラーハンドリングの統一
3. トランザクション管理
4. 型安全性の確保

## 決定事項

### 1. リポジトリパターンの採用

#### BaseRepositoryクラス
全てのリポジトリの基底クラスとして`BaseRepository<T>`を実装：

```typescript
export abstract class BaseRepository<T> {
  protected db: SqliteManager;
  protected tableName: string;

  constructor(db: SqliteManager, tableName: string) {
    this.db = db;
    this.tableName = tableName;
    this.initializeTable();
  }

  // 抽象メソッド
  protected abstract initializeTable(): void;
  protected abstract mapRowToEntity(row: any): T;
  protected abstract mapEntityToRow(entity: T): Record<string, any>;

  // 共通CRUD操作
  public add(entity: T): void { /* ... */ }
  public getById(id: string): T | null { /* ... */ }
  public update(id: string, entity: Partial<T>): void { /* ... */ }
  public delete(id: string): boolean { /* ... */ }
  public getAll(options?: QueryOptions): T[] { /* ... */ }
}
```

#### 利点
- コードの再利用性
- 一貫したAPIインターフェース
- 型安全性の確保
- テスタビリティの向上

### 2. SqliteManagerによるDB接続管理

#### 設計
```typescript
export class SqliteManager {
  private db: Database.Database;
  
  constructor(dbPath: string) {
    this.db = new Database(dbPath);
  }

  // ラッパーメソッド
  execute(sql: string, params?: any): Database.RunResult;
  get<T>(sql: string, params?: any): T | undefined;
  all<T>(sql: string, params?: any): T[];
  transaction<T>(fn: () => T): T;
}
```

#### 責任
- データベース接続の管理
- SQLクエリの実行
- トランザクション管理
- プリペアドステートメントの管理

### 3. RepositoryFactoryによるシングルトン管理

```typescript
export class RepositoryFactory {
  private static instances: Record<string, any> = {};
  private static currentDb: SqliteManager | null = null;

  public static getRepository<T>(
    RepositoryClass: new (db: SqliteManager) => T,
    db: SqliteManager
  ): T {
    if (this.isDatabaseChanged(db)) {
      this.resetAllInstances();
      this.currentDb = db;
    }

    const key = RepositoryClass.name;
    if (!this.instances[key]) {
      this.instances[key] = new RepositoryClass(db);
    }
    
    return this.instances[key];
  }
}
```

### 4. エンティティマッピング戦略

#### データベース行 → エンティティ
```typescript
protected mapRowToEntity(row: any): Entity {
  // JSON文字列のパース
  // 型変換（0/1 → boolean）
  // snake_case → camelCase変換
  return {
    id: row.id,
    isActive: row.is_active === 1,
    metadata: JSON.parse(row.metadata || '{}'),
    createdAt: new Date(row.created_at)
  };
}
```

#### エンティティ → データベース行
```typescript
protected mapEntityToRow(entity: Entity): Record<string, any> {
  // JSONシリアライズ
  // 型変換（boolean → 0/1）
  // camelCase → snake_case変換
  return {
    id: entity.id,
    is_active: entity.isActive ? 1 : 0,
    metadata: JSON.stringify(entity.metadata),
    created_at: entity.createdAt.toISOString()
  };
}
```

### 5. エラーハンドリング

#### 統一されたエラーハンドリングパターン
```typescript
try {
  // データベース操作
} catch (error) {
  console.error(`[${this.constructor.name}] 操作中にエラー:`, error);
  throw error; // 上位層で処理
}
```

### 6. 暗号化戦略

機密データ（トークン、パスワードなど）はElectronのsafeStorageを使用して暗号化：

```typescript
protected mapEntityToRowForInsert(entity: Server): Record<string, any> {
  const row = this.mapEntityToRow(entity);
  
  // 機密データの暗号化
  if (row.bearer_token && safeStorage.isEncryptionAvailable()) {
    row.bearer_token = safeStorage.encryptString(row.bearer_token)
      .toString('base64');
  }
  
  return row;
}
```

## 結果

### 利点
1. **保守性**：統一されたパターンによる理解しやすいコード
2. **拡張性**：新しいエンティティの追加が容易
3. **型安全性**：TypeScriptの型システムを最大限活用
4. **テスタビリティ**：依存性注入によるモックの容易さ
5. **セキュリティ**：機密データの自動暗号化

### 欠点
1. **抽象化のオーバーヘッド**：単純な操作でも複数層を経由
2. **学習曲線**：新規開発者の理解に時間が必要

## 代替案

### 代替案1：Active Recordパターン
エンティティ自体にデータアクセスロジックを含める。
- 利点：シンプルで直感的
- 欠点：責任の分離が不明確、テストが困難

### 代替案2：Data Mapperパターン（ORM使用）
TypeORMやPrismaなどの既存ORMを使用。
- 利点：豊富な機能、コミュニティサポート
- 欠点：依存関係の増加、パフォーマンスオーバーヘッド

## 今後の検討事項

1. **クエリビルダー**：複雑なクエリのための型安全なビルダーの実装
2. **キャッシング戦略**：頻繁にアクセスされるデータのキャッシング
3. **監査ログ**：データ変更の自動記録機能
4. **パフォーマンス最適化**：インデックス戦略の見直し

## 参照
- [DATABASE_ARCHITECTURE.md](DATABASE_ARCHITECTURE.md) - データベースアーキテクチャ全体
- [DATABASE_SCHEMA_MANAGEMENT.md](DATABASE_SCHEMA_MANAGEMENT.md) - スキーマ管理戦略