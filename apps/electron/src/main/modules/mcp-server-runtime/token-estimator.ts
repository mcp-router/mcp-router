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
export function estimateTokens(text: string): number {
  if (!text) return 0;
  return Math.ceil(text.length / CHARS_PER_TOKEN);
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
    const serialized = JSON.stringify(request);
    return estimateTokens(serialized);
  } catch {
    return 0;
  }
}

/**
 * Estimate tokens consumed by an MCP response payload.
 */
export function estimateResponseTokens(response: object): number {
  try {
    const serialized = JSON.stringify(response);
    return estimateTokens(serialized);
  } catch {
    return 0;
  }
}
