# ADR-001: MCP Hook System Architecture

## Status

Accepted

## Context

MCP Router は、複数の MCP (Model Context Protocol) サーバーを統合し、単一のエンドポイントとして機能するシステムです。ユーザーから、MCP リクエスト/レスポンスの処理フローにカスタムロジックを挿入したいという要望がありました。

主な要件：
- リクエスト送信前（Pre-hook）とレスポンス受信後（Post-hook）の両方でカスタムロジックを実行
- 条件に基づいてリクエストをフィルタリング、変更、またはブロック
- ユーザーが JavaScript でロジックを記述可能
- 安全な実行環境の提供
- 実行順序の制御

## Decision

### 1. アーキテクチャパターン

**SingletonService パターンの採用**

他のサービス（ConfigService、ServerService など）と一貫性を保つため、HookService も SingletonService を継承する設計とします。

```
UI Layer (React)
    ↓ IPC
IPC Handler Layer
    ↓
Service Layer (HookService - Singleton)
    ↓
Repository Layer (HookRepository)
    ↓
SQLite Database
```

### 2. フィルタリング方式

**スクリプト内フィルタリング**

当初検討したデータベースレベルのターゲットフィルタ（targets フィールド）を廃止し、すべてのフィルタリングロジックをユーザースクリプト内で実行する方式を採用します。

```javascript
// ユーザースクリプト例
if (context.requestType === 'CallTool' && context.toolName === 'specific-tool') {
  // カスタムロジック
}
```

### 3. スクリプト実行環境

**Node.js VM モジュールによるサンドボックス**

セキュリティを確保するため、Node.js の vm モジュールを使用してサンドボックス環境でスクリプトを実行します。

提供される環境：
- 制限されたグローバルスコープ
- カスタムコンソール（ログはシステムログに転送）
- ユーティリティ関数（sleep、validateToken など）
- 5秒のタイムアウト制限

### 4. データモデル

```typescript
interface MCPHook {
  id: string;
  name: string;
  enabled: boolean;
  executionOrder: number;  // 'order' から変更（SQL予約語回避）
  hookType: 'pre' | 'post' | 'both';
  script: string;
  createdAt: number;
  updatedAt: number;
}
```

## Consequences

### Positive

1. **柔軟性の向上**
   - ユーザーは複雑な条件ロジックを自由に記述可能
   - 新しいフィルタリング要件に対してスキーマ変更が不要

2. **一貫性のあるアーキテクチャ**
   - 既存のサービスパターンに準拠
   - 開発者にとって理解しやすい構造

3. **セキュリティの確保**
   - VM によるサンドボックス化でシステムへの影響を最小化
   - タイムアウトによる無限ループ防止

4. **保守性**
   - シンプルなデータモデル
   - 責務の明確な分離（Service/Repository）

### Negative

1. **パフォーマンスへの影響**
   - すべてのフックでスクリプト評価が必要
   - VM 作成のオーバーヘッド

2. **デバッグの困難さ**
   - ユーザースクリプトのエラーが発生した場合のトラブルシューティング
   - 実行時エラーの可能性

3. **学習曲線**
   - ユーザーは JavaScript の知識が必要
   - HookContext の構造を理解する必要

## Alternatives Considered

### 1. データベースレベルのフィルタリング

**概要**: targets フィールドを使用して、データベースクエリでフィルタリング

**却下理由**:
- 複雑な条件（AND/OR の組み合わせ）の表現が困難
- スキーマが複雑化
- 動的な条件変更が困難

### 2. 独自スクリプト言語の実装

**概要**: JavaScript の代わりに、より制限された独自のスクリプト言語を設計

**却下理由**:
- 実装コストが高い
- ユーザーの学習コストが増加
- エコシステムの利点を活用できない

### 3. WebAssembly による実行

**概要**: より高度なサンドボックス化のため WebAssembly を使用

**却下理由**:
- 実装の複雑性
- JavaScript からの移行が困難
- 現時点でのセキュリティ要件には VM で十分

## Implementation Notes

1. **エラーハンドリング**: フックの実行エラーは記録されるが、メインの処理フローは継続する
2. **実行順序**: executionOrder フィールドで制御、UI でドラッグ&ドロップによる変更が可能
3. **将来の拡張**: 
   - トークン検証機能の実装
   - サーバー情報取得 API の追加
   - パフォーマンスメトリクスの収集

## References

- [MCP Protocol Specification](https://modelcontextprotocol.io/docs)
- [Node.js VM Documentation](https://nodejs.org/api/vm.html)
- 既存のサービス実装パターン（ConfigService、ServerService）