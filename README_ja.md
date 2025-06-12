<h1 align="center">MCP Router</h1>
<h3 align="center">統一されたMCPサーバ管理アプリ</h3>

<div align="center">

[![GitHub stars](https://img.shields.io/github/stars/mcp-router/mcp-router?style=flat&logo=github&label=Star)](https://github.com/mcp-router/mcp-router)
[![Discord](https://img.shields.io/badge/Discord-参加する-7289DA?style=flat&logo=discord)](https://discord.com/invite/dwG9jPrhxB)
[![X](https://img.shields.io/badge/X(Twitter)-@mcp__router-1DA1F2?style=flat&logo=x)](https://twitter.com/mcp_router)

[[English](https://github.com/mcp-router/mcp-router/blob/main/README.md) | 日本語]

</div>

<div align="center">
  <img src="https://raw.githubusercontent.com/mcp-router/mcp-router/main/docs/static/img/readme/intro.gif" alt="MCP Router デモ" width="80%">
</div>

## 🎯 概要

**MCP Router**は、Model Context Protocol (MCP) サーバの管理を簡素化するWindows・macOS向けの無料デスクトップアプリケーションです。

### ✨ 主な特徴

- 🔐 **セキュア** - アクセス制御の管理とすべてのMCPサーバインタラクションの監視
- 🌐 **ユニバーサル** - あらゆるレジストリのMCPサーバに接続可能
- 🖥️ **クロスプラットフォーム** - WindowsとmacOSに対応
- 🤖 **AI Agent機能** - MCPツールを使えるAI Agentを作成・共有・利用でき、作成したAgentをMCPサーバとして他のアプリで利用可能

## 🔒 プライバシーとセキュリティ

### データはローカルに保存
- ✅ **すべてのデータはローカル保存** - リクエストログ、設定、サーバデータはすべてお使いのデバイスに保存されます
- ✅ **機密情報の安全性** - MCPのAPIキーや認証情報はローカルに保存され、外部に送信されることはありません
- ✅ **完全な制御** - MCPサーバ接続とデータを完全にコントロールできます

### オープンソースの透明性
- 🔍 **監査可能なアプリケーション** - デスクトップアプリケーションのソースコードをGitHubで公開しています
- 🛡️ **検証可能なプライバシー** - アプリケーションコードを確認することで、データがローカルに保存されることを検証できます
- 🤝 **コミュニティ主導** - セキュリティの改善や監査をコミュニティから歓迎します


## 📥 インストール

[インストールページ](http://mcp-router.net/install)か[リリースページ](https://github.com/mcp-router/mcp-router/releases)からダウンロード可能です。


## 🚀 機能

### 📊 一元的なサーバ管理
単一のダッシュボードからMCPサーバのオン/オフを簡単に切り替え

<img src="https://raw.githubusercontent.com/mcp-router/mcp-router/main/docs/static/img/readme/toggle.png" alt="サーバ管理" width="600">

### 🌐 ユニバーサル接続
ローカルおよびリモートサーバに対応し、あらゆるMCPサーバの追加と接続が可能

<img src="https://raw.githubusercontent.com/mcp-router/mcp-router/main/docs/static/img/readme/add-mcp-manual.png" alt="ユニバーサル接続" width="600">

### 🔗 ワンクリック連携
Claude、Cline、Windsurf、Cursorなどの人気AIツールやカスタムクライアントとシームレスに接続

<img src="https://raw.githubusercontent.com/mcp-router/mcp-router/main/docs/static/img/readme/token.png" alt="ワンクリック連携" width="600">

### 📈 包括的なロギングと分析
詳細なリクエストログの監視と表示

<img src="https://raw.githubusercontent.com/mcp-router/mcp-router/main/docs/static/img/readme/stats.png" alt="ログと統計" width="600">

## 🎯 開発ロードマップ

### 🖥️ ヘッドレスモードのサポート
**目標**: GUI不要の環境でもMCP Routerを活用可能に

- [ ] ヘッドレスモードとGUIでのコードの共通化
- [ ] CLIインターフェースの提供
- [ ] コンテナ環境での動作最適化

### 🔧 MCP管理機能の強化
**目標**: MCPサーバの管理をより柔軟で強力にする

- [ ] 各ツール単位で細かな権限を設定できるようにする
- [ ] ツール名を任意に変更できる機能を追加
- [ ] autoStart オプションを設定可能にする

### 🧠 長期記憶（Long-Term Memory）システム
**目標**: あらゆるMCP呼び出しを永続的に記憶するメカニズムを提供

- [ ] メタ情報のインデックスの実装
- [ ] ベクトルDBへの保存・検索機能の実装
- [ ] 複数のベクトルDBプロバイダーのサポート（Pinecone、Weaviate、Qdrant等）

### 🤖 エージェントオーケストレーション
**目標**: 複数のAIエージェントを協調させる高度な機能

- [ ] OpenAI 互換 API に対応
- [ ] より使いやすいエージェントのUIを提供


## 🤝 コミュニティ

ヘルプを得たり、アイデアを共有したり、最新情報を入手するためにコミュニティに参加しましょう：

- 💬 [Discordコミュニティ](https://discord.com/invite/dwG9jPrhxB)
- 🐦 [X (Twitter) でフォロー](https://twitter.com/mcp_router)
- ⭐ [GitHubでスター](https://github.com/mcp-router/mcp-router)

## 📝 ライセンス

このプロジェクトはSustainable Use Licenseの下でライセンスされています。詳細は[LICENSE.md](LICENSE.md)ファイルをご覧ください。