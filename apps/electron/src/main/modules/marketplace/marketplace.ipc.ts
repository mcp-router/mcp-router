import { ipcMain } from "electron";
import { getMarketplaceService } from "./marketplace.service";
import {
  getSkillsRegistryService,
  type SkillsSearchOptions,
} from "./skills-registry.service";
import { getSkillService } from "../skills/skills.service";
import { getUnifiedSkillsService } from "../skills/unified-skills.service";
import { SkillRepository } from "../skills/skills.repository";
import { validateSkillName } from "@/main/utils/path-security";
import type { MarketplaceSearchOptions } from "./marketplace.types";

export function setupMarketplaceHandlers(): void {
  const service = getMarketplaceService();

  ipcMain.handle(
    "marketplace:search",
    async (_, options: MarketplaceSearchOptions) => {
      return service.searchServers(options);
    },
  );

  ipcMain.handle("marketplace:details", async (_, serverName: string) => {
    return service.getServerDetails(serverName);
  });

  ipcMain.handle("marketplace:readme", async (_, repoUrl: string) => {
    return service.fetchReadme(repoUrl);
  });

  ipcMain.handle("marketplace:clearCache", async () => {
    service.clearCache();
    return { success: true };
  });

  ipcMain.handle("marketplace:githubStats", async (_, repoUrl: string) => {
    return service.getGitHubStats(repoUrl);
  });

  ipcMain.handle(
    "marketplace:githubStatsBatch",
    async (_, repoUrls: string[]) => {
      const results = await service.getGitHubStatsBatch(repoUrls);
      // Convert Map to object for IPC serialization
      const obj: Record<
        string,
        {
          stars: number;
          forks: number;
          openIssues: number;
          watchers: number;
        } | null
      > = {};
      results.forEach((value, key) => {
        obj[key] = value;
      });
      return obj;
    },
  );

  // Skills Registry Handlers
  const skillsRegistryService = getSkillsRegistryService();
  const skillService = getSkillService();

  ipcMain.handle(
    "marketplace:skills:search",
    async (_, options: SkillsSearchOptions) => {
      return skillsRegistryService.searchSkills(options);
    },
  );

  ipcMain.handle("marketplace:skills:details", async (_, skillName: string) => {
    return skillsRegistryService.getSkillDetails(skillName);
  });

  ipcMain.handle("marketplace:skills:content", async (_, repoUrl: string) => {
    return skillsRegistryService.fetchSkillMd(repoUrl);
  });

  ipcMain.handle(
    "marketplace:skills:install",
    async (
      _,
      options: {
        skillId: string;
        repoUrl: string;
        targetName?: string;
        projectId?: string | null;
      },
    ) => {
      // Validate skill name using centralized validation
      const skillName = options.targetName || options.skillId;
      const nameValidation = validateSkillName(skillName);
      if (!nameValidation.valid) {
        return { success: false, error: nameValidation.error };
      }

      // Check if skill already exists to prevent race conditions
      const skillRepo = SkillRepository.getInstance();
      const existingSkill = skillRepo.findByName(skillName);
      if (existingSkill) {
        return {
          success: false,
          error: `Skill "${skillName}" already exists`,
          existingSkillId: existingSkill.id,
        };
      }

      // Validate repoUrl
      if (!options.repoUrl || typeof options.repoUrl !== "string") {
        return { success: false, error: "Repository URL is required" };
      }
      if (options.repoUrl.length > 500) {
        return { success: false, error: "Repository URL too long" };
      }

      // Fetch skill content from GitHub
      const content = await skillsRegistryService.fetchSkillMd(options.repoUrl);

      // Check if content was fetched successfully
      if (!content) {
        return {
          success: false,
          error:
            "Failed to fetch skill content from repository. The repository may not contain a SKILL.md file or is inaccessible.",
        };
      }

      // Add content validation
      // Check maximum size (1MB limit)
      if (content.length > 1_000_000) {
        return {
          success: false,
          error: "Skill content exceeds maximum size (1MB)",
        };
      }
      // Check for null bytes (binary content)
      if (content.includes("\0")) {
        return {
          success: false,
          error: "Invalid skill content (binary data detected)",
        };
      }

      // Only create skill if we have valid content
      const skill = skillService.create({
        name: options.targetName || options.skillId,
        projectId: options.projectId ?? undefined,
      });

      // Write content through the unified service for proper per-client state management
      await getUnifiedSkillsService().updateUnified(skill.id, { content });

      return { success: true, skillId: skill.id };
    },
  );
}
