1. OAuth/認証トークンの脆弱性（緊急）

- apps/electron/src/main/modules/auth/auth.service.ts:94 — handleAuthToken のステート検証を厳格化（state/currentAuthState未設定時は拒否）。引数名もcodeへ明確化。
- apps/electron/src/main/modules/auth/auth.service.ts:223 — getDecryptedAuthToken は平文返却。実際に暗号化実装へ変更、もしくは関数名/仕様の整合。
- apps/electron/src/main/modules/auth/auth.service.ts:255 — status() が token を返すのを停止（レンダラーへトークン渡さない）。
- apps/electron/src/main/modules/auth/auth.ipc.ts:22 — auth:status の返り値からトークン等の秘匿情報排除。認可チェックの導入。
- apps/electron/src/main/modules/auth/auth.ipc.ts:36 — auth:handle-token 呼出し元検証/レート制限/再入防止。
- apps/electron/src/main/modules/workspace/workspace.ipc.ts:50 — workspace:get-credentials の廃止か認可ガード（UIへ資格情報を出さない）。
- apps/electron/src/main/infrastructure/shared-config-manager.ts:104 — 設定保存（saveConfig）で平文保存→安全保管（OS Keychain/Keytarや暗号化+安全な鍵管理）。
- apps/electron/src/preload.ts:160 — getWorkspaceCredentials や onAuthStatusChanged の露出内容見直し（秘匿情報を橋渡ししない）。
- apps/electron/src/main.ts:444 — handleProtocolUrl の受け取る mcpr:// URL を用途限定で厳格パース（認証フロー以外は拒否）。

2. SSRF（URLインジェクション）（緊急）

- apps/electron/src/main/utils/fetch-utils.ts:28 — http/https 始まりの任意URL許容を廃止。許可リストベースのベースURL連結のみ許可。
- apps/electron/src/main/modules/mcp-apps-manager/mcp-client.ts:50 — new URL(server.remoteUrl) の前にスキーム/ホスト/パス検証（https限定、内部/ローカル禁止等）。
- apps/electron/src/main/modules/mcp-apps-manager/mcp-client.ts:81 — SSEの remoteUrl も同様に検証。
- apps/electron/src/main/modules/workspace/platform-api-manager.ts:208 — remoteConfig.apiUrl を採用する前に保存時/読取時の検証（許可ドメイン/スキーム）。
- apps/electron/src/main/modules/mcp-server-manager/mcp-server-manager.ipc.ts:26 — 追加/更新時に remoteUrl/bearerToken の厳格バリデーション（プロトコル、ポート、プライベートアドレス禁止）。
- apps/electron/src/main/modules/system/system-handler.ts:30 — フィードバック送信先は固定のみ許可。将来の設定化時は厳格バリデーション。

3. トークン管理/アクセス制御バイパス（緊急）

- apps/electron/src/main/modules/mcp-apps-manager/token-manager.ts:46 — validateToken に有効期限・失効・スコープ検証を追加。
- apps/electron/src/main/modules/mcp-apps-manager/token-manager.ts:13 — 生成トークンへ expiresAt 等の期限/ローテーション属性付与。
- apps/electron/src/main/modules/mcp-server-manager/server-service.ts:41 — 新規サーバー時に全トークンへ自動許可付与を削除（明示的許可フローへ）。
- apps/electron/src/main/infrastructure/shared-config-manager.ts:351 — syncTokensWithWorkspaceServers による一括許可付与の廃止/同意ベース。
- apps/electron/src/main/infrastructure/shared-config-manager.ts:222 — マイグレーション時「全サーバー付与」を廃止（最小権限での移行）。
- apps/electron/src/main/modules/mcp-server-manager/mcp-server-manager.ipc.ts:9 — 開始/停止/更新系IPCに認可チェック導入。

4. パス・トラバーサル/FSアクセス（緊急）

- apps/electron/src/main/utils/uri-utils.ts:10 — parseResourceUri の path に ../スキーム混入を許さない正規化/検証。
- apps/electron/src/main/modules/mcp-server-runtime/request-handlers.ts:435 — readResourceByUri で createUriVariants に生のパスを渡す前に許可スキーム/サーバ側制約を適用。
- apps/electron/src/main/modules/mcp-server-manager/dxt-processor/dxt-processor.ts:45 — unpackExtension 抽出先の脱出防止（Zip Slip対策、展開先検証）。
- apps/electron/src/main/modules/mcp-server-manager/dxt-processor/dxt-converter.ts:162 — パス変数展開後に正規化と許可ディレクトリ外排除。
- apps/electron/src/main/modules/mcp-server-manager/mcp-server-manager.ipc.ts:91 — server:selectFile の受け入れ制限（mode/filters強制、パス検証）。
- apps/electron/src/main/modules/workspace/workspace.service.ts:432 — databasePath をユーザー入力にさせない/正規化（トラバーサル拒否）。
- apps/electron/src/main/infrastructure/database/sqlite-manager.ts:17 — 相対入力時のパス合成で正規化と検査（.. 排除）。

