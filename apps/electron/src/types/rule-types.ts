/**
 * Interface for MCP display rules
 */
export interface MCPDisplayRules {
  /**
   * Rule for tool names
   * Available variables: {name}, {serverName}
   */
  toolNameRule?: string;

  /**
   * Rule for tool descriptions
   * Available variables: {description}, {serverName}, {name}
   */
  toolDescriptionRule?: string;

  /**
   * Rule for tool parameter descriptions in input schema
   * Object with properties and required fields to extend the schema
   */
  toolParameterRule?: ToolParameterSchemaRule;

  /**
   * Rule for resource names
   * Available variables: {name}, {serverName}
   */
  resourceNameRule?: string;

  /**
   * Rule for resource descriptions
   * Available variables: {description}, {serverName}, {name}
   */
  resourceDescriptionRule?: string;

  /**
   * Rule for prompt names
   * Available variables: {name}, {serverName}
   */
  promptNameRule?: string;

  /**
   * Rule for prompt descriptions
   * Available variables: {description}, {serverName}, {name}
   */
  promptDescriptionRule?: string;

  /**
   * Rule for resource template names
   * Available variables: {name}, {serverName}
   */
  resourceTemplateNameRule?: string;

  /**
   * Rule for resource template descriptions
   * Available variables: {description}, {serverName}, {name}
   */
  resourceTemplateDescriptionRule?: string;
}

/**
 * Schema extension rule for tool parameters
 */
export interface ToolParameterSchemaRule {
  /**
   * Additional properties to add to the schema
   */
  properties?: Record<string, any>;

  /**
   * Additional required parameters
   */
  required?: string[];
}

// Default rules if not specified in settings
export const DEFAULT_DISPLAY_RULES: MCPDisplayRules = {
  toolNameRule: "{name}",
  toolDescriptionRule: "[{serverName}] {description}",
  toolParameterRule: {
    properties: {},
    required: [],
  },
  resourceNameRule: "{name}",
  resourceDescriptionRule: "[{serverName}] {description}",
  promptNameRule: "{name}",
  promptDescriptionRule: "[{serverName}] {description}",
  resourceTemplateNameRule: "{name}",
  resourceTemplateDescriptionRule: "[{serverName}] {description}",
};

/**
 * Variables object for rule application
 */
export interface RuleVariables {
  name: string;
  description: string;
  serverName: string;
  [key: string]: string;
}

/**
 * Type of MCP entity for display rules
 */
export type MCPEntityType = "tool" | "resource" | "prompt" | "resourceTemplate";
