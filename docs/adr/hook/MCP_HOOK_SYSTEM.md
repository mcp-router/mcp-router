# ADR-001: MCP Workflow System Architecture

## Status

Accepted

## Context

MCP Router は、複数の MCP (Model Context Protocol) サーバーを統合し、単一のエンドポイントとして機能するシステムです。ユーザーから、MCP リクエスト/レスポンスの処理フローにカスタムロジックを挿入したいという要望がありました。

主な要件：
- リクエスト送信前（Pre-hook）とレスポンス受信後（Post-hook）の両方でカスタムロジックを実行
- 条件に基づいてリクエストをフィルタリング、変更、またはブロック
- ユーザーが JavaScript でロジックを記述可能
- 安全な実行環境の提供
- ビジュアルな実行フローの定義

## Decision

### 1. アーキテクチャパターン

**Workflow中心のモジュラーアーキテクチャ**

Hookは独立したシステムではなく、Workflowシステムのモジュール（ノード）として実装されます。これにより、実行フローの可視化と柔軟な制御が可能になります。

```
UI Layer (React)
    ├── WorkflowEditor (React Flow)
    │   ├── StartNode
    │   ├── EndNode
    │   ├── MCPCallNode
    │   └── HookNode (Module)
    ↓
Workflow Engine
    ├── Workflow Definition
    ├── Node Execution
    └── Hook Script Execution
```

### 2. Workflowシステム

**ビジュアルプログラミングパラダイム**

React Flowを使用したビジュアルエディタで、ノードをドラッグ&ドロップして処理フローを定義します。

```typescript
interface WorkflowDefinition {
  id: string;
  name: string;
  description?: string;
  workflowType: "tools/list" | "tools/call";
  nodes: WorkflowNode[];
  edges: WorkflowEdge[];
  enabled: boolean;
  createdAt: number;
  updatedAt: number;
}
```

### 3. ノードタイプ

#### 3.1 基本ノード

```typescript
interface WorkflowNode {
  id: string;
  type: "start" | "end" | "mcp-call" | "hook";
  position: { x: number; y: number };
  data: {
    label: string;
    hook?: WorkflowHook;  // type === 'hook' の場合
    [key: string]: any;
  };
  deletable?: boolean;
}
```

#### 3.2 Hookノード（モジュール）

Hookはワークフローの一部として、以下の特性を持つモジュールです：

```typescript
interface WorkflowHook {
  id: string;
  script: string;      // JavaScript code
  blocking: boolean;   // true: 同期実行, false: 非同期（Fire & Forget）
}
```

**ノードの入出力制約：**
- **Start Node**: 入力なし、出力複数可
- **End Node**: 入力1つのみ、出力なし
- **MCP Call Node**: 入力1つ、出力複数可
- **Sync Hook** (blocking=true): 入力1つ、出力複数可
- **Fire-and-forget Hook** (blocking=false): 入力1つ、出力なし

### 4. Hook実行環境

**Workflow Engine内でのサンドボックス実行**

Hookスクリプトは、Workflow Engineによって管理され、以下の環境で実行されます：

```javascript
// Hook Context
{
  request: {
    method: string,    // MCPメソッド名
    params: any        // リクエストパラメータ
  },
  response?: any,      // Post-hookの場合のレスポンス
  metadata: {
    clientId: string,
    serverName?: string,
    workflowId: string,
    nodeId: string
  }
}
```

### 5. 実行フロー

#### 5.1 Workflow実行順序

```
Start → [Pre-hooks] → MCP Call → [Post-hooks] → End
         ↓                          ↓
    [Fire & Forget]            [Fire & Forget]
```

#### 5.2 実行順序決定アルゴリズム

1. **主経路（Main Path）の特定**
   - Startノードから順次実行
   - 同期ノードは完了を待つ
   - 非同期ノードは即座に次へ進む

2. **分岐処理**
   - Fire-and-forgetノードは並列実行
   - エラーがあってもメインフローは継続

```typescript
async function executeWorkflow(workflow: WorkflowDefinition, context: Context) {
  const startNode = workflow.nodes.find(n => n.type === 'start');
  let currentNode = startNode;
  
  while (currentNode && currentNode.type !== 'end') {
    // ノード実行
    if (currentNode.type === 'hook') {
      if (currentNode.data.hook?.blocking) {
        await executeHookSync(currentNode.data.hook, context);
      } else {
        executeHookAsync(currentNode.data.hook, context); // 待たない
      }
    } else if (currentNode.type === 'mcp-call') {
      await executeMCPCall(context);
    }
    
    // 次のノードへ
    const outgoingEdge = workflow.edges.find(e => e.source === currentNode.id);
    currentNode = workflow.nodes.find(n => n.id === outgoingEdge?.target);
  }
}
```

### 6. Visual Editor機能

**React Flowベースのエディタ**

- ドラッグ&ドロップでノード配置
- ノード間の接続をビジュアルに定義
- リアルタイムバリデーション
- Hook script inline編集

## Consequences

### Positive

1. **可視性の向上**
   - 実行フローが一目で理解できる
   - デバッグが容易
   - ノンプログラマーでも基本的なフローを理解可能

2. **モジュラー設計**
   - Hookは再利用可能なモジュール
   - 新しいノードタイプの追加が容易
   - 責務の明確な分離

3. **柔軟性**
   - 複雑なフローも視覚的に構築可能
   - 同期/非同期の混在が可能
   - 条件分岐の将来的な追加が容易

4. **保守性**
   - WorkflowはJSONとして保存
   - バージョン管理が容易
   - エクスポート/インポートが可能

### Negative

1. **複雑性の増加**
   - UIの実装が複雑
   - ユーザーの学習曲線

2. **パフォーマンス**
   - ビジュアルエディタのオーバーヘッド
   - 大規模なワークフローの描画コスト

3. **制約**
   - 現在は条件分岐なし（将来的に追加予定）
   - ループ構造なし（意図的な制限）

## Migration Path

### Phase 1: 現在の実装
- 基本的なWorkflowエディタ
- Hook、Start、End、MCP Callノード
- 線形フローのサポート

### Phase 2: 将来の拡張
- 条件分岐ノード
- 変数/状態管理ノード
- カスタムノードタイプのプラグイン化
- Workflowテンプレート/マーケットプレイス

## Implementation Notes

1. **エラーハンドリング**: 
   - 同期Hookのエラーはフローを停止
   - 非同期Hookのエラーはログのみ

2. **永続化**: 
   - WorkflowはJSONとしてローカルストレージに保存
   - 将来的にはデータベースへ移行

3. **実行モニタリング**:
   - 各ノードの実行状態を可視化
   - 実行時間の計測とボトルネック特定

## References

- [React Flow Documentation](https://reactflow.dev/)
- [MCP Protocol Specification](https://modelcontextprotocol.io/docs)
- [Visual Programming Languages](https://en.wikipedia.org/wiki/Visual_programming_language)