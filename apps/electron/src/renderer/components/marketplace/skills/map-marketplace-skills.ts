import type { MarketplaceSkill } from "./types";

interface RawSkillResponseItem {
  skill?: Record<string, any>;
  _meta?: Record<string, any>;
  [key: string]: any;
}

interface RawSkillsSearchResponse {
  skills?: RawSkillResponseItem[];
}

/**
 * Maps marketplace API response shape(s) into the UI skill model.
 * Accepts both nested (`{ skill, _meta }`) and flat (`{ ...skill }`) entries.
 */
export function mapMarketplaceSkillsFromResponse(
  response: RawSkillsSearchResponse,
): MarketplaceSkill[] {
  const items = Array.isArray(response.skills) ? response.skills : [];
  return items.map((item) => {
    const skill = item.skill ?? item;
    const meta = item._meta ?? {};

    const source = skill.source || skill.topSource || "";
    const author = source.split("/")[0] || "Unknown";

    const skillId = skill.skillId || skill.name;
    const repositoryUrl = source
      ? `https://github.com/${source}#skill:${skillId}`
      : skill.repository?.url;

    return {
      id: skill.id,
      name: skill.name || skillId,
      description: skill.description || "No description available",
      author: skill.author || author,
      version: skill.version || "1.0.0",
      installCount: skill.installs ?? meta.downloads ?? 0,
      tags: skill.tags || [],
      repositoryUrl,
      compatibility: [],
    } as MarketplaceSkill;
  });
}
