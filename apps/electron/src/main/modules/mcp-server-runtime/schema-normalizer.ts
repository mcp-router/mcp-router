const COMBINATOR_KEYS = [
  "anyOf",
  "oneOf",
  "allOf",
  "any_of",
  "one_of",
  "all_of",
] as const;

const COMBINATOR_SENSITIVE_CLIENTS = new Set([
  "opencode",
  "gemini",
  "antigravity",
  "droid",
  "cursor",
]);

export function shouldStripCombinatorsForClient(
  clientId: string | null | undefined,
): boolean {
  if (!clientId) return false;
  return COMBINATOR_SENSITIVE_CLIENTS.has(clientId.toLowerCase());
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function mergeSchemaObjects(
  base: Record<string, unknown>,
  override: Record<string, unknown>,
): Record<string, unknown> {
  const merged: Record<string, unknown> = { ...base };

  for (const [key, value] of Object.entries(override)) {
    const current = merged[key];

    if (key === "required" && Array.isArray(current) && Array.isArray(value)) {
      merged[key] = Array.from(new Set([...current, ...value]));
      continue;
    }

    if (isPlainObject(current) && isPlainObject(value)) {
      merged[key] = mergeSchemaObjects(current, value);
      continue;
    }

    merged[key] = value;
  }

  return merged;
}

function normalizeSchemaNode(
  node: unknown,
  options: {
    inCombinatorBranch?: boolean;
    stripCombinators?: boolean;
  } = {},
): unknown {
  const { inCombinatorBranch = false, stripCombinators = false } = options;

  if (Array.isArray(node)) {
    return node.map((item) => normalizeSchemaNode(item, options));
  }

  if (!isPlainObject(node)) {
    return node;
  }

  const normalizedEntries = Object.entries(node).map(([key, value]) => [
    key,
    normalizeSchemaNode(value, options),
  ]);
  let normalized = Object.fromEntries(normalizedEntries) as Record<
    string,
    unknown
  >;

  if (inCombinatorBranch && "default" in normalized) {
    delete normalized.default;
  }

  if (stripCombinators) {
    const hasCombinator = COMBINATOR_KEYS.some((key) =>
      Array.isArray(normalized[key]),
    );
    if (hasCombinator) {
      const nonCombinatorEntries = Object.entries(normalized).filter(
        ([entryKey]) =>
          !COMBINATOR_KEYS.includes(
            entryKey as (typeof COMBINATOR_KEYS)[number],
          ) && entryKey !== "default",
      );
      return Object.fromEntries(nonCombinatorEntries);
    }
  }

  for (const key of COMBINATOR_KEYS) {
    const combinator = normalized[key];
    if (!Array.isArray(combinator)) continue;

    const siblingEntries = Object.entries(normalized).filter(
      ([entryKey]) => entryKey !== key && entryKey !== "default",
    );
    if (siblingEntries.length === 0) {
      normalized = {
        [key]: combinator.map((branch) =>
          normalizeSchemaNode(branch, { inCombinatorBranch: true }),
        ),
      };
      continue;
    }

    const siblings = Object.fromEntries(siblingEntries) as Record<
      string,
      unknown
    >;
    const mergedBranches = combinator.map((branch) => {
      if (!isPlainObject(branch)) {
        return normalizeSchemaNode(branch, { inCombinatorBranch: true });
      }
      return normalizeSchemaNode(
        mergeSchemaObjects(siblings, branch),
        { inCombinatorBranch: true },
      ) as Record<string, unknown>;
    });

    normalized = { [key]: mergedBranches };
  }

  return normalized;
}

/**
 * Some function-calling APIs (including Gemini) require `anyOf`/`oneOf`/`allOf`
 * nodes to contain only the combinator key. JSON Schema allows sibling fields,
 * so we normalize by pushing sibling fields into each branch.
 */
export function normalizeToolInputSchema(
  inputSchema: unknown,
  options: { stripCombinators?: boolean } = {},
): Record<string, unknown> | undefined {
  if (!isPlainObject(inputSchema)) {
    return undefined;
  }
  return normalizeSchemaNode(inputSchema, {
    stripCombinators: options.stripCombinators,
  }) as Record<string, unknown>;
}

const NORMALIZED_SCHEMA_CACHE_MAX_ENTRIES = 500;
const normalizedSchemaCache = new Map<string, Record<string, unknown>>();

function getNormalizationCacheKey(
  inputSchema: unknown,
  options: { stripCombinators?: boolean },
): string | null {
  if (!isPlainObject(inputSchema)) {
    return null;
  }

  try {
    return `${options.stripCombinators === true ? "strip" : "keep"}:${JSON.stringify(inputSchema)}`;
  } catch {
    return null;
  }
}

/**
 * Cached variant used in hot paths (`tools/list`, tool catalog indexing).
 * Cache is intentionally bounded to avoid unbounded memory growth.
 */
export function normalizeToolInputSchemaCached(
  inputSchema: unknown,
  options: { stripCombinators?: boolean } = {},
): Record<string, unknown> | undefined {
  const cacheKey = getNormalizationCacheKey(inputSchema, options);
  if (cacheKey) {
    const cached = normalizedSchemaCache.get(cacheKey);
    if (cached) {
      return cached;
    }
  }

  const normalized = normalizeToolInputSchema(inputSchema, options);
  if (cacheKey && normalized) {
    if (normalizedSchemaCache.size >= NORMALIZED_SCHEMA_CACHE_MAX_ENTRIES) {
      normalizedSchemaCache.clear();
    }
    normalizedSchemaCache.set(cacheKey, normalized);
  }
  return normalized;
}
