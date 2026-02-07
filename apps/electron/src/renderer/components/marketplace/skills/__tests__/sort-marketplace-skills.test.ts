import { describe, expect, it } from "vitest";
import { sortMarketplaceSkills } from "../sort-marketplace-skills";
import type { MarketplaceSkill } from "../types";

const baseSkill = {
  description: "",
  author: "author",
  version: "1.0.0",
  tags: [] as string[],
  compatibility: [],
};

const skills: MarketplaceSkill[] = [
  { ...baseSkill, id: "1", name: "zeta", installCount: 8 },
  { ...baseSkill, id: "2", name: "alpha", installCount: 12 },
  { ...baseSkill, id: "3", name: "beta", installCount: 12 },
];

describe("sortMarketplaceSkills", () => {
  it("sorts downloads by installs desc with name tie-breaker", () => {
    const sorted = sortMarketplaceSkills(skills, "downloads");
    expect(sorted.map((s) => s.name)).toEqual(["alpha", "beta", "zeta"]);
  });

  it("sorts name ascending", () => {
    const sorted = sortMarketplaceSkills(skills, "name");
    expect(sorted.map((s) => s.name)).toEqual(["alpha", "beta", "zeta"]);
  });

  it("sorts name descending", () => {
    const sorted = sortMarketplaceSkills(skills, "nameDesc");
    expect(sorted.map((s) => s.name)).toEqual(["zeta", "beta", "alpha"]);
  });
});
