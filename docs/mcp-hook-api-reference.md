# MCP Hook API リファレンス

## 概要

MCP RouterのHookシステムは、MCPリクエストの処理前後にカスタムロジックを実行できる拡張機能です。JavaScriptで記述されたHookスクリプトは、サンドボックス環境で安全に実行されます。

## Hook実行タイミング

### Pre-hook
- MCPリクエストがサーバーに送信される**前**に実行
- リクエストの検証、変更、またはブロックが可能
- 認証・認可、レート制限、リクエスト変換などに使用

### Post-hook
- MCPサーバーからレスポンスを受信した**後**に実行
- レスポンスの検証、変更、ログ記録が可能
- メトリクス収集、レスポンス変換、通知などに使用

## スクリプト実行環境

### 利用可能なグローバル変数

#### `context` (HookContext)
現在のリクエスト/レスポンスに関する情報を含むオブジェクト：

```typescript
interface HookContext {
  // リクエスト情報
  requestType: "CallTool" | "ListTools" | "ReadResource" | 
               "ListResources" | "GetPrompt" | "ListPrompts";
  serverName: string;      // サーバー名
  serverId: string;        // サーバーID
  clientId: string;        // クライアントID
  token?: string;          // 認証トークン（オプション）
  toolName?: string;       // ツール名（CallToolの場合のみ）

  // リクエスト本体
  request: {
    method: string;        // MCPメソッド名
    params: any;           // リクエストパラメータ
  };

  // レスポンス情報（Post-hookでのみ利用可能）
  response?: any;          // サーバーからのレスポンス
  error?: Error;           // エラー情報

  // Hook間でデータを共有するためのメタデータ
  metadata: Record<string, any>;

  // 実行時間計測
  startTime: number;       // リクエスト開始時刻（ミリ秒）
  duration?: number;       // 実行時間（Post-hookでのみ）
}
```

#### `console`
ログ出力用のオブジェクト：
- `console.log(...args)` - 情報ログ
- `console.info(...args)` - 情報ログ
- `console.warn(...args)` - 警告ログ
- `console.error(...args)` - エラーログ

### 利用可能なユーティリティ関数

#### `sleep(ms: number): Promise<void>`
指定されたミリ秒間処理を一時停止します。

```javascript
await sleep(1000); // 1秒待機
```

#### `validateToken(token: string): boolean`
トークンの妥当性を検証します（現在は簡易実装）。

```javascript
if (!validateToken(context.token)) {
  return {
    continue: false,
    error: {
      code: "INVALID_TOKEN",
      message: "認証トークンが無効です"
    }
  };
}
```

#### `getServerInfo(serverId: string): object`
サーバー情報を取得します（現在は簡易実装）。

```javascript
const serverInfo = getServerInfo(context.serverId);
console.log("Server name:", serverInfo.name);
```

#### `fetch(url: string, options?: object): Promise<Response>`
HTTPSリクエストを送信します。セキュリティのため、以下の制限があります：
- HTTPSのURLのみ許可（HTTPは不可）
- タイムアウトは3秒
- cookie と authorization ヘッダーは自動削除

```javascript
// GET リクエスト
const response = await fetch('https://api.example.com/data');
const data = await response.json();

// POST リクエスト
const response = await fetch('https://api.example.com/validate', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({ key: 'value' })
});

// レスポンスオブジェクト
// {
//   ok: boolean,
//   status: number,
//   statusText: string,
//   headers: object,
//   text: () => Promise<string>,
//   json: () => Promise<any>
// }
```

## スクリプトの戻り値

Hookスクリプトは必ず`HookResult`形式のオブジェクトを返す必要があります：

```typescript
interface HookResult {
  // 処理を続行するかどうか
  continue: boolean;

  // 変更されたコンテキスト（省略可能）
  // 指定した場合、次のHookやMCPサーバーへ渡されるリクエストが更新される
  context?: HookContext;

  // エラー発生時のエラー情報
  error?: {
    code: string;      // エラーコード
    message: string;   // エラーメッセージ
  };
}
```

## サンプルコード

### 1. 基本的なPre-hook（認証チェック）

```javascript
// トークンの存在をチェック
if (!context.token) {
  return {
    continue: false,
    error: {
      code: "UNAUTHORIZED",
      message: "認証トークンが必要です"
    }
  };
}

// トークンの検証
if (!validateToken(context.token)) {
  return {
    continue: false,
    error: {
      code: "INVALID_TOKEN",
      message: "無効な認証トークンです"
    }
  };
}

// 処理を続行
return { continue: true };
```

### 2. リクエスト変更（Pre-hook）

```javascript
// 特定のツール呼び出しにカスタムパラメータを追加
if (context.requestType === "CallTool" && context.toolName === "search") {
  // リクエストパラメータを変更
  const modifiedContext = {
    ...context,
    request: {
      ...context.request,
      params: {
        ...context.request.params,
        maxResults: 10,  // 最大結果数を制限
        language: "ja"   // 言語を日本語に固定
      }
    }
  };

  return {
    continue: true,
    context: modifiedContext
  };
}

return { continue: true };
```

