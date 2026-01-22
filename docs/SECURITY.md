# 検出事項の詳細

## 1. OAuth および認証トークンセキュリティの脆弱性 (深刻度: 緊急)

### 対象の機能
OAuth および認証トークンセキュリティの脆弱性

### 該当箇所
- apps/electron/src/main/modules/auth/auth.service.ts
- apps/electron/src/main.ts
- apps/electron/src/main/infrastructure/shared-config-manager.ts
- apps/electron/src/main/modules/settings/settings.service.ts
- apps/electron/src/main/modules/workspace/workspace.ipc.ts
- apps/electron/src/main/modules/auth/auth.ipc.ts

auth.service.ts の handleAuthToken 関数 (94-119 行目) - currentAuthState が null の場合にステート検証をバイパスし、任意のトークンを処理し、SharedConfigManager にプレーンテキストで保存します。

### 説明
認証トークン処理における複数の重大な欠陥: 1) PKCE OAuth フローのステートパラメータ検証は、currentAuthState が存在しない場合にバイパス可能であり、CSRF 攻撃とプロトコルハンドラー URL の操作を可能にします。2) 認証トークンは暗号化なしでプレーンテキストで保存され、保護なしで IPC を介して送信されます。3) getDecryptedAuthToken() 関数は誤解を招くように暗号化を示していますが、プレーンテキストトークンを返します。4) 認証トークンとワークスペースの資格情報は、適切な認証チェックなしで IPC ハンドラーを介して公開されます。5) トークンローテーションメカニズムが存在しないため、侵害されたトークンが永続的な脅威となります。

### リスク
この脆弱性により、攻撃者は認証をバイパスし、ユーザーアカウントへの不正アクセスを取得できます。これにより、データの漏洩、アカウントの乗っ取り、および機密情報の改ざんが発生する可能性があります。また、攻撃者は、悪意のある操作を実行し、ユーザーをなりすます可能性があります。対策を講じないと、重大なセキュリティインシデントにつながる可能性があります。

### 対策
この脆弱性に対処するために、以下の対策を講じる必要があります:

•  **OAuth フローの改善**: PKCE OAuth フローのステートパラメータ検証を確実に実装し、currentAuthState が存在する場合にのみ実行されるようにします。
•  **トークンストレージの暗号化**: 認証トークンを暗号化された形式で保存するように変更します。安全なストレージメカニズムを使用し、キー管理を適切に実装します。
•  **IPC ハンドラーの認証**: IPC ハンドラーに適切な認証チェックを追加して、承認されたプロセスのみが機密データにアクセスできるようにします。ワークスペース資格情報へのアクセスを厳密に制限します。
•  **トークンローテーションの導入**: 定期的なトークンローテーションを実装して、侵害されたトークンの影響を軽減します。トークンの有効期限を適切に設定し、新しいトークンを定期的に発行します。
•  **getDecryptedAuthToken() の修正**: 関数名が誤解を招く可能性を避けるために、関数の名前を変更するか、プレーンテキストトークンを返す場合には、その動作を明確にドキュメント化します。

## 2. URLインジェクションによるサーバーサイドリクエストフォージェリ (SSRF) (深刻度: 緊急)

### 対象の機能
URLインジェクションによるサーバーサイドリクエストフォージェリ (SSRF)

### 該当箇所
- apps/electron/src/main/utils/fetch-utils.ts
- apps/electron/src/main/modules/workspace/platform-api-manager.ts
- apps/electron/src/main/modules/mcp-apps-manager/mcp-client.ts
- apps/electron/src/main/modules/mcp-server-manager/mcp-server-manager.ts
- apps/electron/src/main/modules/mcp-server-manager/mcp-server-manager.ipc.ts
- apps/electron/src/main/modules/system/system-handler.ts

Line 29-31 in fetch-utils.ts: const url = path.startsWith('http') ? path : `${apiBaseUrl}${path.startsWith('/') ? '' : '/'}${path}`; return fetch(url, options); OR Line 50 in mcp-client.ts: const transport = new StreamableHTTPClientTransport(new URL(server.remoteUrl)) OR Line 199 in platform-api-manager.ts: return this.currentWorkspace.remoteConfig.apiUrl;

