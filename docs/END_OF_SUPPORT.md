# MCP Router end of support / サポート終了

MCP Router development, support and security updates ended on **September 18, 2026**. Version **0.6.4** is the final desktop release for existing users. New adoption is not recommended.

The cloud service, sign-in, cloud sync, billing and feedback submission have ended. Existing local MCP connections and saved settings remain available. The final release does not delete local data or disable local MCP servers. It stops automatic update checks and usage analytics. Previously installed versions are not remotely disabled.

## Migration and backup

1. Open the desktop app and choose **Continue using local features**.
2. Select each **local workspace** and use **Export** on the **Servers** screen. Export applies to the selected workspace.
3. Check the exported JSON before importing it into another MCP client. It is a server configuration export, not a complete application backup: workflows, logs, skills, app tokens and other application settings are not included. Confirm remote server URLs and authentication separately.
4. Keep exports private because environment variables can contain credentials. Test the destination client before removing MCP Router.
5. For a full backup, quit MCP Router and copy its entire application data directory (`app.getPath('userData')`): normally `~/Library/Application Support/MCP Router` on macOS or `%APPDATA%/MCP Router` on Windows. Preserve any externally stored skill files too. OS-encrypted secrets may only be readable on the original machine/account.

Historical release assets and source remain available for existing users and forks. They are unsupported and will receive no further security fixes. A GitHub archive is read-only; it does not delete source, releases or local data. No replacement product is required to continue using local features.

---

MCP Router は **2026年9月18日**をもって開発・サポート・セキュリティ更新を終了しました。**v0.6.4** は既存ユーザー向けの最終版です。新規利用は推奨しません。

クラウドサービス・ログイン・クラウド同期・課金・フィードバック送信は終了しています。保存済み設定とローカル MCP 接続は残ります。最終版はローカルデータを削除せず、自動更新確認と利用状況の送信を停止します。旧版を遠隔停止することはありません。

## 移行とバックアップ

1. 起動時に「ローカル機能を使い続ける」を選びます。
2. **ローカルワークスペースごと**に、**サーバー画面の Export** から設定を書き出します。
3. JSON の内容を確認して移行先へ取り込みます。これはサーバー設定の書き出しであり、ワークフロー・ログ・スキル・アプリ用トークンなどを含む完全バックアップではありません。リモートサーバーの URL・認証情報は別途確認してください。
4. 環境変数に認証情報が含まれる場合があるため、出力ファイルは非公開で保管してください。移行先で動作確認してから旧アプリを削除してください。
5. 完全バックアップが必要な場合はアプリを終了し、アプリデータフォルダー全体をコピーしてください。通常は macOS の `~/Library/Application Support/MCP Router`、Windows の `%APPDATA%/MCP Router` です。外部に配置したスキルファイルも保管してください。OS によって暗号化された認証情報は元の端末・アカウントでしか復号できない場合があります。

過去の配布物とソースは、既存ユーザーとフォークのための履歴として残します。保守・セキュリティ修正の提供はありません。
