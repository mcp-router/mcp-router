# MCPサーバ情報のCloud Sync（E2E暗号化JSON一括）設計

## TL;DR
- 既存のJSON Export形式をそのまま暗号化し、全ワークスペース分を1つの暗号化ブロブとして保存する（ワークスペース一覧も同梱）。
- 鍵はパスフレーズからKDFで直接導出し、クラウドは復号不可。
- 同期は全体置き換え。競合はサーバ時刻ベースのLWW（最終更新勝ち）で解決する。

## 背景 / 現状
- MCPサーバ設定はローカルの SQLite に平文で保持されている。
- リモートワークスペース/クラウド側に保存される場合、機密情報（`bearerToken`/`env`/`remoteUrl`）が平文で扱われるリスクがある。
- 複数デバイスで同一のサーバ設定を使うニーズがあるが、現状は安全なクラウド同期機構がない。

## ゴール / 非ゴール
- ゴール
  - MCPサーバ情報をE2E暗号化した状態でクラウド保存・同期できる。
  - デバイス追加時に復号キーを安全に復元できる（パスフレーズ/リカバリコード）。
  - ローカルの既存UI/操作フローを大きく変えずに導入できる。
- 非ゴール
  - クラウド側でのサーバ設定検索/フィルタリング（暗号文のみのため）。
  - 共有/共同編集（チーム内共有鍵管理は別途設計）。
  - `authToken` や `localConfig` など端末依存・機密情報のクラウド共有。
  - クライアント侵害やOSレベルのマルウェア耐性。

## 脅威モデル
- 想定攻撃者: クラウド運用者、クラウドDBの漏洩、通信経路の盗聴。
- 非対応: クライアント端末の完全侵害、ユーザー自身のパスフレーズ漏洩。

## アーキテクチャ概要
### ローカル (Electron/Router)
- `WorkspaceService`: 既存のローカル workspace 一覧（`mcprouter.db`）を提供する。
- `WorkspaceBundleSerializer`: Workspace一覧と各Workspaceのサーバ設定を1つのJSONにまとめる（サーバ設定は既存Export形式）。
- `E2EKeyManager`: パスフレーズからのKDFとパラメータ管理を担当。
- `ServerConfigBundleSerializer`: 既存のJSON Export/Import形式で一括シリアライズ/復元。
- `ServerVaultBlobSyncService`: 変更検知・暗号化・全体同期・復号反映を担当（ワークスペース単位の同期は行わない）。
- `ServerVaultClient`: クラウドAPIの呼び出し。

### クラウド
- `server_vault_blob`: 暗号化されたJSONブロブの保存領域（復号不可）。
- `vault` API: ブロブ取得/更新を提供。

## 暗号化設計
### キー導出 (KDF)
- パスフレーズから `Argon2id` で 32バイト鍵を導出する。
- `kdf_salt` はブロブと一緒に保存する。
- 鍵ローテーションは行わず、パスフレーズ変更時は再暗号化する。

### データ暗号化
- アルゴリズム: `AES-256-GCM`（12バイトnonce）。
- 暗号化対象: Workspace一覧と各Workspaceのサーバ設定（サーバ設定は既存のJSON Export形式）。
- `nonce` と `kdf_salt` は平文で保存する。
- 形式例:
  ```json
  {
    "nonce": "base64",
    "ciphertext": "base64",
    "schemaVersion": 1,
    "updatedAt": "2025-01-01T00:00:00Z",
    "kdf": "argon2id",
    "kdfSalt": "base64"
  }
  ```

## データモデル

### クラウド（server_vault_blob）
- 1ユーザーにつき1行を保持する。
- `ciphertext` (base64)
- `nonce` (base64)
- `schema_version`
- `updated_at`
- `size_bytes`
- `kdf` ("argon2id")
- `kdf_salt` (base64)

### ローカル（CloudSyncMetadata）
- `lastSyncedAt`: 最後に同期成功した時刻（サーバのupdatedAt）
- `localModifiedAt`: ローカルで最後に変更した時刻

