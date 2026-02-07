import { describe, expect, it } from "vitest";
import type { RegistryServerWithMeta } from "../McpServerCard";
import { sortMcpServers } from "../sort-mcp-servers";

function makeServer(
  name: string,
  publishedAt: string,
  updatedAt: string,
): RegistryServerWithMeta {
  return {
    server: {
      name,
      description: "",
      version: "1.0.0",
      repository: {
        url: `https://github.com/example/${name}`,
        source: "github",
      },
    },
    _meta: {
      "io.modelcontextprotocol.registry/official": {
        status: "active",
        publishedAt,
        updatedAt,
        isLatest: true,
      },
    },
  };
}

const servers: RegistryServerWithMeta[] = [
  makeServer("gamma", "2026-01-01T00:00:00.000Z", "2026-01-04T00:00:00.000Z"),
  makeServer("alpha", "2026-01-03T00:00:00.000Z", "2026-01-01T00:00:00.000Z"),
  makeServer("beta", "2026-01-02T00:00:00.000Z", "2026-01-02T00:00:00.000Z"),
];

const githubStats = {
  "https://github.com/example/gamma": {
    stars: 2,
    forks: 0,
    openIssues: 0,
    watchers: 0,
  },
  "https://github.com/example/alpha": {
    stars: 8,
    forks: 0,
    openIssues: 0,
    watchers: 0,
  },
  "https://github.com/example/beta": {
    stars: 5,
    forks: 0,
    openIssues: 0,
    watchers: 0,
  },
};

describe("sortMcpServers", () => {
  it("sorts by stars descending", () => {
    const sorted = sortMcpServers(servers, "stars", githubStats);
    expect(sorted.map((s) => s.server.name)).toEqual([
      "alpha",
      "beta",
      "gamma",
    ]);
  });

  it("sorts by publishedAt descending for recent", () => {
    const sorted = sortMcpServers(servers, "recent", githubStats);
    expect(sorted.map((s) => s.server.name)).toEqual([
      "alpha",
      "beta",
      "gamma",
    ]);
  });

  it("sorts by updatedAt descending for updated", () => {
    const sorted = sortMcpServers(servers, "updated", githubStats);
    expect(sorted.map((s) => s.server.name)).toEqual([
      "gamma",
      "beta",
      "alpha",
    ]);
  });

  it("sorts by name asc and desc", () => {
    const asc = sortMcpServers(servers, "name", githubStats);
    const desc = sortMcpServers(servers, "nameDesc", githubStats);

    expect(asc.map((s) => s.server.name)).toEqual(["alpha", "beta", "gamma"]);
    expect(desc.map((s) => s.server.name)).toEqual(["gamma", "beta", "alpha"]);
  });
});
