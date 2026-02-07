import type { MarketplaceSkill, SkillSortOption } from "./types";

function compareNameAsc(a: MarketplaceSkill, b: MarketplaceSkill): number {
  return a.name.localeCompare(b.name);
}

export function sortMarketplaceSkills(
  skills: MarketplaceSkill[],
  sortOption: SkillSortOption,
): MarketplaceSkill[] {
  const sorted = [...skills];

  switch (sortOption) {
    case "downloads":
      return sorted.sort((a, b) => {
        const diff = (b.installCount || 0) - (a.installCount || 0);
        if (diff !== 0) return diff;
        return compareNameAsc(a, b);
      });

    case "name":
      return sorted.sort(compareNameAsc);

    case "nameDesc":
      return sorted.sort((a, b) => compareNameAsc(b, a));

    default:
      return sorted;
  }
}