### 説明
不十分なURL検証による複数のSSRF脆弱性: 1) `fetchWithToken`関数は、パスが'http'で始まる場合に任意のURLを許可します。2) リモートワークスペース設定は、APIリクエストに直接使用される任意の`apiUrl`値を許可します。3) MCPサーバー接続は、検証なしにユーザーが提供した`remoteUrl`パラメータを受け入れます。4) サーバー設定のテストとフィードバックの送信は、攻撃者が制御するエンドポイントへのリクエストを行います。これにより、内部サービスへのアクセス、ネットワークスキャン、資格情報の抽出、およびクラウドメタデータエンドポイントへのデータアクセスが可能になります。

### リスク
この脆弱性により、攻撃者は内部サービスにアクセスし、機密情報を盗み、内部ネットワークをスキャンし、場合によってはサーバーを完全に侵害する可能性があります。これは、データの漏洩、サービスの中断、および潜在的な財務的損失につながる可能性があります。

### 対策
この脆弱性を修正するには、次の対策を実装してください。• すべてのユーザー提供URLに対して厳格な検証を実施し、許可されたドメインのホワイトリストを使用します。• ユーザーからの入力を受け入れる前に、`apiUrl`を含むすべてのURLをサニタイズします。• リモートサーバーの構成に使用される`remoteUrl`パラメータをサニタイズします。• 内部リソースへのアクセスを制限し、SSRF攻撃が成功した場合の潜在的な影響を軽減します。• ネットワーク上で外部リクエストをブロックするファイアウォールルールを構成します。

## 3. トークン管理とアクセス制御バイパスの脆弱性 (深刻度: 緊急)

### 対象の機能
トークン管理とアクセス制御バイパスの脆弱性

### 該当箇所
- apps/electron/src/main/modules/mcp-apps-manager/token-manager.ts
- apps/electron/src/main/infrastructure/shared-config-manager.ts
- apps/electron/src/main/modules/mcp-server-manager/server-service.ts
- apps/electron/src/main/modules/mcp-server-manager/mcp-server-manager.ipc.ts

`TokenManager.validateToken()` は、トークンの存在のみをチェックし（50〜64行目）、有効期限を無視します。`shared-config-manager.ts` の `syncTokensWithWorkspaceServers()` は、すべてのサーバーIDを既存のトークンのserverAccessに自動的に追加します（354〜370行目）。移行コードは、すべてのワークスペースサーバーへのアクセスを許可します（222〜228行目）。`ServerService.addServer()` は、新しいサーバーへのアクセスをすべてのトークンに許可します（53〜70行目）。

### 説明
トークンとサーバー管理における重大な認証の欠陥。

• トークン有効期限メカニズムがないため、トークンは無期限に有効です。
• トークン生成は、適切な認証チェックなしに既存のトークンを削除します。
• `syncTokensWithWorkspaceServers()` は、許可検証なしに既存のトークンに対してすべてのワークスペースサーバーへのアクセスを自動的に付与します。
• データベース移行中、トークンは元の許可に関係なくすべてのサーバーへのアクセスを受け取ります。
• IPCハンドラーは、サーバーの開始/停止や設定の変更などの機密性の高い操作を実行する前に、許可検証を欠いています。

### リスク
この脆弱性により、攻撃者は未承認のアクセスを得て、機密データにアクセスしたり、システムを制御したりすることが可能になります。トークンが無期限に有効であるため、既存のトークンが削除されずに新しいサーバーへのアクセス権が自動的に付与されると、攻撃者は永続的なアクセス権を得て、システムを長期間にわたって侵害する可能性があります。データベース移行中や新しいサーバーが作成された際に、すべてのサーバーへのアクセス権がトークンに自動的に付与されることも、広範囲にわたる影響を引き起こす可能性があります。さらに、IPCハンドラーの認証チェックの欠如は、サーバーの制御や設定変更などの機密操作への不正アクセスを可能にし、さらなるリスクを高めます。

### 対策
この脆弱性を解決するための主な対策は次のとおりです。

• **トークン有効期限の実装**: トークンに有効期限を設け、定期的に失効させるメカニズムを導入します。有効期限が切れたトークンは無効化されるべきです。
• **トークン生成時の認証強化**: トークンを生成する際に、既存のトークンを削除する前に、適切な認証チェック（権限確認）を行うようにします。ユーザーが自分のトークンを削除する権限を持っていることを確認する必要があります。
• **アクセス制御の厳格化**: `syncTokensWithWorkspaceServers()` 関数やデータベース移行処理において、すべてのサーバーへの自動的なアクセス許可を付与するのではなく、適切な権限検証を行い、必要なアクセス権のみを付与するように変更します。
• **IPCハンドラーの認証**: IPCハンドラーで機密性の高い操作（サーバーの開始/停止、設定変更など）を実行する前に、必ず認証チェックを実施します。これにより、不正なアクセスを防ぎ、システムの安全性を高めます。

