/**
 * Token estimation utilities for MCP request/response payloads.
 *
 * Uses a ~4 chars per token heuristic which is a reasonable approximation
 * for most LLM tokenizers without requiring a tokenizer dependency.
 */

const CHARS_PER_TOKEN = 4;

/**
 * Estimate the number of tokens in a string.
 * Uses ~4 characters per token as a rough heuristic.
 */
function estimateTokens(text: string): number {
  if (!text) return 0;
  return Math.ceil(text.length / CHARS_PER_TOKEN);
}

/**
 * Recursively estimate the serialized character size of an object
 * without allocating a full JSON string via JSON.stringify.
 */
function estimateObjectSize(
  obj: unknown,
  seen: WeakSet<object> = new WeakSet(),
  depth = 0,
): number {
  if (obj === null || obj === undefined) return 4;
  if (depth > 50) return 4; // Prevent stack overflow on deeply nested objects
  switch (typeof obj) {
    case "string":
      return (obj as string).length + 2;
    case "number":
      return 8;
    case "boolean":
      return 5;
    case "object": {
      // Circular reference protection
      if (seen.has(obj as object)) return 4;
      seen.add(obj as object);

      if (Array.isArray(obj)) {
        let size = 2; // brackets
        for (const item of obj)
          size += estimateObjectSize(item, seen, depth + 1) + 1;
        return size;
      }
      let size = 2; // braces
      for (const [key, val] of Object.entries(
        obj as Record<string, unknown>,
      )) {
        size += key.length + 4 + estimateObjectSize(val, seen, depth + 1);
      }
      return size;
    }
    default:
      return 4;
  }
}

/**
 * Estimate tokens consumed by a tool definition in the context window.
 * Tool definitions include the name, description, and JSON Schema for inputSchema.
 */
export function estimateToolDefinitionTokens(tool: {
  name: string;
  description?: string;
  inputSchema?: object;
}): number {
  let charCount = 0;

  // Tool name
  charCount += tool.name.length;

  // Description
  if (tool.description) {
    charCount += tool.description.length;
  }

  // Input schema serialized as JSON
  if (tool.inputSchema) {
    try {
      charCount += JSON.stringify(tool.inputSchema).length;
    } catch {
      // If serialization fails, estimate a minimum overhead
      charCount += 50;
    }
  }

  // Add overhead for structural formatting (JSON keys, punctuation, etc.)
  charCount += 30;

  return Math.ceil(charCount / CHARS_PER_TOKEN);
}

/**
 * Estimate tokens consumed by an MCP request payload.
 */
export function estimateRequestTokens(request: object): number {
  try {
    return Math.ceil(estimateObjectSize(request) / CHARS_PER_TOKEN);
  } catch {
    return 0;
  }
}

/**
 * Estimate tokens consumed by an MCP response payload.
 */
export function estimateResponseTokens(response: object): number {
  try {
    return Math.ceil(estimateObjectSize(response) / CHARS_PER_TOKEN);
  } catch {
    return 0;
  }
}
