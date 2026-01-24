import type {
  Skill,
  SkillWithContent,
  CreateSkillInput,
  UpdateSkillInput,
  AgentPath,
  CreateAgentPathInput,
} from "../../skill-types";

/**
 * Skills management API
 */
export interface SkillsAPI {
  // CRUD operations
  list: () => Promise<SkillWithContent[]>;
  create: (input: CreateSkillInput) => Promise<Skill>;
  update: (id: string, updates: UpdateSkillInput) => Promise<Skill>;
  delete: (id: string) => Promise<void>;

  // Actions
  openFolder: (id?: string) => Promise<void>; // id省略でskillsディレクトリ全体
  import: () => Promise<Skill>; // フォルダ選択ダイアログ→インポート

  // Agent Path operations (symlink target directories)
  agentPaths: {
    list: () => Promise<AgentPath[]>;
    create: (input: CreateAgentPathInput) => Promise<AgentPath>;
    delete: (id: string) => Promise<void>;
    selectFolder: () => Promise<string>;
  };
}
