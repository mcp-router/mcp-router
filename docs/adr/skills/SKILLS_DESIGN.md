# Agent Skills Management Design

## Overview

Agent Skillsは、AIエージェントに専門知識やワークフローを教えるためのオープンスタンダード。MCP RouterでSkillsを一元管理し、各AIエージェントの個人用ディレクトリにシンボリックリンクを自動作成する。

## Architecture

### Module Structure

```
apps/electron/src/main/modules/skills/
├── skills-agent-paths.ts    # エージェントパス定義
├── skills-file-manager.ts   # ファイルシステム操作
├── skills.repository.ts     # データベース操作
├── skills.service.ts        # ビジネスロジック
└── skills.ipc.ts            # IPCハンドラー
```

### Type Definitions

```
packages/shared/src/types/
├── skill-types.ts                      # ドメイン型
└── platform-api/domains/skills-api.ts  # API型
```

## Data Model

### Skill Entity

```typescript
interface Skill {
  id: string;
  name: string;              // ディレクトリ名（一意）、パスは name から導出可能
  projectId: string | null;  // オプショナルなプロジェクト紐づけ
  enabled: boolean;          // スキルの有効/無効状態
  createdAt: number;
  updatedAt: number;
}

// API応答用（contentを含む）
interface SkillWithContent extends Skill {
  content: string | null;    // SKILL.md content
}
```

> **Note:** スキルのフォルダパスは `name` から導出可能（`{userData}/skills/{name}`）なため、DBには保存しない。

## API Design

シンプルなCRUD + アクションの6つのAPIに統合。

```typescript
interface SkillsAPI {
  // CRUD operations
  list: () => Promise<SkillWithContent[]>;
  create: (input: CreateSkillInput) => Promise<Skill>;
  update: (id: string, updates: UpdateSkillInput) => Promise<Skill>;
  delete: (id: string) => Promise<void>;

  // Actions
  openFolder: (id?: string) => Promise<void>;  // id省略でskillsディレクトリ全体
  import: () => Promise<Skill>;                 // フォルダ選択ダイアログ→インポート
}

// updateでenabled/contentも更新可能
interface UpdateSkillInput {
  name?: string;
  projectId?: string | null;
  enabled?: boolean;
  content?: string;
}
```

## Supported Agents

| Agent | Skills Directory |
|-------|-----------------|
| Claude Code | `~/.claude/skills/` |
| OpenAI Codex | `~/.codex/skills/` |
| GitHub Copilot | `~/.copilot/skills/` |
| Cline | `~/.cline/skills/` |
| OpenCode | `~/.config/opencode/skill/` |

## Key Design Decisions

### 1. Automatic Symlink Creation

スキル作成時に全エージェントへ自動でシンボリックリンクを作成する。これにより、ユーザーは一箇所でスキルを管理でき、複数のエージェントで同じスキルを共有できる。

### 2. Filesystem-based Symlink Management

シンボリックリンクの状態はファイルシステムを真実の源（source of truth）として管理する。DBでシンボリックリンクを追跡せず、起動時にファイルシステムと同期することで簡潔さを保つ。

### 3. Skill Enable/Disable Toggle

スキルごとにOn/Off切り替えが可能。無効にするとすべてのエージェントからシンボリックリンクを削除し、有効にすると再作成する。UIではシンプルなスイッチで切り替え可能。

### 4. Optional Project Association

スキルはオプショナルにプロジェクトに紐づけ可能。`projectId: string | null`で管理。

### 5. SKILL.md Template Generation

スキル作成時にSKILL.mdテンプレートを自動生成。

### 6. Symlink Verification & Repair

アプリ起動時にシンボリックリンクの状態を検証し、破損したリンクを自動修復（再作成）。

### 7. Folder Import

外部フォルダをフォルダ選択ダイアログでインポート可能。インポート時にスキルディレクトリにコピーされ、自動でシンボリックリンクが作成される。

## Storage Location

Skills are stored in:
- macOS: `~/Library/Application Support/MCP Router/skills/`
- Windows: `%APPDATA%/MCP Router/skills/`
- Linux: `~/.config/MCP Router/skills/`

## Database Schema

### skills table

| Column | Type | Description |
|--------|------|-------------|
| id | TEXT | Primary key |
| name | TEXT | Unique skill name (パスは`{userData}/skills/{name}`から導出) |
| project_id | TEXT | Optional project ID |
| enabled | INTEGER | 1=enabled, 0=disabled |
| created_at | INTEGER | Timestamp |
| updated_at | INTEGER | Timestamp |

## Future Considerations

1. **Remote Workspace Support**: 現在はローカルワークスペースのみ対応
2. **Skill Export**: スキルのエクスポート・バックアップ機能（インポートは実装済み）
3. **Skill Templates**: 事前定義されたスキルテンプレート
4. **Cloud Sync**: クラウドを介したスキル同期
