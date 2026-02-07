import { describe, it, expect } from "vitest";
import { mapMarketplaceSkillsFromResponse } from "../map-marketplace-skills";

describe("mapMarketplaceSkillsFromResponse", () => {
  it("maps nested skill result shape", () => {
    const result = mapMarketplaceSkillsFromResponse({
      skills: [
        {
          skill: {
            id: "s1",
            skillId: "my-skill",
            name: "my-skill",
            source: "vercel-labs/skills",
            installs: 42,
            description: "desc",
          },
          _meta: {
            publishedAt: "2026-01-01T00:00:00.000Z",
            downloads: 10,
          },
        },
      ],
    });

    expect(result).toHaveLength(1);
    expect(result[0].id).toBe("s1");
    expect(result[0].name).toBe("my-skill");
    expect(result[0].author).toBe("vercel-labs");
    expect(result[0].repositoryUrl).toBe(
      "https://github.com/vercel-labs/skills#skill:my-skill",
    );
    expect(result[0].installCount).toBe(42);
  });

  it("maps flat skill result shape", () => {
    const result = mapMarketplaceSkillsFromResponse({
      skills: [
        {
          id: "s2",
          skillId: "flat-skill",
          source: "acme/skills",
          installs: 9,
        },
      ],
    });

    expect(result).toHaveLength(1);
    expect(result[0].id).toBe("s2");
    expect(result[0].name).toBe("flat-skill");
    expect(result[0].author).toBe("acme");
    expect(result[0].installCount).toBe(9);
  });
});