### 3. レート制限（Pre-hook）

```javascript
// メタデータを使用してレート制限を実装
const rateLimit = context.metadata.rateLimit || {};
const clientKey = `${context.clientId}_${context.requestType}`;
const now = Date.now();

// 前回のリクエスト時刻を確認
const lastRequest = rateLimit[clientKey];
if (lastRequest && (now - lastRequest) < 1000) {  // 1秒以内
  return {
    continue: false,
    error: {
      code: "RATE_LIMIT_EXCEEDED",
      message: "リクエストが頻繁すぎます。1秒後に再試行してください。"
    }
  };
}

// 最新のリクエスト時刻を記録
rateLimit[clientKey] = now;

return {
  continue: true,
  context: {
    ...context,
    metadata: {
      ...context.metadata,
      rateLimit
    }
  }
};
```

### 4. レスポンスログ（Post-hook）

```javascript
// 実行時間とレスポンスサイズをログ
const responseSize = JSON.stringify(context.response || {}).length;
console.log(`Request completed:`, {
  type: context.requestType,
  server: context.serverName,
  tool: context.toolName,
  duration: context.duration,
  responseSize: responseSize,
  hasError: !!context.error
});

// エラーの場合は詳細をログ
if (context.error) {
  console.error("Request failed:", context.error);
}

// 処理を続行
return { continue: true };
```

### 5. レスポンス変換（Post-hook）

```javascript
// ツールのレスポンスをフィルタリング
if (context.requestType === "ListTools" && context.response) {
  // 特定のツールを除外
  const filteredTools = context.response.tools.filter(tool => {
    return !tool.name.startsWith("internal_");
  });

  const modifiedContext = {
    ...context,
    response: {
      ...context.response,
      tools: filteredTools
    }
  };

  return {
    continue: true,
    context: modifiedContext
  };
}

return { continue: true };
```

### 6. 条件付き実行

```javascript
// 特定のサーバーのみで実行
const targetServers = ["production-server", "staging-server"];
if (!targetServers.includes(context.serverName)) {
  // このサーバーでは何もしない
  return { continue: true };
}

// 営業時間外のアクセスを制限
const now = new Date();
const hour = now.getHours();
if (hour < 9 || hour >= 18) {
  return {
    continue: false,
    error: {
      code: "OUTSIDE_BUSINESS_HOURS",
      message: "営業時間外です（9:00-18:00）"
    }
  };
}

return { continue: true };
```

### 7. 外部APIによる検証（Gemini API例）

```javascript
// Gemini APIを使用したリクエスト検証
const API_KEY = "YOUR_API_KEY"; // 環境変数から取得することを推奨
const API_ENDPOINT = "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:generateContent";

try {
  const requestBody = {
    system_instruction: {
      parts: {
        text: "MCPリクエストのセキュリティを検証してください。" +
              '{"safe": boolean, "reason": string} 形式で応答。'
      }
    },
    contents: [{
      parts: [{
        text: "リクエスト情報: " + JSON.stringify({
          type: context.requestType,
          server: context.serverName,
          tool: context.toolName,
          params: context.request.params
        })
      }]
    }],
    generationConfig: {
      responseMimeType: "application/json"
    }
  };

  const response = await fetch(API_ENDPOINT + "?key=" + API_KEY, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(requestBody)
  });

  if (response.ok) {
    const result = await response.json();
    const validation = JSON.parse(
      result.candidates?.[0]?.content?.parts?.[0]?.text || "{}"
    );
    
    if (!validation.safe) {
      return {
        continue: false,
        error: {
          code: "API_VALIDATION_FAILED",
          message: validation.reason
        }
      };
    }
  }
} catch (error) {
  console.error("API validation error:", error);
  // エラー時はフォールバック処理
}

return { continue: true };
```

## エラーハンドリング

### スクリプトエラー
スクリプト内でエラーが発生した場合、自動的に以下の形式で返されます：

```javascript
{
  continue: false,
  error: {
    code: "SCRIPT_ERROR",
    message: "エラーメッセージ"
  }
}
```

### タイムアウト
スクリプトの実行時間は5秒に制限されています。タイムアウトした場合：

```javascript
{
  continue: false,
  error: {
    code: "TIMEOUT",
    message: "Script execution timed out"
  }
}
```

## ベストプラクティス

1. **早期リターン**: 条件に合わない場合は早めに`return { continue: true }`
2. **エラーハンドリング**: try-catchでエラーを適切に処理
3. **パフォーマンス**: 重い処理は避ける（タイムアウト5秒）
4. **ログ出力**: デバッグに役立つ情報を適切にログ出力
5. **メタデータ活用**: Hook間でのデータ共有にmetadataを使用

## 制限事項

- 外部APIへのアクセスは不可
- ファイルシステムへのアクセスは不可
- Node.jsモジュールのimportは不可
- 実行時間は最大5秒
- 無限ループは自動的に終了される