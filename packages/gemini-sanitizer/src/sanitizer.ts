/**
 * MCP Tool Sanitizer
 * 
 * Sanitizes MCP tool names and schemas for Google Gemini API compatibility.
 * Handles MCP naming conventions (server-name__tool-name) that violate Gemini's
 * strict naming requirements.
 */

import {
  MCPTool,
  SanitizedTool,
  SanitizedSchema,
  JSONSchema,
  MCPInputSchema,
  SanitizerOptions,
  GeminiFunctionDeclaration,
} from './types';

// =============================================================================
// Constants
// =============================================================================

const DEFAULT_MAX_LENGTH = 64;
const DEFAULT_REPLACEMENT = '_';
const ALLOWED_NAME_CHARS = /^[a-zA-Z0-9_.:]+$/;
const VALID_START_CHAR = /^[a-zA-Z_]/;
const MAX_DESCRIPTION_LENGTH = 1024;
const MAX_SCHEMA_DEPTH = 20;

const PRESERVE_KEYS = new Set([
  'type',
  'format',
  'description',
  'enum',
  'properties',
  'required',
  'items',
]);

// =============================================================================
// Tool Name Sanitizer
// =============================================================================

/**
 * Sanitizes an MCP tool name to be compatible with Gemini API requirements.
 * 
 * @param name - The original tool name to sanitize
 * @param options - Optional configuration for sanitization behavior
 * @returns The sanitized tool name
 */
export function sanitizeToolName(name: string, options?: SanitizerOptions): string {
  if (typeof name !== 'string') {
    throw new Error(`Invalid input: tool name must be a string, got ${typeof name}`);
  }

  if (name.length === 0) {
    throw new Error('Invalid input: tool name cannot be empty');
  }

  const maxLength = options?.maxLength ?? DEFAULT_MAX_LENGTH;
  const replacement = options?.replacementChar ?? DEFAULT_REPLACEMENT;

  if (maxLength < 1 || maxLength > 1000) {
    throw new Error(`Invalid maxLength: must be between 1 and 1000, got ${maxLength}`);
  }

  // Replace double colons with placeholder
  let sanitized = name.replace(/::/g, '_COLON_');

  // Remove invalid characters
  const invalidCharRegex = /[^a-zA-Z0-9_]/g;
  sanitized = sanitized.replace(invalidCharRegex, replacement);

  // Replace placeholder with single underscore
  sanitized = sanitized.replace(/_COLON_/g, '_');

  // Collapse 3+ consecutive underscores
  if (replacement === '_') {
    sanitized = sanitized.replace(/_{3,}/g, '_');
  }

  // Truncate to max length
  if (sanitized.length > maxLength) {
    sanitized = sanitized.substring(0, maxLength);
  }

  // Ensure the name starts with a letter or underscore
  if (!VALID_START_CHAR.test(sanitized)) {
    sanitized = `_${sanitized}`;
  }

  return sanitized;
}

// =============================================================================
// Schema Sanitizer
// =============================================================================

