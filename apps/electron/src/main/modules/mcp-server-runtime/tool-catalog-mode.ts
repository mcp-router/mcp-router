import { getSharedConfigManager } from "@/main/infrastructure/shared-config-manager";
import type { AppSettings } from "@mcp_router/shared";

export function normalizeClientId(clientId: string): string {
  return clientId.trim().toLowerCase();
}

export function normalizeToolCatalogOverrides(
  overrides: unknown,
): Record<string, boolean> {
  if (!overrides || typeof overrides !== "object" || Array.isArray(overrides)) {
    return {};
  }

  const normalized: Record<string, boolean> = {};

  for (const [rawClientId, value] of Object.entries(overrides)) {
    const clientId = normalizeClientId(rawClientId);
    if (!clientId || typeof value !== "boolean") {
      continue;
    }
    normalized[clientId] = value;
  }

  return normalized;
}

export function getEffectiveToolCatalogEnabled(
  clientId: string,
  settings?: AppSettings,
): boolean {
  const resolvedSettings = settings ?? getSharedConfigManager().getSettings();
  const normalizedClientId = normalizeClientId(clientId);
  const overrides = normalizeToolCatalogOverrides(
    resolvedSettings.toolCatalogOverridesByClient,
  );

  if (normalizedClientId && normalizedClientId in overrides) {
    return overrides[normalizedClientId] === true;
  }

  return resolvedSettings.toolCatalogEnabled === true;
}
