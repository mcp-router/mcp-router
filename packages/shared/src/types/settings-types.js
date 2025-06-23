/**
 * アプリケーション設定の型定義
 */
/**
 * デフォルトのアプリケーション設定
 */
export const DEFAULT_APP_SETTINGS = {
  invitationCode: "",
  invitedAt: "",
  userId: "",
  authToken: "",
  loggedInAt: "",
  mcpDisplayRules: {
    toolNameRule: "{name}",
    toolDescriptionRule: "[{serverName}] {description}",
    resourceNameRule: "{name}",
    resourceDescriptionRule: "[{serverName}] {description}",
    promptNameRule: "{name}",
    promptDescriptionRule: "[{serverName}] {description}",
    resourceTemplateNameRule: "{name}",
    resourceTemplateDescriptionRule: "[{serverName}] {description}",
  },
  packageManagerOverlayDisplayCount: 0,
};