## 4. パス・トラバーサルとファイルシステムアクセス脆弱性 (深刻度: 緊急)

### 対象の機能
パス・トラバーサルとファイルシステムアクセス脆弱性

### 該当箇所
- apps/electron/src/main/utils/uri-utils.ts
- apps/electron/src/main/modules/mcp-server-runtime/request-handlers.ts
- mcp-router/mcp-router/apps/electron/src/main/modules/mcp-server-manager/dxt-processor/dxt-processor.ts
- mcp-router/mcp-router/apps/electron/src/main/modules/mcp-server-manager/dxt-processor/dxt-converter.ts
- apps/electron/src/main/modules/mcp-server-manager/mcp-server-manager.ipc.ts
- mcp-router/mcp-router/apps/electron/src/main/modules/workspace/workspace.service.ts
- mcp-router/mcp-router/apps/electron/src/main/infrastructure/database/sqlite-manager.ts

parseResourceUri() extracts path without validation: path: match[2] containing traversal sequences; workspace.service.ts constructs paths: path.join(app.getPath("userData"), dbPath) where dbPath contains "../../../etc/passwd"

### 説明
複数のコンポーネントにわたる複数のパス・トラバーサル脆弱性：1） `parseResourceUri` 関数は、リソースURIでパス・トラバーサルシーケンスを許可する不十分な正規表現検証を使用します。2） DXTファイル処理は、`unpackExtension()` と `expandPathVariables()` を介してパス検証なしで任意のファイル抽出を許可します。3）IPCハンドラーは、`server:selectFile` と任意のディレクトリ作成を介してファイルシステム操作を許可します。4）ワークスペースデータベースパスの構築は、トラバーサルシーケンスを含む可能性のあるユーザー制御の入力を利用します。これらの脆弱性により、不正なファイルアクセス、システムファイルの上書き、および悪意のある実行可能ファイルの配置が可能になります。

### リスク
この脆弱性の主なリスクは、攻撃者が任意のファイルにアクセスし、システムファイルを上書きし、悪意のある実行可能ファイルを配置できることです。これにより、システムが完全に侵害され、機密データが漏洩する可能性があります。影響範囲には、ユーザーアカウント、個人情報、およびシステム設定への不正アクセスが含まれます。

### 対策
この脆弱性を修正するには、以下の対策を講じる必要があります。•　すべてのパス入力を厳密に検証し、パス・トラバーサルシーケンスを拒否する。具体的には、`parseResourceUri` 関数で、抽出されたパスコンポーネントを安全に検証する正規表現を使用する。•　DXTファイル処理でパス検証を実装し、ファイルが意図したディレクトリ外に書き込まれないようにする。•　`server:selectFile` などのIPCハンドラーへの入力も検証する。•　ワークスペースデータベースパスの構築時に、ユーザー制御の入力からパス・トラバーサルシーケンスを除去するためのサニタイズを行う。•　ファイルシステムへのアクセスを制限するために、最小権限の原則を適用する。•　安全なファイルシステム操作ライブラリの使用を検討する。

## 5. フックおよびワークフローシステムを介した任意のコード実行 (深刻度: 緊急)

### 対象の機能
フックおよびワークフローシステムを介した任意のコード実行

### 該当箇所
- apps/electron/src/main/modules/workflow/hook.ipc.ts
- apps/electron/src/main/modules/workflow/workflow.ipc.ts
- apps/electron/src/main/modules/workflow/hook.service.ts
- apps/electron/src/main/modules/workflow/workflow-executor.ts
- mcp-router/mcp-router/apps/electron/src/main/modules/workflow/hook.repository.ts
- mcp-router/mcp-router/apps/electron/src/main/modules/workflow/workflow.repository.ts
- apps/electron/src/main/modules/mcp-server-runtime/request-handler-base.ts

hook.service.ts line 196: vmScript.runInContext(vmContext, {timeout: 5000}) - where vmContext contains escapable sandbox with Object/Array constructors allowing access to Node.js process object

### 説明
ワークフロー/フックシステムにおける重要なコード実行の脆弱性: 1) フックおよびワークフローIPCハンドラーは、適切なサンドボックス化なしに、メインプロセスのコンテキストで実行される任意のJavaScriptコードを受け入れます。 2) VMサンドボックスの実装が不十分であり、攻撃者はプロトタイプ汚染、コンストラクタ操作、またはNode.js組み込みモジュールへのアクセスを通じて脱出できます。 3) 保存されたフックスクリプトとワークフロー定義には、データベースから取得され、検証なしで実行される実行可能なJavaScriptが含まれています。 4) ワークフローの実行は、MCPリクエストの通常の認証/認可をバイパスします。 5) フックスクリプトは、トークンや機密データを含む広範なコンテキストを受け取ります。 これらにより、完全な権限昇格とシステム侵害が可能になります。