5. フック/ワークフロー経由の任意コード実行（緊急）

- apps/electron/src/main/modules/workflow/hook.service.ts:206 — vm.runInContext サンドボックス強化（Object/Array/Pipelineの凍結、require/プロセス遮断、I/O禁止）。
- apps/electron/src/main/modules/workflow/hook.ipc.ts:10 — 作成/更新/実行IPCに厳格バリデーションと認可（管理者のみ等）。
- apps/electron/src/main/modules/workflow/workflow.ipc.ts:10 — 同上（有効化/実行時の検証）。
- apps/electron/src/main/modules/mcp-server-runtime/request-handler-base.ts:39 — ワークフロー実行コンテキストからトークン/機密除去、またはダミー化。
- apps/electron/src/main/modules/workflow/workflow.repository.ts:... — 保存前のスクリプト検証/署名/サイズ上限等の防御策。

6. 機密データの平文保存（緊急）

- apps/electron/src/main/modules/mcp-server-manager/mcp-server-manager.repository.ts:235 — bearer_token を暗号化保存（Keytar等、KMSが望ましい）。
- apps/electron/src/main/infrastructure/shared-config-manager.ts:116 — settings.authToken 等をファイルへ平文保存しない（安全保管へ移行）。
- apps/electron/src/main/modules/workspace/workspace.repository.ts:160 — Base64疑似「暗号化」を廃止。真正な暗号化＋鍵管理に変更。
- apps/electron/src/main/modules/mcp-logger/mcp-logger.repository.ts:146 — request_params/response_data に秘匿情報混入を除去/マスキング、必要最小限のみ保存。
- apps/electron/src/renderer/stores/auth-store.ts:122 — レンダラー状態に authToken を保持しない（必要時のみ一時メモリ、極力メイン側処理）。

7. HTTPサーバー入力処理（高）

- apps/electron/src/main/modules/mcp-server-runtime/http/mcp-http-server.ts:56 — Bearerトークン処理の二重/不整合を統一（前処理/後処理の一本化）。
- apps/electron/src/main/modules/mcp-server-runtime/http/mcp-http-server.ts:110 — resolveProjectFilter の検証強化（フォーマット/長さ/存在確認、remoteでも検証をスキップしない）。
- apps/electron/src/main/modules/mcp-server-runtime/http/mcp-http-server.ts:47 — cors() を許可オリジン限定へ。express.json({limit}) でサイズ制限。
- apps/electron/src/main/modules/mcp-server-runtime/http/mcp-http-server.ts:390 — listen(port) を listen(port, '127.0.0.1') へ（ローカルバインド）。TLS導入も検討。
- apps/electron/src/main/modules/mcp-server-runtime/http/mcp-http-server.ts:145 — _meta.token 付与を廃止/最小化（下流/ログへ秘匿情報を流さない）。

8. ワークフローのDoS/情報漏洩（高）

- apps/electron/src/main/modules/workflow/workflow-executor.ts:210 — グラフ検証を強化（サイクル検出の堅牢化、ノード/エッジ上限、タイムアウト/ステップ制限）。
- apps/electron/src/main/modules/workflow/hook.service.ts:206 — フックスクリプトのCPU/メモリ消費制限、実行回数・最大出力制限。
- apps/electron/src/main/modules/mcp-server-runtime/request-handler-base.ts:39 — コンテキスト/ログから機密情報を除去（最小限メタのみ）。
- apps/electron/src/main/modules/workflow/workflow.service.ts:119 — 有効化時の検証を厳格化（構造/負荷/権限チェックを必須化）。

補足（推奨の横断対応）

- apps/electron/src/main.ts:295 — CSPは本番で unsafe-eval/unsafe-inline を禁止。開発時のみ緩める。
- apps/electron/src/renderer/components/mcp/apps/McpAppsManager.tsx:303 — dangerouslySetInnerHTML の除去か厳格サニタイズ（XSS対策）。
- 全IPCに入力スキーマ検証（zod等）と認可ガード、レート制限を導入。ログは秘匿情報を常時マスク。

必要なら、このリストをチェックリスト化（優先度/工数見積もり付き）や、具体的な修正PRの下準備まで対応します。
