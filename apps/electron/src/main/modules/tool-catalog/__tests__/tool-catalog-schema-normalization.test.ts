import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { ToolCatalogService } from "../tool-catalog.service";
import { getEventBridge } from "@/main/modules/mcp-server-runtime/event-bridge";

function createServerManagerMock() {
  const listTools = vi.fn();

  const maps = {
    servers: new Map([
      [
        "srv-1",
        {
          id: "srv-1",
          name: "workspace-mcp",
          serverType: "remote",
          inputParams: {},
          toolPermissions: {},
          enabled: true,
          autoStart: true,
          status: "running",
          projectId: null,
        },
      ],
    ]),
    clients: new Map([
      [
        "srv-1",
        {
          getClient: () => ({
            listTools,
          }),
        },
      ],
    ]),
    serverStatusMap: new Map([["workspace-mcp", true]]),
    serverNameToIdMap: new Map([["workspace-mcp", "srv-1"]]),
  };

  return {
    listTools,
    manager: {
      getMaps: () => maps,
    },
  };
}

describe("ToolCatalogService schema normalization", () => {
  const searchProvider = {
    search: vi.fn(async ({ tools }: { tools: unknown[] }) => tools),
  };
  const createdServices: ToolCatalogService[] = [];

  afterEach(() => {
    for (const service of createdServices) {
      service.dispose();
    }
    createdServices.length = 0;
  });

  beforeEach(() => {
    searchProvider.search.mockClear();
  });

  it("normalizes snake_case combinator siblings in discovery schemas", async () => {
    const { listTools, manager } = createServerManagerMock();
    listTools.mockResolvedValue({
      tools: [
        {
          name: "add_conditional_formatting",
          description: "Adds conditional formatting",
          inputSchema: {
            type: "object",
            properties: {
              condition_values: {
                type: "string",
                any_of: [{ type: "string" }, { type: "array" }],
              },
            },
          },
        },
      ],
    });

    const service = new ToolCatalogService(manager as any, searchProvider as any);
    createdServices.push(service);

    await service.searchTools(
      { query: ["conditional", "formatting"], detailLevel: "summary" },
      { projectId: null },
    );

    const tools = (searchProvider.search.mock.calls[0]?.[0]?.tools ?? []) as Array<{
      inputSchema: unknown;
    }>;
    expect(tools).toHaveLength(1);
    expect(tools[0].inputSchema).toEqual({
      type: "object",
      properties: {
        condition_values: {
          any_of: [{ type: "string" }, { type: "array" }],
        },
      },
    });
  });

  it("strips combinators in discovery schemas when requested", async () => {
    const { listTools, manager } = createServerManagerMock();
    listTools.mockResolvedValue({
      tools: [
        {
          name: "add_conditional_formatting",
          description: "Adds conditional formatting",
          inputSchema: {
            type: "object",
            properties: {
              condition_values: {
                any_of: [{ type: "string" }, { type: "array" }],
                description: "Condition values",
              },
            },
          },
        },
      ],
    });

    const service = new ToolCatalogService(manager as any, searchProvider as any);
    createdServices.push(service);

    await service.searchTools(
      { query: ["conditional", "formatting"], detailLevel: "summary" },
      { projectId: null, stripCombinators: true },
    );

    const tools = (searchProvider.search.mock.calls[0]?.[0]?.tools ?? []) as Array<{
      inputSchema: unknown;
    }>;
    expect(tools).toHaveLength(1);
    expect(tools[0].inputSchema).toEqual({
      type: "object",
      properties: {
        condition_values: {
          description: "Condition values",
        },
      },
    });
  });

  it("reuses tool cache within TTL when no change events occur", async () => {
    const { listTools, manager } = createServerManagerMock();
    listTools.mockResolvedValue({
      tools: [
        {
          name: "sample_tool",
          description: "Sample",
          inputSchema: { type: "object", properties: { q: { type: "string" } } },
        },
      ],
    });

    const service = new ToolCatalogService(manager as any, searchProvider as any);
    createdServices.push(service);

    await service.searchTools(
      { query: ["sample"], detailLevel: "summary" },
      { projectId: null },
    );
    await service.searchTools(
      { query: ["sample"], detailLevel: "summary" },
      { projectId: null },
    );

    expect(listTools).toHaveBeenCalledTimes(1);
  });

  it("invalidates tool cache on tool_list_changed events", async () => {
    const { listTools, manager } = createServerManagerMock();
    listTools.mockResolvedValue({
      tools: [
        {
          name: "sample_tool",
          description: "Sample",
          inputSchema: { type: "object", properties: { q: { type: "string" } } },
        },
      ],
    });

    const service = new ToolCatalogService(manager as any, searchProvider as any);
    createdServices.push(service);

    await service.searchTools(
      { query: ["sample"], detailLevel: "summary" },
      { projectId: null },
    );
    getEventBridge().emit("tool_list_changed", { source: "test" });
    await service.searchTools(
      { query: ["sample"], detailLevel: "summary" },
      { projectId: null },
    );

    expect(listTools).toHaveBeenCalledTimes(2);
  });
});
