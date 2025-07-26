# ESLint & TypeCheck エラー統計とKnipレポート

## 概要

このレポートは、mcp-routerプロジェクトのコード品質分析結果をまとめたものです。

- **分析日時**: 2025-07-26
- **プロジェクトバージョン**: 0.5.2

## ESLint分析結果

### エラー統計

| パッケージ | エラー数 | 警告数 | 状態 |
|----------|---------|--------|------|
| @mcp_router/shared | 0 | 42 | ✅ Success |
| @mcp_router/tailwind-config | 0 | 0 | ✅ Success |
| @mcp_router/remote-api-types | 12 | 1 | ❌ Failed |
| @mcp_router/cli | - | - | ⏳ Running |
| @mcp_router/ui | - | - | ⏳ Running |
| @mcp_router/electron | - | - | - |

**合計: 12エラー、43警告**

### 主な問題

#### 1. @typescript-eslint/no-explicit-any (43警告)
最も多い警告は`any`型の使用です。以下のファイルで頻出:
- `packages/shared/src/types/ui/index.ts` (16件)
- `packages/shared/src/types/platform-api/index.ts` (7件)
- `packages/shared/src/types/mcp-types.ts` (4件)
- `packages/shared/src/types/database/index.ts` (3件)

#### 2. custom/no-type-reexport (12エラー)
`@mcp_router/remote-api-types`パッケージで型の再エクスポートエラーが発生:
- `packages/remote-api-types/src/index.ts` (4件)
- `packages/remote-api-types/src/schema/index.ts` (8件)

## TypeCheck分析結果

### エラー統計

| パッケージ | エラー数 | 状態 |
|----------|---------|------|
| @mcp_router/shared | 0 | ✅ Success |
| @mcp_router/remote-api-types | 0 | ✅ Success |
| @mcp_router/ui | 0 | ✅ Success |
| @mcp_router/cli | 0 | ✅ Success |
| @mcp_router/electron | 123 | ❌ Failed |

**合計: 123エラー**

### 主な型エラーカテゴリ

#### 1. 未定義の型参照 (14エラー)
- `ChatSession`型が見つからない
- `SessionStatus`型が見つからない

#### 2. 型の不一致 (約30エラー)
- `string | null`を`string`に代入できない
- `undefined`を期待される型に代入できない
- プロパティの欠落

#### 3. unknownタイプの処理 (18エラー)
- `error`が`unknown`型として扱われている
- 適切な型ガードが必要

#### 4. その他の問題
- プライベートコンストラクタのアクセス問題 (7エラー)
- 型宣言ファイルの欠落 (`better-sqlite3`)
- ファイル名の大文字小文字の不一致

### 影響の大きいファイル
1. `src/lib/database/session-repository.ts` (12エラー)
2. `src/lib/utils/backend/rule-utils.ts` (11エラー)
3. `src/main/services/mcp-apps-service.ts` (8エラー)
4. `src/frontend/components/agent/BackgroundComponent.tsx` (7エラー)

## Knip分析結果

### 未使用の依存関係

#### 本番依存関係 (31個)
- **Radix UIコンポーネント** (18個): 実際には使用されていないUIライブラリ
- **その他のライブラリ**: `cmdk`, `next-themes`, `react-resizable-panels`, `tar-fs`など

#### 開発依存関係 (6個)
- `@types/tar-fs`, `concurrently`, `eslint-plugin-react`など

### 未使用のエクスポート

#### 関数 (24個)
- 日付ユーティリティ関数の多く
- パッケージバージョン解決関連の関数
- データベース関連のヘルパー関数

#### クラス (3個)
- `ElectronPlatformAPI`
- `SqliteManagerSingleton`

#### 型定義 (30個)
- API関連の型定義の多くが未使用

### リストされていない依存関係 (5個)
- `strip-ansi`
- `clsx`
- `tailwind-merge`
- `react`
- `tailwindcss-animate`

## 推奨される改善アクション

### 優先度: 高

1. **TypeCheckエラーの修正** (123エラー)
   - 特に`ChatSession`と`SessionStatus`の型定義を追加
   - `unknown`型のエラーハンドリングを改善
   - 型の不一致を解消

2. **ESLintエラーの修正** (12エラー)
   - 型の再エクスポートルールに従う

### 優先度: 中

3. **any型の削減** (43警告)
   - 適切な型定義を追加
   - ジェネリクスの活用

4. **未使用依存関係の削除** (37個)
   - 特にRadix UIコンポーネントの整理
   - package.jsonのクリーンアップ

### 優先度: 低

5. **未使用エクスポートの削除** (57個)
   - デッドコードの削除
   - 必要に応じて内部関数化

6. **設定の最適化**
   - Knipの設定ファイルで推奨される変更を適用

## まとめ

現在のコードベースには合計**178個の問題**があります:
- TypeCheckエラー: 123個
- ESLintエラー: 12個
- ESLint警告: 43個

これらの問題を段階的に解決することで、コードの品質と保守性を大幅に向上させることができます。