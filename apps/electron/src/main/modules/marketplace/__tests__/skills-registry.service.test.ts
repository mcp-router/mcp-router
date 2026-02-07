import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import { SkillsRegistryService } from "../skills-registry.service";

describe("SkillsRegistryService", () => {
  let service: SkillsRegistryService;
  const mockFetch = vi.fn();

  beforeEach(() => {
    mockFetch.mockReset();
    service = new SkillsRegistryService();
    vi.stubGlobal("fetch", mockFetch);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("normalizes flat skills response", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        skills: [
          { id: "1", name: "skill-a", installs: 10, source: "org/repo" },
        ],
        count: 1,
      }),
    });

    const result = await service.searchSkills({ limit: 10 });

    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url] = mockFetch.mock.calls[0];
    expect(String(url)).toContain("https://skills.sh/api/search?");
    expect(String(url)).toContain("q=ai");
    expect(String(url)).toContain("limit=10");
    expect(result.skills).toHaveLength(1);
    expect(result.metadata.count).toBe(1);
    expect(result.metadata.nextCursor).toBeNull();
  });

  it("normalizes nested data response", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        data: {
          skills: [
            { id: "2", name: "skill-b", installs: 5, source: "org/repo" },
          ],
          metadata: { nextCursor: "abc", count: 1 },
        },
      }),
    });

    const result = await service.searchSkills({ limit: 10 });

    expect(result.skills).toHaveLength(1);
    expect(result.metadata.count).toBe(1);
    expect(result.metadata.nextCursor).toBe("abc");
  });

  it("normalizes legacy hasMore response", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        skills: [{ id: "3", name: "skill-c", installs: 7, source: "org/repo" }],
        hasMore: true,
      }),
    });

    const result = await service.searchSkills({ limit: 10 });

    expect(result.skills).toHaveLength(1);
    expect(result.metadata.count).toBe(1);
    expect(result.metadata.nextCursor).toBeNull();
  });

  it("uses provided search query as q parameter", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ skills: [], count: 0 }),
    });

    await service.searchSkills({ search: "react", limit: 5 });

    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url] = mockFetch.mock.calls[0];
    expect(String(url)).toContain("q=react");
    expect(String(url)).toContain("limit=5");
  });

  it("returns empty results for 1-char query without fetching", async () => {
    const result = await service.searchSkills({ search: "a", limit: 5 });

    expect(mockFetch).not.toHaveBeenCalled();
    expect(result.skills).toEqual([]);
    expect(result.metadata.count).toBe(0);
    expect(result.metadata.nextCursor).toBeNull();
  });
});
