import assert from "node:assert/strict";
import test from "node:test";

import { normalizeProxiedToolResult } from "../dist/mcp-result-utils.js";

test("normalizes Memory read_graph entity type fields without changing text content", () => {
  const result = {
    content: [
      {
        type: "text",
        text: JSON.stringify({
          entities: [
            {
              name: "alice",
              type: "person",
              observations: ["likes MCP"],
            },
          ],
          relations: [],
        }),
      },
    ],
    structuredContent: {
      entities: [
        {
          name: "alice",
          type: "person",
          observations: ["likes MCP"],
        },
      ],
      relations: [],
    },
  };

  const normalized = normalizeProxiedToolResult("read_graph", result, {
    serverName: "memory",
  });

  assert.deepEqual(normalized.structuredContent.entities, [
    {
      name: "alice",
      observations: ["likes MCP"],
    },
  ]);
  assert.equal(normalized.content, result.content);
  assert.equal(result.structuredContent.entities[0].type, "person");
});

test("leaves unrelated tool results unchanged", () => {
  const result = {
    structuredContent: {
      entities: [
        {
          name: "alice",
          type: "person",
          observations: ["likes MCP"],
        },
      ],
      relations: [],
    },
  };

  assert.equal(normalizeProxiedToolResult("other_tool", result), result);
});

test("leaves non-Memory read_graph results unchanged", () => {
  const result = {
    structuredContent: {
      entities: [
        {
          name: "node-a",
          type: "custom-node",
          observations: ["domain-specific type"],
        },
      ],
      relations: [],
    },
  };

  assert.equal(
    normalizeProxiedToolResult("read_graph", result, {
      serverName: "custom-graph",
    }),
    result,
  );
});

test("leaves read_graph results unchanged when entities do not contain type fields", () => {
  const result = {
    structuredContent: {
      entities: [
        {
          name: "alice",
          observations: ["likes MCP"],
        },
      ],
      relations: [],
    },
  };

  assert.equal(
    normalizeProxiedToolResult("read_graph", result, { serverName: "memory" }),
    result,
  );
});
