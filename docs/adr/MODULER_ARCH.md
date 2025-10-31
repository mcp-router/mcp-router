# ADR: モジュラーアーキテクチャへのリファクタリング

## ステータス
部分的に実施済み（2025年1月）

## コンテキスト

現在のElectronアプリケーションのメインプロセスは3層構造（application、infrastructure、utils）を採用しています。しかし、以下の問題が残存しています：

### 現状の問題点

1. **循環依存の発生**
    - infrastructure → application
    - application → infrastructure
    - 層間の相互依存が残存

2. **責任境界の不明確さ**
    - applicationに統合されたが機能の分類が不明確
    - 同一機能が複数ディレクトリに分散
    - 新規開発者が適切な配置場所を判断できない

3. **コントリビューションの困難さ**
    - 複雑な層構造により学習コストが高い
    - どこに何があるか直感的でない
    - テストの書き方が不明確

4. **保守性の低下**
    - 機能追加時に複数層の変更が必要
    - リファクタリングが困難
    - テストカバレッジの確保が難しい

## 決定

機能モジュール単位で自己完結した構造（Modular Architecture）を採用します。

### 新しいディレクトリ構造

```
apps/electron/src/main/
├── modules/                 # 機能モジュール（自己完結）- 将来の目標構造
│   ├── auth/               # 認証モジュール
│   │   ├── auth.service.ts        # ビジネスロジック
│   │   ├── auth.repository.ts     # データアクセス
│   │   ├── auth.ipc.ts           # IPCハンドラー
│   │   ├── auth.types.ts         # 型定義
│   │   └── __tests__/            # テスト
│   │       ├── auth.service.test.ts
│   │       └── auth.repository.test.ts
│   │
│   ├── mcp/                # MCPモジュール
│   │   ├── mcp.service.ts
│   │   ├── mcp.repository.ts
│   │   ├── mcp.ipc.ts
│   │   ├── mcp.types.ts
│   │   └── __tests__/
│   │
│   ├── workflow/           # ワークフローモジュール
│   │   ├── workflow.service.ts
│   │   ├── workflow.repository.ts
│   │   ├── workflow.ipc.ts
│   │   ├── workflow.types.ts
│   │   └── __tests__/
│   │
│   └── workspace/          # ワークスペースモジュール
│       ├── workspace.service.ts
│       ├── workspace.repository.ts
│       ├── workspace.ipc.ts
│       ├── workspace.types.ts
│       └── __tests__/
├── utils/                 # ユーティリティ
│   ├── logger.ts
│   ├── fetch.ts
│   └── environment.ts
│
└── main.ts                # アプリケーションエントリーポイント
```

### モジュール構造の詳細

各モジュールは以下のファイルで構成されます：

1. **`.service.ts`** - ビジネスロジック
    - ドメイン知識の実装
    - ビジネスルールの適用
    - 外部依存はインターフェース経由

2. **`.repository.ts`** - データアクセス層
    - データベースとのやり取り
    - データの永続化と取得
    - SQLiteManager経由でのアクセス

3. **`.ipc.ts`** - IPCハンドラー
    - レンダラープロセスとの通信
    - サービスメソッドの呼び出し
    - レスポンスの整形

4. **`.types.ts`** - 型定義
    - モジュール固有の型
    - インターフェース定義
    - 定数定義

### 依存関係のルール

```
IPC Handler → Service → Repository → Shared Database
     ↓           ↓           ↓
   Types       Types       Types
```

- **単方向依存**: 上位層は下位層のみに依存
- **横の依存禁止**: モジュール間の直接依存は避ける
- **共通機能経由**: モジュール間連携は共有インターフェース経由

### 依存性注入パターン

```typescript
// modules/auth/auth.service.ts
export interface AuthRepository {
  findUserByEmail(email: string): Promise<User | null>;
  createUser(data: CreateUserDto): Promise<User>;
}

export class AuthService {
  constructor(private repository: AuthRepository) {}
  
  async authenticate(email: string, password: string) {
    // ビジネスロジック
  }
}

// modules/auth/auth.repository.ts
export class AuthRepositoryImpl implements AuthRepository {
  constructor(private db: Database) {}
  
  async findUserByEmail(email: string) {
    // データベースアクセス
  }
}

// modules/auth/auth.ipc.ts
export function registerAuthHandlers(authService: AuthService) {
  ipcMain.handle('auth:login', async (_, { email, password }) => {
    return authService.authenticate(email, password);
  });
}
```

### テスト戦略

```typescript
// modules/auth/__tests__/auth.service.test.ts
describe('AuthService', () => {
  let service: AuthService;
  let mockRepository: jest.Mocked<AuthRepository>;

  beforeEach(() => {
    mockRepository = {
      findUserByEmail: jest.fn(),
      createUser: jest.fn(),
    };
    service = new AuthService(mockRepository);
  });

  test('should authenticate valid user', async () => {
    mockRepository.findUserByEmail.mockResolvedValue({
      id: '1',
      email: 'test@example.com',
      password: 'hashed',
    });

    const result = await service.authenticate('test@example.com', 'password');
    expect(result).toBeTruthy();
  });
});
```

## 結果

### メリット

1. **理解しやすさ**
    - 機能単位で完結
    - ファイル配置が直感的
    - 新規開発者の学習コストが低い

2. **保守性**
    - 機能追加が容易
    - リファクタリングが局所的
    - 影響範囲が明確

3. **テスタビリティ**
    - モックが容易
    - 単体テストが書きやすい
    - テストカバレッジを確保しやすい

4. **並列開発**
    - モジュール間の競合が少ない
    - チーム開発が容易
    - 責任範囲が明確

### デメリット

1. **初期移行コスト**
    - 既存コードの大規模な移動が必要
    - 一時的な不安定化の可能性

2. **共通機能の重複**
    - 各モジュールで似たコードが発生する可能性
    - 共通化のタイミングの判断が必要

## 移行計画

### Phase 1: 準備
- [ ] 新構造のディレクトリ作成
- [ ] 共通機能（shared）の整備
- [ ] 依存性注入の仕組み構築

### Phase 2: 段階的移行
- [ ] 各モジュールの順次移行

### Phase 3: クリーンアップ
- [ ] 旧構造の削除
- [ ] ドキュメント更新
- [ ] 最終テスト

## 参考資料

- [Modular Architecture Pattern](https://martinfowler.com/articles/modular-architecture.html)
- [Feature-Sliced Design](https://feature-sliced.design/)
- [Vertical Slice Architecture](https://jimmybogard.com/vertical-slice-architecture/)
