/**
 * Type definitions for MCP Tool Sanitizer
 */

export interface JSONSchema {
  type?: string;
  format?: string;
  description?: string;
  enum?: unknown[];
  properties?: Record<string, JSONSchema>;
  required?: string[];
  additionalProperties?: boolean | JSONSchema;
  items?: JSONSchema | JSONSchema[];
  default?: unknown;
  examples?: unknown[];
  nullable?: boolean;
  anyOf?: JSONSchema[];
  allOf?: JSONSchema[];
  readOnly?: boolean;
  writeOnly?: boolean;
  $schema?: string;
  title?: string;
  prefixItems?: JSONSchema[];
  contains?: JSONSchema;
  minContains?: number;
  maxContains?: number;
  minimum?: number;
  maximum?: number;
  exclusiveMinimum?: number;
  exclusiveMaximum?: number;
  multipleOf?: number;
  minLength?: number;
  maxLength?: number;
  pattern?: string;
  minItems?: number;
  maxItems?: number;
  uniqueItems?: boolean;
  minProperties?: number;
  maxProperties?: number;
  propertyNames?: JSONSchema;
  [key: string]: unknown;
}

export interface MCPInputSchema {
  type: string;
  properties?: Record<string, JSONSchema>;
  required?: string[];
  [key: string]: unknown;
}

export interface MCPTool {
  name: string;
  description?: string;
  inputSchema?: MCPInputSchema;
  prefix?: string;
}

export interface SanitizedSchema {
  type?: string;
  format?: string;
  description?: string;
  enum?: unknown[];
  properties?: Record<string, SanitizedSchema>;
  required?: string[];
  items?: SanitizedSchema;
}

export interface SanitizedTool {
  originalName: string;
  sanitizedName: string;
  description?: string;
  sanitizedSchema: SanitizedSchema;
}

export interface NameMapping {
  original: string;
  sanitized: string;
}

export interface SanitizerOptions {
  maxLength?: number;
  replacementChar?: string;
  preserveMcpPrefix?: boolean;
}

export interface SanitizationResult {
  tools: SanitizedTool[];
  nameMap: Map<string, string>;
  errors: Array<{ tool: string; error: string }>;
}

export interface GeminiParameter {
  type: string;
  description?: string;
  enum?: string[];
  properties?: Record<string, GeminiParameter>;
  required?: string[];
}

export interface GeminiFunctionDeclaration {
  name: string;
  description?: string;
  parameters: GeminiParameter;
}
