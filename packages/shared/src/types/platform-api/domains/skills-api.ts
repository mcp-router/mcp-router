import type {
  Skill,
  SkillWithContent,
  CreateSkillInput,
  UpdateSkillInput,
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
}