function resolveRef(ref: string, defs: Record<string, JSONSchema>): JSONSchema | undefined {
  const match = ref.match(/^#\/(?:\$defs|definitions)\/(.+)$/);
  if (match && match[1]) {
    return defs[match[1]];
  }
  return undefined;
}

function extractDefs(schema: Record<string, unknown>): Record<string, JSONSchema> {
  const defs: Record<string, JSONSchema> = {};

  if (schema.$defs && typeof schema.$defs === 'object') {
    Object.assign(defs, schema.$defs);
  }
  if (schema.definitions && typeof schema.definitions === 'object') {
    Object.assign(defs, schema.definitions);
  }

  return defs;
}

function resolveComposition(schema: JSONSchema, defs: Record<string, JSONSchema>, seen: Set<string>): JSONSchema {
  let resolved: JSONSchema = { ...schema };

  if (resolved.allOf && Array.isArray(resolved.allOf)) {
    let mergedProps: Record<string, JSONSchema> = {};
    let mergedRequired: string[] = [];
    let mergedType: string | undefined;

    for (const sub of resolved.allOf) {
      const resolvedSub = resolveSchemaRefs(sub, defs, seen);
      if (resolvedSub.type) mergedType = resolvedSub.type;
      if (resolvedSub.properties) {
        mergedProps = { ...mergedProps, ...resolvedSub.properties };
      }
      if (resolvedSub.required) {
        mergedRequired = [...mergedRequired, ...resolvedSub.required];
      }
    }

    delete resolved.allOf;
    if (mergedType) resolved.type = resolved.type || mergedType;
    if (Object.keys(mergedProps).length > 0) {
      resolved.properties = { ...(resolved.properties || {}), ...mergedProps };
    }
    if (mergedRequired.length > 0) {
      const existing = resolved.required || [];
      resolved.required = [...new Set([...existing, ...mergedRequired])];
    }
  }

  for (const keyword of ['anyOf', 'oneOf'] as const) {
    const variants = (resolved as Record<string, unknown>)[keyword];
    if (variants && Array.isArray(variants)) {
      let picked: JSONSchema | undefined;
      for (const variant of variants as JSONSchema[]) {
        const resolvedVariant = resolveSchemaRefs(variant, defs, seen);
        if (resolvedVariant.type !== 'null' && resolvedVariant.type) {
          picked = resolvedVariant;
          break;
        }
      }
      if (!picked && (variants as JSONSchema[]).length > 0) {
        picked = resolveSchemaRefs((variants as JSONSchema[])[0], defs, seen);
      }

      if (picked) {
        delete (resolved as Record<string, unknown>)[keyword];
        const { description: existingDesc, ...rest } = resolved;
        resolved = { ...picked };
        if (existingDesc && !resolved.description) {
          resolved.description = existingDesc;
        }
      }
    }
  }

  return resolved;
}

function resolveSchemaRefs(
  schema: JSONSchema,
  defs: Record<string, JSONSchema>,
  seen: Set<string>
): JSONSchema {
  if (!schema || typeof schema !== 'object') {
    return schema;
  }

  if (schema.$ref && typeof schema.$ref === 'string') {
    if (seen.has(schema.$ref)) {
      return { type: 'object', description: schema.description || '(circular reference)' };
    }
    seen.add(schema.$ref);

    const resolved = resolveRef(schema.$ref, defs);
    if (resolved) {
      const { $ref, ...siblings } = schema;
      const resolvedSchema = resolveSchemaRefs({ ...resolved, ...siblings }, defs, seen);
      return resolvedSchema;
    }
    return { type: 'object', description: schema.description };
  }

  return resolveComposition(schema, defs, seen);
}

export function sanitizeDescription(description: unknown): string | undefined {
  if (typeof description !== 'string') {
    return undefined;
  }
  
  let cleanDesc = description.replace(/\s+/g, ' ').trim();
  const SAFE_LENGTH = 950;
  
  if (cleanDesc.length <= SAFE_LENGTH) {
    return cleanDesc;
  }
  
  return cleanDesc.substring(0, SAFE_LENGTH - 3) + '...';
}

export function sanitizeSchema(
  schema: MCPInputSchema | JSONSchema,
  rootDefs?: Record<string, JSONSchema>,
  _depth?: number
): SanitizedSchema {
  const depth = _depth ?? 0;

  if (schema === null || typeof schema !== 'object') {
    throw new Error('Invalid input: schema must be an object');
  }

  if (depth > MAX_SCHEMA_DEPTH) {
    return { type: 'object' };
  }

  if (Array.isArray(schema)) {
    const result: SanitizedSchema[] = schema.map((item) => sanitizeSchema(item, rootDefs, depth + 1));
    return result[0] as unknown as SanitizedSchema;
  }

  const defs = rootDefs || extractDefs(schema as Record<string, unknown>);
  const resolved = resolveSchemaRefs(schema, defs, new Set<string>());

  const result: SanitizedSchema = {};

  for (const [key, value] of Object.entries(resolved)) {
    if (!PRESERVE_KEYS.has(key)) {
      continue;
    }

    if (key === 'properties' && typeof value === 'object' && value !== null) {
      const props: Record<string, SanitizedSchema> = {};
      for (const [propName, propSchema] of Object.entries(value as Record<string, JSONSchema>)) {
        if (propSchema && typeof propSchema === 'object') {
          const resolvedProp = resolveSchemaRefs(propSchema, defs, new Set<string>());
          const sanitizedProp = sanitizeSchema(resolvedProp, defs, depth + 1);

          if (!sanitizedProp.type) {
            if (sanitizedProp.properties) {
              sanitizedProp.type = 'object';
            } else if (sanitizedProp.items) {
              sanitizedProp.type = 'array';
            } else if (sanitizedProp.enum) {
              sanitizedProp.type = 'string';
            } else {
              sanitizedProp.type = 'string';
            }
          }

          props[propName] = sanitizedProp;
        }
      }
      result.properties = props;
    } else if (key === 'items' && typeof value === 'object' && value !== null) {
      const resolvedItems = resolveSchemaRefs(value as JSONSchema, defs, new Set<string>());
      result.items = sanitizeSchema(resolvedItems, defs, depth + 1);
      if (!result.items.type) {
        result.items.type = 'string';
      }
    } else if (key === 'required' && Array.isArray(value)) {
      result.required = value as string[];
    } else if (key === 'enum' && Array.isArray(value)) {
      result.enum = value;
    } else if (key === 'description') {
      const sanitizedDesc = sanitizeDescription(value);
      if (sanitizedDesc) {
        result.description = sanitizedDesc;
      }
    } else if (key === 'type' || key === 'format') {
      (result as Record<string, unknown>)[key] = value;
    }
  }

  if (result.type !== 'object' && result.properties) {
    delete result.properties;
  }
  
  if (result.type !== 'array' && result.items) {
    delete result.items;
  }

  if (result.required && result.properties) {
    const existingProps = new Set(Object.keys(result.properties));
    result.required = result.required.filter(req => existingProps.has(req));
    
    if (result.required.length === 0) {
      delete result.required;
    }
  } else if (result.required && !result.properties) {
    delete result.required;
  }

  if ('const' in resolved && resolved.const !== undefined) {
    result.enum = [resolved.const];
    if (!result.type) {
      result.type = typeof resolved.const === 'string' ? 'string'
                   : typeof resolved.const === 'number' ? 'number'
                   : typeof resolved.const === 'boolean' ? 'boolean'
                   : 'string';
    }
  }

  return result;
}

// =============================================================================
// Main Sanitizer Class
// =============================================================================

export function createSanitizedTool(
  tool: MCPTool,
  sanitizedName: string
): SanitizedTool {
  if (!tool || typeof tool !== 'object') {
    throw new Error('Invalid input: tool must be an object');
  }

  if (typeof sanitizedName !== 'string') {
    throw new Error('Invalid input: sanitizedName must be a string');
  }

  const sanitizedSchema = tool.inputSchema
    ? sanitizeSchema(tool.inputSchema)
    : { type: 'object' as const, properties: {} };

  return {
    originalName: tool.name,
    sanitizedName: sanitizedName,
    description: sanitizeDescription(tool.description),
    sanitizedSchema: sanitizedSchema,
  };
}

export class MCPToolSanitizer {
  private sanitizedToOriginal: Map<string, string>;
  private originalToSanitized: Map<string, string>;
  private options: Required<SanitizerOptions>;

  constructor(options?: SanitizerOptions) {
    this.options = {
      maxLength: options?.maxLength ?? DEFAULT_MAX_LENGTH,
      replacementChar: options?.replacementChar ?? DEFAULT_REPLACEMENT,
      preserveMcpPrefix: options?.preserveMcpPrefix ?? false,
    };

    this.sanitizedToOriginal = new Map();
    this.originalToSanitized = new Map();
  }

  sanitizeTool(tool: MCPTool): SanitizedTool {
    if (!tool || typeof tool !== 'object') {
      throw new Error('Invalid input: tool must be an object');
    }

    if (typeof tool.name !== 'string') {
      throw new Error('Invalid input: tool.name must be a string');
    }

    const sanitizedName = sanitizeToolName(tool.name, this.options);
    const sanitizedTool = createSanitizedTool(tool, sanitizedName);

    this.sanitizedToOriginal.set(sanitizedName, tool.name);
    this.originalToSanitized.set(tool.name, sanitizedName);

    return sanitizedTool;
  }

  sanitizeTools(tools: MCPTool[]): SanitizedTool[] {
    if (!Array.isArray(tools)) {
      throw new Error('Invalid input: tools must be an array');
    }

    const results: SanitizedTool[] = [];

    for (const tool of tools) {
      const sanitized = this.sanitizeTool(tool);
      results.push(sanitized);
    }

    const nameCount = new Map<string, number>();
    for (const tool of results) {
      nameCount.set(tool.sanitizedName, (nameCount.get(tool.sanitizedName) || 0) + 1);
    }

    const deduplicatedResults: SanitizedTool[] = [];
    const suffixCounters = new Map<string, number>();

    for (const tool of results) {
      let finalName = tool.sanitizedName;
      const count = nameCount.get(finalName) || 0;

      if (count > 1) {
        const suffixNum = (suffixCounters.get(finalName) || 0) + 1;
        suffixCounters.set(finalName, suffixNum);
        finalName = `${tool.sanitizedName}_${suffixNum}`;

        this.sanitizedToOriginal.delete(tool.sanitizedName);
        this.sanitizedToOriginal.set(finalName, tool.originalName);
        this.originalToSanitized.set(tool.originalName, finalName);
      }

      deduplicatedResults.push({
        ...tool,
        sanitizedName: finalName
      });
    }

    return deduplicatedResults;
  }

  getOriginalName(sanitizedName: string): string | undefined {
    if (typeof sanitizedName !== 'string') {
      throw new Error('Invalid input: sanitizedName must be a string');
    }

    return this.sanitizedToOriginal.get(sanitizedName);
  }

  getSanitizedName(originalName: string): string | undefined {
    if (typeof originalName !== 'string') {
      throw new Error('Invalid input: originalName must be a string');
    }

    return this.originalToSanitized.get(originalName);
  }

  hasSanitizedName(sanitizedName: string): boolean {
    return this.sanitizedToOriginal.has(sanitizedName);
  }

  hasOriginalName(originalName: string): boolean {
    return this.originalToSanitized.has(originalName);
  }

  getAllSanitizedNames(): string[] {
    return Array.from(this.sanitizedToOriginal.keys());
  }

  getAllOriginalNames(): string[] {
    return Array.from(this.originalToSanitized.keys());
  }

  clear(): void {
    this.sanitizedToOriginal.clear();
    this.originalToSanitized.clear();
  }

  toGeminiFunction(sanitizedTool: SanitizedTool): GeminiFunctionDeclaration {
    return {
      name: sanitizedTool.sanitizedName,
      description: sanitizedTool.description,
      parameters: sanitizedTool.sanitizedSchema as GeminiFunctionDeclaration['parameters'],
    };
  }

  toGeminiFunctions(sanitizedTools: SanitizedTool[]): GeminiFunctionDeclaration[] {
    return sanitizedTools.map((tool) => this.toGeminiFunction(tool));
  }
}

// =============================================================================
// Utility Functions
// =============================================================================

export function isValidGeminiName(name: string): boolean {
  if (typeof name !== 'string') {
    return false;
  }

  if (name.length === 0 || name.length > DEFAULT_MAX_LENGTH) {
    return false;
  }

  if (!VALID_START_CHAR.test(name)) {
    return false;
  }

  return ALLOWED_NAME_CHARS.test(name);
}

export function isSchemaSanitized(schema: JSONSchema): boolean {
  if (!schema || typeof schema !== 'object') {
    return false;
  }

  for (const key of Object.keys(schema)) {
    if (!PRESERVE_KEYS.has(key)) {
      return false;
    }
  }

  return true;
}

export function generateUniqueSanitizedName(
  name: string,
  existingNames: Set<string>,
  options?: SanitizerOptions
): string {
  const baseName = sanitizeToolName(name, options);
  
  if (!existingNames.has(baseName)) {
    return baseName;
  }
  
  let suffix = 1;
  
  while (true) {
    const suffixStr = String(suffix);
    const maxSuffixLength = suffixStr.length + 1;
    const truncated = baseName.slice(0, DEFAULT_MAX_LENGTH - maxSuffixLength);
    const candidate = `${truncated}_${suffixStr}`;
    
    if (!existingNames.has(candidate)) {
      return candidate;
    }
    
    suffix++;
  }
}
