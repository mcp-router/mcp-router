import { describe, expect, it } from "vitest";
import {
  getEffectiveToolCatalogEnabled,
  normalizeToolCatalogOverrides,
} from "../tool-catalog-mode";
import type { AppSettings } from "@mcp_router/shared";

describe("tool-catalog-mode", () => {
  describe("normalizeToolCatalogOverrides", () => {
    it("returns empty object for non-object values", () => {
      expect(normalizeToolCatalogOverrides(undefined)).toEqual({});
      expect(normalizeToolCatalogOverrides(null)).toEqual({});
      expect(normalizeToolCatalogOverrides("bad")).toEqual({});
      expect(normalizeToolCatalogOverrides([])).toEqual({});
    });

    it("normalizes client IDs and drops invalid entries", () => {
      const overrides = normalizeToolCatalogOverrides({
        Cursor: true,
        "  Claude-Desktop  ": false,
        "   ": true,
        Codex: "nope",
      });

      expect(overrides).toEqual({
        cursor: true,
        "claude-desktop": false,
      });
    });
  });

  describe("getEffectiveToolCatalogEnabled", () => {
    it("falls back to global default when no override exists", () => {
      const settings: AppSettings = {
        toolCatalogEnabled: true,
        toolCatalogOverridesByClient: {},
      };
      expect(getEffectiveToolCatalogEnabled("cursor", settings)).toBe(true);
      expect(getEffectiveToolCatalogEnabled("unknown", settings)).toBe(true);
    });

    it("uses override when present", () => {
      const settings: AppSettings = {
        toolCatalogEnabled: false,
        toolCatalogOverridesByClient: {
          cursor: true,
          "claude-desktop": false,
        },
      };

      expect(getEffectiveToolCatalogEnabled("cursor", settings)).toBe(true);
      expect(getEffectiveToolCatalogEnabled("claude-desktop", settings)).toBe(
        false,
      );
    });

    it("normalizes client IDs before lookup", () => {
      const settings: AppSettings = {
        toolCatalogEnabled: false,
        toolCatalogOverridesByClient: {
          cursor: true,
        },
      };
      expect(getEffectiveToolCatalogEnabled("  CURSOR  ", settings)).toBe(true);
    });

    it("ignores malformed override values and falls back", () => {
      const settings = {
        toolCatalogEnabled: false,
        toolCatalogOverridesByClient: {
          cursor: "true",
        },
      } as unknown as AppSettings;

      expect(getEffectiveToolCatalogEnabled("cursor", settings)).toBe(false);
    });
  });
});
