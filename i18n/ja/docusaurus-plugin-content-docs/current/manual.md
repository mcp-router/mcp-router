# MCP Router
### 開発版です
## 概要
MCP Router は **Model Context Protocol (MCP)** サーバーを 1 ヶ所で安全に管理・可視化できる無料デスクトップ／CLI アプリです。従来は Cursor や Claude など各アプリが個別に MCP サーバーを動かしていましたが、MCP Router をハブにすると **アクセス制御・ログ管理を一元化** でき、安全性と UX を同時に向上させます。Mac と Windows に正式対応し、Linux 版も開発中です。

---

## 特長
| 機能 | 説明 | 
|------|------|
| MCP Index | 誰でも MCP サーバーを登録でき、GUI から検索・発見が可能 |
| ワンクリック追加 | 登録済みサーバーをボタン 1 つでインストール・起動 |
| ユニバーサル接続 | リモート／ローカルを問わず Zapier・Smithy など *あらゆる* MCP サーバーと接続
| トークン認可 | アプリごとに発行する **MCPR_TOKEN** で利用サーバーを細粒度に制限 | 
| 自動ログ保存＆グラフ | いつ・どのアプリが・どのサーバーを使ったかを自動記録し可視化 | 
| MCP Aggregator Server | 起動中の MCP サーバー群を 1 つのエンドポイントに束ね、`mcpr connect` で利用 | 
| 1-Click クライアント連携 | Claude Desktop / Cursor / Cline / Windsurf などへ即導入 | 
| クロスプラットフォーム | macOS・Windows 版公開、Linux 版 β 予定 | 
| **GUI & CLI** | デスクトップGUIと'mcpr-cli'の療法を同梱。CI/CDでも利用可 |

---
# アーキテクチャ
1.LLM Apps（Claude 等）は mcpr connect で MCP Router に接続し、発行されたトークンで許可されたサーバーだけを呼び出します。

2.MCP Router は起動／停止・環境変数設定を GUI で操作しつつ、各サーバーのメタデータを MCP Aggregator Server に登録。

3.Aggregator が 1 つのエンドポイントとしてツール・リソース・プロンプトを束ね、呼び出し時のログを Router が集約します。
![architecture.png]


# インストール

[公式サイト](mcp-router.net/install)からダウンロード
もしくはGitHubの[Releases](github.com/mcp-router/mcp-router/releases)ページからダウンロード

初回起動時に**アクティベーションコード**を入力して利用開始

## MCPサーバーの追加・起動

- アプリ右上**"servers"**から
  - JSON読み込み *または*
  - Discover ページでワンクリックインストール -> **start**で起動

## CLIから接続

