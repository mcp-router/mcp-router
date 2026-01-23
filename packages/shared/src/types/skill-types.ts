/**
 * Agent Skills type definitions
 * Skills are collections of instructions, scripts, and resources
 * that extend AI agent capabilities.
 */

/**
 * Skill entity
 */
export interface Skill {
  id: string;
  name: string; // Directory name (unique key)
  projectId: string | null; // Optional project association
  enabled: boolean; // Whether symlinks are active
  createdAt: number;
  updatedAt: number;
}

/**
 * Skill with content (for API responses)
 */
export interface SkillWithContent extends Skill {
  content: string | null; // SKILL.md content
}

/**
 * Input for creating a skill
 */
export interface CreateSkillInput {
  name: string;
  projectId?: string | null;
}

/**
 * Input for updating a skill
 */
export interface UpdateSkillInput {
  name?: string;
  projectId?: string | null;
  enabled?: boolean;
  content?: string;
}