### リスク
この脆弱性は、攻撃者が任意のコードを実行することを可能にし、システムの完全な侵害につながる可能性があります。 攻撃者は、システムのすべてのデータにアクセスし、機密情報を盗み、他のシステムを侵害し、サービスの**DoS**を引き起こす可能性があります。 このような脆弱性は、企業にとって深刻な脅威となり、評判と財務に大きな損害を与える可能性があります。

### 対策
この脆弱性を修正するための解決策は、次のとおりです。まず、フックモジュールとワークフローのIPCハンドラーからの入力に対して、より厳密な検証とサニタイズを実装します。次に、JavaScriptコードを実行するためのより安全なサンドボックス環境を実装します。これは、Node.jsの組み込みモジュールへのアクセスを制限し、プロトタイプ汚染などの攻撃を防ぐように設計されている必要があります。また、データベースに保存されているフックスクリプトとワークフロー定義が、実行前に検証されることを確認してください。最後に、ワークフローの実行が通常の認証/認可プロセスをバイパスしないようにしてください。

## 6. 機密認証データの暗号化されていない保存 (深刻度: 緊急)

### 対象の機能
機密認証データの暗号化されていない保存

### 該当箇所
- mcp-router/mcp-router/apps/electron/src/main/modules/mcp-server-manager/mcp-server-manager.repository.ts
- mcp-router/mcp-router/apps/electron/src/main/modules/workspace/workspace.repository.ts
- mcp-router/mcp-router/apps/electron/src/main/modules/mcp-logger/mcp-logger.repository.ts
- mcp-router/mcp-router/apps/electron/src/main/modules/auth/auth.service.ts
- mcp-router/mcp-router/apps/electron/src/main/modules/settings/settings.repository.ts

1) mcp-server-manager.repository.ts の 235 行目: `bearer_token: bearerToken` はプレーンテキストトークンを保存します 2) shared-config-manager.ts の 117 行目: JSON.stringify はプレーンテキスト authToken をファイルに保存します 3) workspace.repository.ts の 160 行目: 暗号化なしの base64 でエンコードされたトークン 4) mcp-logger.repository.ts の 149 行目: JSON.stringify は機密リクエストパラメーターを保存する可能性があります

### 説明
機密認証トークン (ベアラトークン、認証トークン) が、暗号化なしでSQLiteデータベース内にプレーンテキストとして保存されています。トークンは、サーバー設定、ワークスペース設定、およびアプリケーション設定にプレーンJSONとして保存されます。リクエストログにもこれらのトークンがパラメーターまたはレスポンスに含まれる可能性があり、データベースアクセス、ログファイルの分析、バックアップの調査、またはメモリダンプを通じて複数のエクスポージャーベクトルが作成されます。

### リスク
この脆弱性の主なリスクは、攻撃者が認証トークンを盗み、その結果、アプリケーションに完全にアクセスできるようになることです。これは、機密情報の漏洩、データの改ざん、およびサービスの完全な侵害につながる可能性があります。

### 対策
この脆弱性を修正するための最優先事項は、すべての機密認証データを暗号化することです。これには、ベアラトークン、認証トークン、およびその他の機密資格情報が含まれます。

• 対称暗号化アルゴリズム（AESなど）を使用して、トークンを保存する前に暗号化します。
• 暗号化されたトークンを安全なストレージに保存します。
• キー管理を安全に実装し、暗号化キーを保護します。
• 可能であれば、トークンの有効期間を短くし、定期的にローテーションします。
• リクエストログから機密認証データを削除します。

さらに、アプリケーション設定とログに機密データがプレーンテキストで保存されていないことを確認してください。

## 7. HTTP サーバー入力処理の脆弱性 (深刻度: 高)

### 対象の機能
HTTP サーバー入力処理の脆弱性

### 該当箇所
- apps/electron/src/main/modules/mcp-server-runtime/http/mcp-http-server.ts

```
Lines 76-80: const tokenId = typeof token === "string" ? token.startsWith("Bearer ") ? token.substring(7) : token : ""; and Lines 184: skipValidation: platformManager.isRemoteWorkspace() in resolveProjectFilter method
```