'''bash
curl -L https://mcp-router.net/download/latest | bash    # または GUI 版をダウンロード
このURLは間違っているため注意。コマンドラインはデスクトップ版をインストールするとついてくる？

基本操作への導線を貼る

## アクティベーションコードの入手方法

| 手順 | 方法 | 備考 |
|------|------|------|
| 1 | **Discord 公式コミュニティに参加** | 開発チームが運営する Discord サーバー（<https://discord.com/invite/dwG9jPrhxB>）で、コード配布チャンネルが用意されています。そこからアクティベーションコードを入手することができます。|
| 2 | **既存ユーザーから招待を受ける** | MCP Router は現在 *招待* によってコードを得ることができます。利用中の友人や同僚にコードを発行してもらってください。
| 3 | **ブログ／SNSの限定コードを利用** | 公式ブログ（Zenn など）や X (Twitter) で、期間限定・読者限定のコードがときどき公開されます。最新投稿をチェックしてからコピーしてください。 |
| 4 | **コード取得後の流れ** | アプリ初回起動時のダイアログにコードを貼り付け → 「Activate」をクリック → 完了。以後は入力不要です。招待したユーザーも 30 名まで友人を招待できます。 |

これで MCP Router をアクティベートして利用開始できます。

# チュートリアル

## 基本操作
```bash

##  サーバー追加
mcpr-cli add github   # 例: GitHub MCP サーバーを登録
mcpr-cli add fs       # 例: FileSystem MCP サーバーを登録

##  トークン発行 & 接続
mcpr-cli token create --name "claude desktop" --allow github,fs
export MCPR_TOKEN=mcpr_xxxxxxxxx
npx mcpr-cli connect    # Aggregator に接続

またはmcpServers設定に以下を追記します

{
  "mcp-router":{
    "command": "npx"
	"args": ["-y","mcpr-cli","connect"],
	"env": { "MCPR_TOKEN": "発行したトークン"}
  }
}

## チュートリアル：Claude Desktop で React アプリを生成
	-Router で FileSystem と GitHub MCP サーバーを追加→設定
	-「トークン」画面で claude desktop 用トークンを発行
	-Claude 設定ファイルに以下を追記し保存
'''json
{
  "mcpServers": {
    "mcpr-cli": {
      "command": "npx",
      "args": ["-y", "mcpr-cli", "connect"],
      "env": { "MCPR_TOKEN": "mcpr_eefc51bd" }
    }
  }
}
'''
    -Claude で “ローカルに React アプリを作り GitHub へ push” と依頼
	-Router のログ画面で FileSystem / GitHub の呼び出し回数を確認
	-GitHub への push まで一気に自動化でき、呼び出し履歴も可視化されます。

## よくある質問

# ユースケース(example)
- 完全オフラインで使用可能
- 自分の好きなmcpサーバーを追加・管理
- リクエスト・レスポンスのログ可視化

| シナリオ              | 詳細                                                                   |
| ----------------- | -------------------------------------------------------------------- |
| **ローカル開発環境の統合**   | 自前の FileSystem + GitHub サーバーをまとめ、Claude Desktop から安全に呼び出し([Zenn][1]) |
| **チーム/社内共有**      | Router が発行するトークンで部門ごとに利用サーバーやログ閲覧権限を分離                               |
| **オンプレ + クラウド統合** | 社内 DC の Private MCP と SaaS の Public MCP を 1 クリックで切替え                 |
| **運用モニタリング**      | どの時間帯にどのツールが呼ばれたかをグラフでダッシュボード表示([Zenn][2], [Zenn][1])                |

[1]: https://zenn.dev/scich/articles/a1d5873fa08045 "MCP Router ✖️ Claude Desktopでコーディングしてみる"
[2]: https://zenn.dev/scich/articles/77c077aaf85fe0 "MCP Routerを公開します！ ← 公開しました"


# 最近のアップデート 

| 月            | 主な追加機能                                                                                                         | 次期予定                                                      |
| ------------- | -------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------- |
| 2025 年 5 月 | ローカル API で MCP サーバー／ログ管理、データ暗号化（ローカル保存）、招待枠 30 人、ログイン時クレジット付与キャンペーン | **クレジットの利用先公開** などサプライズ機能 ([X][3]) |
| 2025 年 4 月 | リモート MCP (SSE) 対応、JSON 読み込み、バージョン固定、UI 改善、月次ブログ開始                                         | **Linux 公式対応**、開発者向け新機能、ログダッシュボード拡充 ([Zenn][1]) |
| 2025 年 3 月 | MCP Index・Aggregator・トークン認可・自動ログを実装                                                           | -- ([Zenn][2])                                                |

[1]: https://zenn.dev/mcp_router/articles/90362e2b7fd13d "〖4月〗MCP Routerの現在地"
[2]: https://zenn.dev/scich/articles/77c077aaf85fe0 "MCP Routerを公開します！ ← 公開しました"
[3]: https://twitter.com/mcp_router/status/1922224912837837063 "2025/05/13 アップデート告知ポスト"

# ロードマップ

# コミュニティ & サポート

    GitHub Issues — バグ報告・機能要望

    Discord — リアルタイム Q&A と招待コード配布

    X (Twitter) @mcp_router — 開発進捗とリリース情報



### 参照サイト
https://mcp-router.net/ja
https://github.com/mcp-router/mcp-router
https://docs.mcp-router.net/

https://zenn.dev/mcp_router/articles/90362e2b7fd13d
https://zenn.dev/scich/articles/77c077aaf85fe0
https://zenn.dev/mcp_router/articles/90362e2b7fd13d
