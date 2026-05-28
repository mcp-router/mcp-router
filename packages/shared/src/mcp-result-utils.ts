function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

const memoryServerIdentifiers = new Set([
  "@modelcontextprotocol/server-memory",
  "memory",
  "memory-mcp",
  "memory-server",
  "mcp-memory",
  "mcp-server-memory",
  "server-memory",
]);

function normalizeServerIdentifier(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[\s_]+/g, "-");
}

function isMemoryServer(context?: {
  serverId?: string;
  serverName?: string;
}): boolean {
  return [context?.serverId, context?.serverName]
    .filter((value): value is string => Boolean(value))
    .some((value) =>
      memoryServerIdentifiers.has(normalizeServerIdentifier(value)),
    );
}

export function normalizeProxiedToolResult<T>(
  toolName: string,
  result: T,
  context?: { serverId?: string; serverName?: string },
): T {
  if (
    toolName !== "read_graph" ||
    !isMemoryServer(context) ||
    !isRecord(result)
  ) {
    return result;
  }

  const structuredContent = result.structuredContent;
  if (
    !isRecord(structuredContent) ||
    !Array.isArray(structuredContent.entities)
  ) {
    return result;
  }

  const entities = structuredContent.entities;
  let hasEntityType = false;
  const normalizedEntities = entities.map((entity) => {
    if (!isRecord(entity) || !("type" in entity)) {
      return entity;
    }

    hasEntityType = true;
    const normalizedEntity = { ...entity };
    delete normalizedEntity.type;
    return normalizedEntity;
  });

  if (!hasEntityType) {
    return result;
  }

  return {
    ...result,
    structuredContent: {
      ...structuredContent,
      entities: normalizedEntities,
    },
  } as Record<string, unknown> as T;
}