### 説明
HTTPサーバーの処理における複数の入力検証の欠陥:

1) Bearer トークン認証には二重の処理ロジック（58～61行目と76～80行目）があり、認証をバイパスする可能性のある、一貫性のない検証動作を引き起こしています。
2) resolveProjectFilter メソッドは、プロジェクトヘッダーの値に対して不十分な検証を行っており、基本的なトリミングのみを実行し、最初の配列要素を取得しています。これにより、特に検証が完全にスキップされるリモートワークスペースモードでは、プロジェクトヘッダーインジェクションによりアクセス制御をバイパスする可能性があります。

### リスク
この脆弱性は、不正なアクセス制御につながる可能性があります。攻撃者は、認証をバイパスして、機密データにアクセスしたり、システム上で不正な操作を実行したりする可能性があります。プロジェクトヘッダーインジェクション攻撃は、特にリモートワークスペースモードで、意図しないプロジェクトへのアクセスを可能にし、さらなる攻撃につなげられる可能性があります。

### 対策
この脆弱性を修正するには、以下の対策を講じる必要があります。

•  **Bearer トークン認証の修正:** 一貫性のある認証ロジックを実装し、トークン処理の一貫性を確保してください。トークンの処理と検証において、同じトークン変数を使用するように修正してください。
•  **プロジェクトヘッダー検証の強化:** プロジェクトヘッダーの検証を強化し、潜在的なインジェクション攻撃を防いでください。ヘッダー値の適切な検証を行い、不正な値が使用されないようにしてください。リモートワークスペースモードでも、適切な検証が行われるように実装を変更してください。
•  **入力検証の徹底:** HTTP サーバーへのすべての入力に対して、厳密な入力検証を実行してください。これにより、不正な入力がシステムに影響を与えるのを防ぐことができます。

## 8. ワークフローエンジンにおけるDoSと情報漏洩 (深刻度: 高)

### 対象の機能
ワークフローエンジン

### 該当箇所
- apps/electron/src/main/modules/workflow/workflow-executor.ts
- apps/electron/src/main/modules/workflow/hook.service.ts
- apps/electron/src/main/modules/workflow/workflow.service.ts
- apps/electron/src/main/modules/mcp-server-runtime/request-handler-base.ts

`hook.service.ts:196-203` のフックスクリプト実行において、`vmScript.runInContext(vmContext, {timeout: 5000})` が、トークン、クライアントID、MCPレスポンスを含むコンテキストデータへの完全なアクセス権を持つユーザー提供のスクリプトを実行し、漏洩のためにログに記録または返却される可能性があります。

### 説明
ワークフローシステムにおけるDoSとデータ漏洩につながる脆弱性。
1) ワークフローグラフにサイクルがあると、`determineExecutionOrder()` で検出をバイパスし、無限実行を引き起こす可能性があります。2) ワークフローの複雑性が過度であると、BFS/トポロジカルソート処理においてアルゴリズム的なDoSを引き起こします。3) 無限ループまたはリソースを大量に消費する操作を含むフックスクリプトは、タイムアウトにもかかわらず、CPU/メモリを大量に消費します。4) フックスクリプトは、MCPパラメータ、クライアントID、トークン、内部状態を含む機密性の高いコンテキスト情報を受け取り、コンソールログ記録または戻り値操作を通じて漏洩させる可能性があります。

### リスク
この脆弱性の主なリスクは、攻撃者がDoSを引き起こし、また、ワークフロー内の機密性の高いコンテキストデータを盗み出すことができることです。このデータには、MCPパラメータ、クライアントID、トークン、内部状態が含まれており、これらは、不正アクセス、アカウントの乗っ取り、またはその他の悪意のある活動に使用される可能性があります。DoS攻撃は、ワークフローエンジンの可用性に影響を与え、サービスの中断やパフォーマンスの低下につながる可能性があります。この脆弱性の潜在的な影響は、データの機密性と可用性の両方に関係し、高いリスクをもたらします。

### 対策
この脆弱性を修正するための推奨事項は次のとおりです。
• ワークフローグラフのサイクル検出を強化し、無限実行を防止する。
• ワークフローの複雑性を制限し、アルゴリズムDoSを回避する。
• フックスクリプトの実行をより厳密に制御し、リソースを大量に消費する操作や無限ループを防止する。
• フックスクリプトがアクセスできるコンテキストデータの範囲を制限し、機密データの漏洩を防ぐ。
• コンテキストデータのエスケープと検証を実装して、情報漏洩のリスクを軽減する。