## API 設計（例: tRPC / REST 共通）
### サーバ設定同期（JSONブロブ）
- `GET /vault/servers/blob`
- `PUT /vault/servers/blob`
  ```ts
  type WorkspaceBundleEntry = {
    id: string;
    name: string;
    type: "local" | "remote";
    remoteConfig?: {
      apiUrl: string;
    };
    // 既存のJSON Export形式（ローカルworkspaceのみ）
    mcpServers?: Record<
      string,
      {
        command: string;
        args: string[];
        env: Record<string, string>;
      }
    >;
  };
  type WorkspaceBundlePayload = {
    workspaces: WorkspaceBundleEntry[];
  };
  type BlobEnvelope = {
    nonce: string;
    ciphertext: string;
    schemaVersion: number;
    updatedAt: string;
    kdf: "argon2id";
    kdfSalt: string;
  };
  type PutRequest = { blob: BlobEnvelope };
  type PutResponse = BlobEnvelope;
  type GetResponse = BlobEnvelope | null;
  ```
- `authToken` や `localConfig` はPayloadに含めない（再ログイン/端末ローカルで生成）。

## 同期フロー（改善版：タイムスタンプベースの自動同期）

### 変更検知と追跡
1. **変更検知**: いずれかのローカルWorkspaceで create/update/delete が発生したら:
   - `localModifiedAt` を現在時刻に更新
   - `dirty` フラグを立てる
2. **メタデータ管理**:
   - `lastSyncedAt`: 最後に同期成功した時刻（サーバのupdatedAt）
   - `localModifiedAt`: ローカルで最後に変更した時刻

### 自動同期ロジック（syncNow）
```typescript
async function autoSync() {
  const remote = await fetchRemoteBlob();
  const localBundle = await serializeWorkspaceBundle();
  
  // ケース1: 変更なし
  if (remote.updatedAt <= lastSyncedAt && localModifiedAt <= lastSyncedAt) {
    return "no_changes";
  }
  
  // ケース2: ローカルのみ変更
  if (remote.updatedAt <= lastSyncedAt) {
    // ローカルの変更をプッシュ
    const encrypted = await encrypt(localBundle);
    const response = await pushBlob(encrypted);
    updateMetadata(response.updatedAt);
    return "pushed";
  }
  
  // ケース3: リモートのみ変更
  if (localModifiedAt <= lastSyncedAt) {
    // リモートの変更を適用
    const plaintext = await decrypt(remote);
    await applyWorkspaceBundle(plaintext);
    updateMetadata(remote.updatedAt);
    return "pulled";
  }
  
  // ケース4: 両方変更（競合）
  // タイムスタンプ比較で決定的に解決
  if (localModifiedAt > remote.updatedAt) {
    // ローカルが新しい → ローカルを優先
    const encrypted = await encrypt(localBundle);
    const response = await pushBlob(encrypted);
    updateMetadata(response.updatedAt);
    return "pushed";
  } else {
    // リモートが新しい → リモートを優先
    const plaintext = await decrypt(remote);
    await applyWorkspaceBundle(plaintext);
    updateMetadata(remote.updatedAt);
    return "pulled";
  }
}
```

### データ収集とバンドル化
1. ローカルWorkspace一覧（`mcprouter.db`）と各Workspaceのサーバ設定を収集（`type=local` のみ）
2. `WorkspaceBundleSerializer` で1つのJSONにまとめる
3. JSON文字列を `AES-256-GCM` で暗号化し `BlobEnvelope` を生成

### 適用時の処理
1. Workspace一覧は upsert し、Payloadに存在しないWorkspaceは削除（`local-default` は除外）
2. 各Workspaceのサーバ設定は全体置換でインポート
3. メタデータ（lastSyncedAt）を更新

### エラー処理
- 復号失敗: 「鍵不足」扱いで UI に警告表示
- ネットワークエラー: 次回同期時にリトライ
- 競合解決: タイムスタンプベースで自動解決（ユーザー介入不要）

## UI / UX
- 設定画面に「Cloud Sync（E2E）」トグルを追加。
- 初回有効化時にパスフレーズとリカバリコードを表示。
- 新デバイスではパスフレーズ入力で鍵を復元。
- Syncは全ワークスペースを対象に実行する（ON/OFFは全体のみ）。
- remote workspace は一覧のみ同期し、利用時に再ログインを求める。
- 同期状態（最終同期時刻/失敗）を表示。

## ログ / 計測
- 同期のログ/計測は行わない。

## 移行
- 新規機能のため移行は不要。

## テスト計画
- 暗号化/復号ユニットテスト（nonce重複を禁止すること）。
- 2デバイス同期テスト（全体置換の競合、サーバ時刻LWWの反映）。
- 通信断/401/403時の再試行とUI表示。

## オープン課題
- パスフレーズ必須とするか（UXとのトレードオフ）。
- チーム共有（複数ユーザー）への拡張設計。
- ローカル暗号化との統合（safeStorage/keytarの採用方針）。
