/**
 * Utility functions for processing MCP display rules
 * Rules allow customizing the display of MCP tools, resources, and prompts
 * by applying templates to their names and descriptions.
 */

import { getSettingsService } from "@/main/application/settings/settings-service";
import { DEFAULT_DISPLAY_RULES } from "@mcp_router/shared";

/**
 * Apply display rules to an input schema's parameter descriptions
 * @param inputSchema The JSON schema for tool parameters
 * @param toolName Original tool name
 * @param serverName Server name
 * @returns A modified JSON schema with descriptions updated according to rules
 */
export function applyRulesToInputSchema(
  inputSchema: any,
  toolName: string,
  serverName: string,
): any {
  if (!inputSchema || typeof inputSchema !== "object") {
    return inputSchema;
  }

  // Get display rules from settings service
  const settingsService = getSettingsService();
  const settings = settingsService.getSettings();
  const displayRules = settings.mcpDisplayRules || DEFAULT_DISPLAY_RULES;

  const paramRule =
    displayRules.toolParameterRule || DEFAULT_DISPLAY_RULES.toolParameterRule!;

  // Create a deep clone of the schema to avoid modifying the original
  const modifiedSchema = JSON.parse(JSON.stringify(inputSchema));

  // Add additional top-level properties from the rule to the schema
  if (paramRule?.properties) {
    // Ensure properties object exists
    if (!modifiedSchema.properties) {
      modifiedSchema.properties = {};
    }

    // Add all properties from the rule to the schema
    Object.keys(paramRule.properties).forEach((propKey) => {
      modifiedSchema.properties[propKey] = JSON.parse(
        JSON.stringify(paramRule.properties![propKey]),
      );
    });
  }

  // Process properties in the schema
  if (modifiedSchema.properties) {
    // For each parameter in the properties
    Object.keys(modifiedSchema.properties).forEach((paramName) => {
      const param = modifiedSchema.properties[paramName];

      if (param && param.description) {
        // Add additional properties from the rule
        if (paramRule?.properties) {
          Object.keys(paramRule.properties).forEach((propKey) => {
            param[propKey] = JSON.parse(
              JSON.stringify(paramRule.properties![propKey]),
            );
          });
        }
      }

      // Recursively process nested properties if any
      if (param.properties) {
        param.properties = applyRulesToInputSchema(
          param.properties,
          toolName,
          serverName,
        ).properties;
      }

      // Process items for array types
      if (param.items && typeof param.items === "object") {
        if (param.items.description) {
          // Add additional properties from the rule
          if (paramRule?.properties) {
            Object.keys(paramRule.properties).forEach((propKey) => {
              param.items[propKey] = JSON.parse(
                JSON.stringify(paramRule.properties![propKey]),
              );
            });
          }
        }

        // Recursively process items properties if any
        if (param.items.properties) {
          param.items.properties = applyRulesToInputSchema(
            param.items.properties,
            toolName,
            serverName,
          ).properties;
        }
      }
    });
  }

  // Apply additional required fields from the rule if applicable
  if (paramRule?.required && Array.isArray(paramRule.required)) {
    // Ensure required array exists
    if (!modifiedSchema.required) {
      modifiedSchema.required = [];
    }

    // Add any required fields from the rule that aren't already in the schema
    paramRule.required!.forEach((requiredField: string) => {
      if (!modifiedSchema.required.includes(requiredField)) {
        modifiedSchema.required.push(requiredField);
      }
    });
  }

  return modifiedSchema;
}
