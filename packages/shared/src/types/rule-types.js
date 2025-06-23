// Default rules if not specified in settings
export const DEFAULT_DISPLAY_RULES = {
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
