# MCP Tool Sanitizer

Sanitizes MCP tool names and schemas for Google Gemini API compatibility.

## Problem

Google Gemini API has strict naming requirements for function declarations:
- Maximum 64 characters
- Only a-z, A-Z, 0-9, underscore, period, colon, hyphen
- Must start with a letter (a-z, A-Z) or underscore

MCP tools often use naming conventions that violate these rules:
- `server__tool` format (double underscores)
- Names starting with numbers
- Special characters in names

## Solution

The `MCPToolSanitizer` class provides:

1. **Tool Name Sanitization** - Converts invalid characters to underscores
2. **Bidirectional Mapping** - Tracks original → sanitized name mappings
3. **Deduplication** - Handles conflicting sanitized names with unique suffixes
4. **Schema Sanitization** - Cleans JSON schemas for Gemini compatibility

## Usage

```typescript
import { MCPToolSanitizer } from './src/sanitizer';

const sanitizer = new MCPToolSanitizer();

// Sanitize tools from MCP server
const sanitizedTools = sanitizer.sanitizeTools(mcpTools);

// Convert to Gemini function format
const geminiFunctions = sanitizer.toGeminiFunctions(sanitizedTools);

// Reverse lookup when Gemini calls a function
const originalName = sanitizer.getOriginalName(sanitizedName);
```

## Key Features

- Handles `::` → `_` transformation correctly
- Preserves `__` (MCP server__tool convention)
- Resolves `$ref` in JSON schemas
- Handles `anyOf`, `oneOf`, `allOf` composition
- Circular reference protection
- Comprehensive test coverage (80+ tests)

## Files

- `src/sanitizer.ts` - Core sanitization logic
- `src/types.ts` - TypeScript type definitions
- `tests/sanitizer.test.ts` - Test suite
- `proxy-mcp-server.mjs` - Example proxy server implementation

## Integration

This code is designed for integration into MCP Router to add a `--sanitize-names` flag that automatically sanitizes tool names when connecting to Gemini CLI.
