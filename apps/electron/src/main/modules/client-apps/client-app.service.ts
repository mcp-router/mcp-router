import { promises as fsPromises } from "fs";
import os from "os";
import path from "path";
import { SingletonService } from "@/main/modules/singleton-service";
import { SkillsFileManager } from "@/main/modules/skills/skills-file-manager";
import {
  getSymlinkTargetPath,
  expandHomePath,
} from "@/main/modules/skills/skills-agent-paths";
import { SkillRepository } from "@/main/modules/skills/skills.repository";
import { getServerService } from "@/main/modules/mcp-server-manager/server-service";
import { TokenManager } from "./token-manager";
import {
  isPathContained,
  isPathAllowed,
  validateSkillSymlinkTarget,
} from "@/main/utils/path-security";
import type {
  ClientApp,
  CreateClientAppInput,
  UpdateClientAppInput,
  ClientAppResult,
  ClientDetectionResult,
  TokenServerAccess,
  StandardClientDefinition,
  DiscoveredSkill,
  Token,
} from "@mcp_router/shared";
import { STANDARD_CLIENTS, getClientById } from "./client-definitions";
import { ClientAppRepository } from "./client-app.repository";
import {
  detectClient,
  detectAllClients,
  resolveGlobPath,
} from "./client-detector";

// SVG icon imports
import claudeIcon from "../../../../public/images/apps/claude.svg";
import clineIcon from "../../../../public/images/apps/cline.svg";
import windsurfIcon from "../../../../public/images/apps/windsurf.svg";
import cursorIcon from "../../../../public/images/apps/cursor.svg";
import vscodeIcon from "../../../../public/images/apps/vscode.svg";
import openAiIcon from "../../../../public/images/apps/openai.svg";
import githubIcon from "../../../../public/images/apps/github.svg";
import opencodeIcon from "../../../../public/images/apps/opencode.svg";
import googleIcon from "../../../../public/images/apps/google.svg";
import geminiIcon from "../../../../public/images/apps/gemini.svg";
import traeIcon from "../../../../public/images/apps/trae.svg";
import roocodeIcon from "../../../../public/images/apps/roocode.svg";
import gooseIcon from "../../../../public/images/apps/goose.svg";
import continueIcon from "../../../../public/images/apps/continue.svg";
import factoryIcon from "../../../../public/images/apps/factory.svg";
import antigravityIcon from "../../../../public/images/apps/antigravity.svg";

// Icon key to SVG mapping with inlined strings to bypass build caching
const ICON_MAP: Record<string, string> = {
  claude: claudeIcon,
  cline: clineIcon,
  windsurf: `<svg width="24" height="24" viewBox="0 0 1024 1024" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M897.246 286.869H889.819C850.735 286.808 819.017 318.46 819.017 357.539V515.589C819.017 547.15 792.93 572.716 761.882 572.716C743.436 572.716 725.02 563.433 714.093 547.85L552.673 317.304C539.28 298.16 517.486 286.747 493.895 286.747C457.094 286.747 423.976 318.034 423.976 356.657V515.619C423.976 547.181 398.103 572.746 366.842 572.746C348.335 572.746 329.949 563.463 319.021 547.881L138.395 289.882C134.316 284.038 125.154 286.93 125.154 294.052V431.892C125.154 438.862 127.285 445.619 131.272 451.34L309.037 705.2C319.539 720.204 335.033 731.344 352.9 735.392C397.616 745.557 438.77 711.135 438.77 667.278V508.406C438.77 476.845 464.339 451.279 495.904 451.279H495.995C515.02 451.279 532.857 460.562 543.785 476.145L705.235 706.661C718.659 725.835 739.327 737.218 763.983 737.218C801.606 737.218 833.841 705.9 833.841 667.308V508.376C833.841 476.815 859.41 451.249 890.975 451.249H897.276C901.233 451.249 904.43 448.053 904.43 444.097V294.021C904.43 290.065 901.233 286.869 897.276 286.869H897.246Z" fill="currentColor"/></svg>`,
  cursor: `<svg height="24" viewBox="0 0 24 24" width="24" xmlns="http://www.w3.org/2000/svg"><title>Cursor</title><path d="M11.925 24l10.425-6-10.425-6L1.5 18l10.425 6z" fill="currentColor" fill-opacity="0.6"></path><path d="M22.35 18V6L11.925 0v12l10.425 6z" fill="currentColor" fill-opacity="0.4"></path><path d="M11.925 0L1.5 6v12l10.425-6V0z" fill="currentColor" fill-opacity="0.8"></path><path d="M22.35 6L11.925 24V12L22.35 6z" fill="currentColor" fill-opacity="0.2"></path><path d="M22.35 6l-10.425 6L1.5 6h20.85z" fill="currentColor"></path></svg>`,
  vscode: vscodeIcon,
  openai: `<svg viewBox="0 0 512 512" xmlns="http://www.w3.org/2000/svg" fill-rule="evenodd" clip-rule="evenodd" stroke-linejoin="round" stroke-miterlimit="2"><path d="M474.123 209.81c11.525-34.577 7.569-72.423-10.838-103.904-27.696-48.168-83.433-72.94-137.794-61.414a127.14 127.14 0 00-95.475-42.49c-55.564 0-104.936 35.781-122.139 88.593-35.781 7.397-66.574 29.76-84.637 61.414-27.868 48.167-21.503 108.72 15.826 150.007-11.525 34.578-7.569 72.424 10.838 103.733 27.696 48.34 83.433 73.111 137.966 61.585 24.084 27.18 58.833 42.835 95.303 42.663 55.564 0 104.936-35.782 122.139-88.594 35.782-7.397 66.574-29.76 84.465-61.413 28.04-48.168 21.676-108.722-15.654-150.008v-.172zm-39.567-87.218c11.01 19.267 15.139 41.803 11.354 63.65-.688-.516-2.064-1.204-2.924-1.72l-101.152-58.49a16.965 16.965 0 00-16.687 0L206.621 194.5v-50.232l97.883-56.597c45.587-26.32 103.732-10.666 130.052 34.921zm-227.935 104.42l49.888-28.9 49.887 28.9v57.63l-49.887 28.9-49.888-28.9v-57.63zm23.223-191.81c22.364 0 43.867 7.742 61.07 22.02-.688.344-2.064 1.204-3.097 1.72L186.666 117.26c-5.161 2.925-8.258 8.43-8.258 14.45v136.934l-43.523-25.116V130.333c0-52.64 42.491-95.13 95.131-95.302l-.172.172zM52.14 168.697c11.182-19.268 28.557-34.062 49.544-41.803V247.14c0 6.02 3.097 11.354 8.258 14.45l118.354 68.295-43.695 25.288-97.711-56.425c-45.415-26.32-61.07-84.465-34.75-130.052zm26.665 220.71c-11.182-19.095-15.139-41.802-11.354-63.65.688.516 2.064 1.204 2.924 1.72l101.152 58.49a16.965 16.965 0 0016.687 0l118.354-68.467v50.232l-97.883 56.425c-45.587 26.148-103.732 10.665-130.052-34.75h.172zm204.54 87.39c-22.192 0-43.867-7.741-60.898-22.02a62.439 62.439 0 003.097-1.72l101.152-58.317c5.16-2.924 8.429-8.43 8.257-14.45V243.527l43.523 25.116v113.022c0 52.64-42.663 95.303-95.131 95.303v-.172zM461.22 343.303c-11.182 19.267-28.729 34.061-49.544 41.63V264.687c0-6.021-3.097-11.526-8.257-14.45L284.893 181.77l43.523-25.116 97.883 56.424c45.587 26.32 61.07 84.466 34.75 130.053l.172.172z" fill="currentColor" fill-rule="nonzero"/></svg>`,
  github: githubIcon,
  terminal: opencodeIcon,
  google: googleIcon,
  gemini: geminiIcon,
  trae: traeIcon,
  roocode: roocodeIcon,
  goose: gooseIcon,
  continue: continueIcon,
  factory: factoryIcon,
  antigravity: antigravityIcon,
};

// ==========================================================================
// Discovery Cache for Performance Optimization
// ==========================================================================

interface DiscoveryCache {
  skills: DiscoveredSkill[];
  timestamp: number;
}

interface McpConfigStatus {
  mcpConfigured: boolean;
  hasOtherMcpServers: boolean;
}

// Cache TTL in milliseconds (30 seconds)
const DISCOVERY_CACHE_TTL = 30_000;

/**
 * Unified Client App Service
 *
 * Merges McpAppsManagerService + AgentPath functionality into a single service.
 * Manages both MCP configuration and skills symlinks for AI clients.
 */
export class ClientAppService extends SingletonService<
  ClientApp,
  string,
  ClientAppService
> {
  private skillsFileManager: SkillsFileManager;
  private discoveryCache: DiscoveryCache | null = null;
  private mcpConfigCache: Map<
    string,
    { status: McpConfigStatus; timestamp: number }
  > = new Map();

  protected constructor() {
    super();
    this.skillsFileManager = new SkillsFileManager();
  }

  /**
   * Invalidate the discovery cache (call when skills change)
   */
  public invalidateDiscoveryCache(): void {
    this.discoveryCache = null;
  }

  /**
   * Invalidate MCP config cache for a specific path or all
   */
  public invalidateMcpConfigCache(configPath?: string): void {
    if (configPath) {
      this.mcpConfigCache.delete(configPath);
    } else {
      this.mcpConfigCache.clear();
    }
  }

  protected getEntityName(): string {
    return "ClientApp";
  }

  public static getInstance(): ClientAppService {
    return (this as any).getInstanceBase();
  }

  public static resetInstance(): void {
    this.resetInstanceBase(ClientAppService);
  }

  // ==========================================================================
  // Core CRUD Methods
  // ==========================================================================

  /**
   * List all client apps (standard + custom) with detection status
   */
  public async list(): Promise<ClientApp[]> {
    try {
      // Get standard clients with their detection status
      const standardClients = await this.getStandardClients();

      // Get standard client names for deduplication (case-insensitive)
      const standardClientNames = new Set(
        STANDARD_CLIENTS.map((c) => c.name.toLowerCase()),
      );
      const standardClientIds = new Set(STANDARD_CLIENTS.map((c) => c.id));

      // Get custom clients from repository, filtering out duplicates of standard clients
      const repo = ClientAppRepository.getInstance();
      const customClients = repo
        .getAll({ orderBy: "name" })
        .filter(
          (client) =>
            client.isCustom &&
            !standardClientNames.has(client.name.toLowerCase()) &&
            !standardClientIds.has(client.id),
        );

      // Combine and return
      return [...standardClients, ...customClients];
    } catch (error) {
      return this.handleError("list", error, []);
    }
  }

  /**
   * Get a single client app by ID
   */
  public async get(id: string): Promise<ClientApp | null> {
    try {
      // Check if it's a standard client
      const standardDef = STANDARD_CLIENTS.find((c) => c.id === id);
      if (standardDef) {
        return this.buildClientAppFromDefinition(standardDef);
      }

      // Check custom clients
      const repo = ClientAppRepository.getInstance();
      const client = repo.getById(id);
      return client || null;
    } catch (error) {
      return this.handleError("get", error, null);
    }
  }

  /**
   * Create a custom client app
   */
  public async create(input: CreateClientAppInput): Promise<ClientAppResult> {
    try {
      // Validate name
      if (!input.name || input.name.trim() === "") {
        return {
          success: false,
          message: "Client name cannot be empty",
        };
      }

      const name = input.name.trim();

      // Check for duplicates with standard clients
      const standardDef = STANDARD_CLIENTS.find(
        (c) => c.name.toLowerCase() === name.toLowerCase(),
      );
      if (standardDef) {
        return {
          success: false,
          message: `A standard client with the name "${name}" already exists`,
        };
      }

      // Check for duplicates with custom clients
      const repo = ClientAppRepository.getInstance();
      const existing = repo.findByName(name);
      if (existing) {
        return {
          success: false,
          message: `A client with the name "${name}" already exists`,
        };
      }

      // Generate server access (all servers enabled by default)
      const serverAccess = this.generateDefaultServerAccess();

      const now = Date.now();
      const clientApp = repo.add({
        name,
        icon: input.icon,
        installed: true, // Custom clients are always "installed"
        mcpConfigPath: input.mcpConfigPath || "",
        mcpConfigured: false,
        hasOtherMcpServers: false,
        skillsPath: input.skillsPath || "",
        skillsConfigured: false,
        serverAccess,
        isStandard: false,
        isCustom: true,
        createdAt: now,
        updatedAt: now,
      });

      // Create symlinks for all existing skills if skillsPath is provided
      if (clientApp.skillsPath) {
        await this.createSymlinksForClient(clientApp);
      }

      return {
        success: true,
        message: `Successfully created client "${name}"`,
        clientApp,
      };
    } catch (error: any) {
      return {
        success: false,
        message: `Failed to create client: ${error.message}`,
      };
    }
  }

  /**
   * Update a client app
   */
  public async update(
    id: string,
    input: UpdateClientAppInput,
  ): Promise<ClientAppResult> {
    try {
      const repo = ClientAppRepository.getInstance();
      const existing = repo.getById(id);

      if (!existing) {
        // Check if it's a standard client
        const standardDef = STANDARD_CLIENTS.find((c) => c.id === id);
        if (standardDef) {
          return {
            success: false,
            message: "Standard clients cannot be modified directly",
          };
        }

        return {
          success: false,
          message: "Client not found",
        };
      }

      // Handle name change validation
      if (input.name && input.name !== existing.name) {
        const duplicate = repo.findByName(input.name);
        if (duplicate && duplicate.id !== id) {
          return {
            success: false,
            message: `A client with the name "${input.name}" already exists`,
          };
        }
      }

      // Handle skillsPath change
      const oldSkillsPath = existing.skillsPath;
      const newSkillsPath = input.skillsPath ?? existing.skillsPath;

      if (oldSkillsPath !== newSkillsPath) {
        // Remove old symlinks
        if (oldSkillsPath) {
          await this.removeSymlinksForClient(existing);
        }
      }

      // Update the client
      const updated = repo.update(id, {
        ...input,
        updatedAt: Date.now(),
      });

      if (!updated) {
        return {
          success: false,
          message: "Failed to update client",
        };
      }

      // Create new symlinks if skillsPath changed
      if (oldSkillsPath !== newSkillsPath && newSkillsPath) {
        await this.createSymlinksForClient(updated);
      }

      return {
        success: true,
        message: `Successfully updated client "${updated.name}"`,
        clientApp: updated,
      };
    } catch (error: any) {
      return {
        success: false,
        message: `Failed to update client: ${error.message}`,
      };
    }
  }

  /**
   * Delete a custom client app
   */
  public async delete(id: string): Promise<ClientAppResult> {
    try {
      const repo = ClientAppRepository.getInstance();
      const existing = repo.getById(id);

      if (!existing) {
        return {
          success: false,
          message: "Client not found",
        };
      }

      if (existing.isStandard) {
        return {
          success: false,
          message: "Standard clients cannot be deleted",
        };
      }

      // Remove all symlinks for this client
      if (existing.skillsPath) {
        await this.removeSymlinksForClient(existing);
      }

      // Delete from repository
      const deleted = repo.delete(id);

      if (!deleted) {
        return {
          success: false,
          message: "Failed to delete client",
        };
      }

      return {
        success: true,
        message: `Successfully deleted client "${existing.name}"`,
      };
    } catch (error: any) {
      return {
        success: false,
        message: `Failed to delete client: ${error.message}`,
      };
    }
  }

  // ==========================================================================
  // Detection Methods
  // ==========================================================================

  /**
   * Run auto-detection for all clients
   */
  public async detectInstalled(): Promise<ClientDetectionResult[]> {
    try {
      return detectAllClients();
    } catch (error) {
      return this.handleError("detectInstalled", error, []);
    }
  }

  // ==========================================================================
  // MCP Configuration Methods
  // ==========================================================================

  /**
   * Set up MCP config file for a client
   */
  public async configureClient(id: string): Promise<ClientAppResult> {
    try {
      const client = await this.get(id);

      if (!client) {
        return {
          success: false,
          message: "Client not found",
        };
      }

      if (!client.mcpConfigPath) {
        return {
          success: false,
          message: "Client has no MCP config path configured",
        };
      }

      // Generate token for this client
      const token = await this.generateClientToken(client);

      // Write MCP configuration
      await this.writeMcpConfig(client, token);

      // Update client status
      const repo = ClientAppRepository.getInstance();
      if (client.isCustom) {
        repo.update(id, {
          mcpConfigured: true,
          token,
          updatedAt: Date.now(),
        });
      }

      const updatedClient = await this.get(id);

      return {
        success: true,
        message: `Successfully configured MCP for "${client.name}"`,
        clientApp: updatedClient || undefined,
      };
    } catch (error: any) {
      return {
        success: false,
        message: `Failed to configure client: ${error.message}`,
      };
    }
  }

  /**
   * Update server access permissions for a client
   */
  public async updateServerAccess(
    id: string,
    serverAccess: TokenServerAccess,
  ): Promise<ClientAppResult> {
    try {
      const client = await this.get(id);

      if (!client) {
        return {
          success: false,
          message: "Client not found",
        };
      }

      const repo = ClientAppRepository.getInstance();

      if (client.isCustom) {
        const updated = repo.update(id, {
          serverAccess,
          updatedAt: Date.now(),
        });

        if (!updated) {
          return {
            success: false,
            message: "Failed to update server access",
          };
        }

        if (client.token) {
          const tokenManager = new TokenManager();
          tokenManager.updateTokenServerAccess(client.token, serverAccess);
        }

        return {
          success: true,
          message: `Successfully updated server access for "${client.name}"`,
          clientApp: updated,
        };
      }

      // For standard clients, update through token manager
      const tokenManager = new TokenManager();
      const existingToken = this.getTokenForClient(client, tokenManager);
      if (existingToken) {
        const updated = tokenManager.updateTokenServerAccess(
          existingToken.id,
          serverAccess,
        );
        if (!updated) {
          return {
            success: false,
            message: "Failed to update server access",
          };
        }
      } else {
        const tokenId = await this.generateClientToken(client, serverAccess);
        await this.writeMcpConfig(client, tokenId);
      }

      return {
        success: true,
        message: `Successfully updated server access for "${client.name}"`,
        clientApp: (await this.get(id)) || undefined,
      };
    } catch (error: any) {
      return {
        success: false,
        message: `Failed to update server access: ${error.message}`,
      };
    }
  }

  // ==========================================================================
  // Skills Symlink Methods
  // ==========================================================================

  /**
   * Recreate skill symlinks for a specific client
   */
  public async refreshSymlinks(id: string): Promise<ClientAppResult> {
    try {
      const client = await this.get(id);

      if (!client) {
        return {
          success: false,
          message: "Client not found",
        };
      }

      if (!client.skillsPath) {
        return {
          success: false,
          message: "Client has no skills path configured",
        };
      }

      // Remove existing symlinks
      await this.removeSymlinksForClient(client);

      // Create new symlinks
      await this.createSymlinksForClient(client);

      // Update client status
      const repo = ClientAppRepository.getInstance();
      if (client.isCustom) {
        repo.update(id, {
          skillsConfigured: true,
          updatedAt: Date.now(),
        });
      }

      const updatedClient = await this.get(id);

      return {
        success: true,
        message: `Successfully refreshed symlinks for "${client.name}"`,
        clientApp: updatedClient || undefined,
      };
    } catch (error: any) {
      return {
        success: false,
        message: `Failed to refresh symlinks: ${error.message}`,
      };
    }
  }

  /**
   * Create symlinks for all enabled skills to a client's skills path
   *
   * Security: Validates that the skills path is in an allowed location
   * before creating any symlinks.
   */
  private async createSymlinksForClient(client: ClientApp): Promise<void> {
    if (!client.skillsPath) {
      return;
    }

    // SECURITY: Validate the client's skills path before creating symlinks
    const expandedPath = expandHomePath(client.skillsPath);
    const validation = validateSkillSymlinkTarget(expandedPath);
    if (!validation.valid) {
      console.warn(
        `Security: Skipping symlink creation for client ${client.name}: ${validation.error}`,
      );
      return;
    }

    const skillRepo = SkillRepository.getInstance();
    const skills = skillRepo.getAll();

    for (const skill of skills) {
      if (skill.enabled) {
        const skillPath = this.skillsFileManager.getSkillPath(skill.name);
        const targetPath = getSymlinkTargetPath(client.skillsPath, skill.name);
        this.skillsFileManager.createSymlink(skillPath, targetPath);
      }
    }
  }

  /**
   * Remove all skill symlinks from a client's skills path
   */
  private async removeSymlinksForClient(client: ClientApp): Promise<void> {
    if (!client.skillsPath) {
      return;
    }

    const skillRepo = SkillRepository.getInstance();
    const skills = skillRepo.getAll();

    for (const skill of skills) {
      const targetPath = getSymlinkTargetPath(client.skillsPath, skill.name);
      this.skillsFileManager.removeSymlink(targetPath);
    }
  }

  /**
   * Create symlinks for a specific skill to all clients with skills paths
   * Called when a new skill is created or enabled
   *
   * Security: Validates each client's skills path before creating symlinks.
   */
  public async createSymlinksForSkill(skillName: string): Promise<void> {
    try {
      const clients = await this.list();
      const skillPath = this.skillsFileManager.getSkillPath(skillName);

      for (const client of clients) {
        if (client.skillsPath) {
          // SECURITY: Validate the client's skills path
          const expandedPath = expandHomePath(client.skillsPath);
          const validation = validateSkillSymlinkTarget(expandedPath);
          if (!validation.valid) {
            console.warn(
              `Security: Skipping symlink creation for client ${client.name}: ${validation.error}`,
            );
            continue;
          }

          const targetPath = getSymlinkTargetPath(client.skillsPath, skillName);
          this.skillsFileManager.createSymlink(skillPath, targetPath);
        }
      }
    } catch (error) {
      this.handleError("createSymlinksForSkill", error);
    }
  }

  /**
   * Remove symlinks for a specific skill from all clients
   * Called when a skill is deleted or disabled
   */
  public async removeSymlinksForSkill(skillName: string): Promise<void> {
    try {
      const clients = await this.list();

      for (const client of clients) {
        if (client.skillsPath) {
          const targetPath = getSymlinkTargetPath(client.skillsPath, skillName);
          this.skillsFileManager.removeSymlink(targetPath);
        }
      }
    } catch (error) {
      this.handleError("removeSymlinksForSkill", error);
    }
  }

  /**
   * Discover skills from all standard clients' skills paths
   * Scans each client's skills directory for skill folders
   *
   * Performance optimizations:
   * - Uses TTL-based caching (30 seconds) to avoid repeated scans
   * - Parallelizes scanning across all clients using Promise.all
   * - Batches file system operations within each client scan
   *
   * @param forceRefresh If true, bypasses the cache and performs a fresh scan
   * @returns Array of discovered skills with metadata
   */
  public async discoverSkillsFromClients(
    forceRefresh = false,
  ): Promise<DiscoveredSkill[]> {
    // Check cache first (unless force refresh requested)
    if (!forceRefresh && this.discoveryCache) {
      const cacheAge = Date.now() - this.discoveryCache.timestamp;
      if (cacheAge < DISCOVERY_CACHE_TTL) {
        return this.discoveryCache.skills;
      }
    }

    const platform = process.platform as "darwin" | "win32" | "linux";

    // Filter clients that have skills paths for this platform
    const clientsWithSkillsPaths = STANDARD_CLIENTS.filter(
      (client) => client.skillsPath[platform],
    );

    // Scan all clients in parallel
    const clientResults = await Promise.all(
      clientsWithSkillsPaths.map((client) =>
        this.scanClientSkills(client, platform),
      ),
    );

    // Flatten results from all clients
    const discoveredSkills = clientResults.flat();

    // Update cache
    this.discoveryCache = {
      skills: discoveredSkills,
      timestamp: Date.now(),
    };

    return discoveredSkills;
  }

  /**
   * Scan skills for a single client (helper for parallel execution)
   */
  private async scanClientSkills(
    client: StandardClientDefinition,
    platform: "darwin" | "win32" | "linux",
  ): Promise<DiscoveredSkill[]> {
    const skillsPath = client.skillsPath[platform];
    if (!skillsPath) {
      return [];
    }

    try {
      // Expand ~ to home directory if present
      const expandedPath = expandHomePath(skillsPath);

      // Handle glob patterns in the path (e.g., for Claude Desktop's nested UUID paths)
      let pathsToScan: string[];
      if (expandedPath.includes("*")) {
        pathsToScan = resolveGlobPath(expandedPath);
        if (pathsToScan.length === 0) {
          return [];
        }
      } else {
        pathsToScan = [expandedPath];
      }

      // Scan all paths in parallel
      const pathResults = await Promise.all(
        pathsToScan.map((pathToScan) =>
          this.scanSkillsDirectory(pathToScan, client),
        ),
      );

      return pathResults.flat();
    } catch (error) {
      // Log error but continue with other clients
      console.error(`Failed to scan skills for client ${client.name}:`, error);
      return [];
    }
  }

  /**
   * Scan a single skills directory (helper for parallel execution)
   *
   * Security: Validates that the scan path is within user's home directory
   * to prevent scanning sensitive system directories.
   */
  private async scanSkillsDirectory(
    pathToScan: string,
    client: StandardClientDefinition,
  ): Promise<DiscoveredSkill[]> {
    // SECURITY: Validate path is within user's home directory
    const homeDir = os.homedir();
    if (!isPathContained(homeDir, pathToScan)) {
      console.warn(
        `Security: Skipping scan of path outside home directory: ${pathToScan}`,
      );
      return [];
    }

    // SECURITY: Ensure path is not a forbidden system path
    if (!isPathAllowed(pathToScan)) {
      console.warn(
        `Security: Skipping scan of forbidden system path: ${pathToScan}`,
      );
      return [];
    }

    // Check if directory exists
    const exists = await this.fileExists(pathToScan);
    if (!exists) {
      return [];
    }

    // Read directory entries
    const entries = await fsPromises.readdir(pathToScan, {
      withFileTypes: true,
    });

    // Filter valid entries (non-hidden directories and symlinks)
    const validEntries = entries.filter(
      (entry) =>
        !entry.name.startsWith(".") &&
        (entry.isDirectory() || entry.isSymbolicLink()),
    );

    // Process all entries in parallel
    const skillPromises = validEntries.map(async (entry) => {
      const skillFolderPath = path.join(pathToScan, entry.name);
      const isSymlink = entry.isSymbolicLink();

      // Batch the two async operations (symlink read and SKILL.md check)
      const [symlinkTarget, hasSkillMd] = await Promise.all([
        isSymlink
          ? fsPromises.readlink(skillFolderPath).catch(() => undefined)
          : Promise.resolve(undefined),
        fsPromises
          .access(path.join(skillFolderPath, "SKILL.md"))
          .then(() => true)
          .catch(() => false),
      ]);

      return {
        skillName: entry.name,
        skillPath: skillFolderPath,
        sourceClientId: client.id,
        sourceClientName: client.name,
        hasSkillMd,
        isSymlink,
        symlinkTarget,
      } as DiscoveredSkill;
    });

    return Promise.all(skillPromises);
  }

  // ==========================================================================
  // Private Helper Methods
  // ==========================================================================

  /**
   * Get standard clients with their current detection/configuration status
   *
   * Performance optimization: Builds all clients in parallel using Promise.all
   */
  private async getStandardClients(): Promise<ClientApp[]> {
    // Build all clients in parallel
    const clientPromises = STANDARD_CLIENTS.map((def) =>
      this.buildClientAppFromDefinition(def),
    );

    const results = await Promise.all(clientPromises);

    // Filter out null results
    return results.filter((client): client is ClientApp => client !== null);
  }

  /**
   * Build a ClientApp from a standard definition with current status
   *
   * Performance optimization: Uses combined MCP config check to read file once
   * and runs MCP config check + skills config check in parallel
   */
  private async buildClientAppFromDefinition(
    def: StandardClientDefinition,
  ): Promise<ClientApp | null> {
    try {
      const platform = process.platform as "darwin" | "win32" | "linux";

      const mcpConfigPath = def.mcpConfigPath[platform] || "";
      const skillsPath = def.skillsPath[platform] || "";

      // Detect installation status (synchronous)
      const detection = detectClient(def.id);
      const installed = detection?.installed ?? false;

      // Run MCP config check and skills config check in parallel
      // getMcpConfigStatus reads file once and returns both values
      const [mcpConfigStatus, skillsConfigured] = await Promise.all([
        this.getMcpConfigStatus(mcpConfigPath),
        this.checkSkillsConfigured(skillsPath),
      ]);

      // Get server access from token (if configured)
      const tokenManager = new TokenManager();
      const token = this.getTokenForClientDefinition(def, tokenManager);
      const serverAccess =
        token?.serverAccess ?? this.generateDefaultServerAccess();

      const now = Date.now();

      // Convert icon key to SVG using ICON_MAP
      const iconSvg = def.icon ? ICON_MAP[def.icon] : undefined;

      return {
        id: def.id,
        name: def.name,
        icon: iconSvg,
        installed,
        mcpConfigPath,
        mcpConfigured: mcpConfigStatus.mcpConfigured,
        hasOtherMcpServers: mcpConfigStatus.hasOtherMcpServers,
        skillsPath,
        skillsConfigured,
        serverAccess,
        token: token?.id,
        isStandard: true,
        isCustom: false,
        createdAt: now,
        updatedAt: now,
      };
    } catch (error) {
      console.error(`Failed to build client app for ${def.name}:`, error);
      return null;
    }
  }

  /**
   * Generate default server access (all servers enabled)
   */
  private generateDefaultServerAccess(): TokenServerAccess {
    const serverService = getServerService();
    const servers = serverService.getAllServers();
    const serverAccess: TokenServerAccess = {};

    for (const server of servers) {
      serverAccess[server.id] = true;
    }

    return serverAccess;
  }

  private getTokenForClient(
    client: ClientApp,
    tokenManager: TokenManager,
  ): Token | null {
    const tokens = tokenManager.listTokens();
    const normalizedId = client.id.toLowerCase();
    const normalizedName = client.name.toLowerCase();

    return (
      tokens.find((token) => token.clientId.toLowerCase() === normalizedId) ||
      tokens.find((token) => token.clientId.toLowerCase() === normalizedName) ||
      null
    );
  }

  private getTokenForClientDefinition(
    def: StandardClientDefinition,
    tokenManager: TokenManager,
  ): Token | null {
    const tokens = tokenManager.listTokens();
    const normalizedId = def.id.toLowerCase();
    const normalizedName = def.name.toLowerCase();

    return (
      tokens.find((token) => token.clientId.toLowerCase() === normalizedId) ||
      tokens.find((token) => token.clientId.toLowerCase() === normalizedName) ||
      null
    );
  }

  /**
   * Get MCP configuration status (combined check)
   *
   * Performance optimization: Reads the config file once and returns both
   * mcpConfigured and hasOtherMcpServers values. Uses caching with TTL.
   *
   * Handles multiple config formats:
   * - JSON with mcpServers.mcp-router or mcpServers.router
   * - JSON with servers.mcp-router or servers.router
   * - JSON with mcp.router (OpenCode format)
   * - TOML with [mcp_servers.mcp_router] (Codex format)
   */
  private async getMcpConfigStatus(
    configPath: string,
  ): Promise<McpConfigStatus> {
    const defaultStatus: McpConfigStatus = {
      mcpConfigured: false,
      hasOtherMcpServers: false,
    };

    if (!configPath) {
      return defaultStatus;
    }

    // Check cache first
    const cached = this.mcpConfigCache.get(configPath);
    if (cached && Date.now() - cached.timestamp < DISCOVERY_CACHE_TTL) {
      return cached.status;
    }

    try {
      const exists = await this.fileExists(configPath);
      if (!exists) {
        return defaultStatus;
      }

      const content = await fsPromises.readFile(configPath, "utf8");
      const routerKeys = ["mcp-router", "router", "mcp_router"];

      let status: McpConfigStatus;

      // Handle TOML files (Codex uses config.toml)
      if (configPath.endsWith(".toml")) {
        const mcpConfigured =
          content.includes("[mcp_servers.mcp_router]") ||
          content.includes("[mcp_servers.router]") ||
          content.includes("[mcp_servers.mcp-router]");

        let hasOtherMcpServers = false;
        const mcpServerMatches = content.match(/\[mcp_servers\.(\w+)\]/g);
        if (mcpServerMatches) {
          const serverNames = mcpServerMatches.map((m) =>
            m.replace("[mcp_servers.", "").replace("]", ""),
          );
          const otherServers = serverNames.filter(
            (name) => !routerKeys.includes(name),
          );
          hasOtherMcpServers = otherServers.length > 0;
        }

        status = { mcpConfigured, hasOtherMcpServers };
      } else {
        // Parse as JSON for other formats
        const config = JSON.parse(content);
        let mcpConfigured = false;
        let hasOtherMcpServers = false;

        // Check mcpServers format
        if (config.mcpServers) {
          mcpConfigured =
            !!config.mcpServers["mcp-router"] ||
            !!config.mcpServers["router"] ||
            !!config.mcpServers["mcp_router"];

          const otherServers = Object.keys(config.mcpServers).filter(
            (key) => !routerKeys.includes(key),
          );
          if (otherServers.length > 0) {
            hasOtherMcpServers = true;
          }
        }

        // Check servers format (VSCode)
        if (config.servers) {
          if (
            config.servers["mcp-router"] ||
            config.servers["router"] ||
            config.servers["mcp_router"]
          ) {
            mcpConfigured = true;
          }

          const otherServers = Object.keys(config.servers).filter(
            (key) => !routerKeys.includes(key),
          );
          if (otherServers.length > 0) {
            hasOtherMcpServers = true;
          }
        }

        // Check mcp format (OpenCode)
        if (config.mcp) {
          if (
            config.mcp["mcp-router"] ||
            config.mcp["router"] ||
            config.mcp["mcp_router"]
          ) {
            mcpConfigured = true;
          }

          const otherServers = Object.keys(config.mcp).filter(
            (key) => !routerKeys.includes(key),
          );
          if (otherServers.length > 0) {
            hasOtherMcpServers = true;
          }
        }

        status = { mcpConfigured, hasOtherMcpServers };
      }

      // Update cache
      this.mcpConfigCache.set(configPath, {
        status,
        timestamp: Date.now(),
      });

      return status;
    } catch {
      return defaultStatus;
    }
  }

  /**
   * Check if MCP Router is configured in the config file
   * @deprecated Use getMcpConfigStatus for better performance
   * Handles multiple config formats:
   * - JSON with mcpServers.mcp-router or mcpServers.router
   * - JSON with servers.mcp-router or servers.router
   * - JSON with mcp.router (OpenCode format)
   * - TOML with [mcp_servers.mcp_router] (Codex format)
   */
  private async checkMcpConfigured(configPath: string): Promise<boolean> {
    if (!configPath) {
      return false;
    }

    try {
      const exists = await this.fileExists(configPath);
      if (!exists) {
        return false;
      }

      const content = await fsPromises.readFile(configPath, "utf8");

      // Handle TOML files (Codex uses config.toml)
      if (configPath.endsWith(".toml")) {
        // Look for mcp_servers.mcp_router or mcp_servers.router section
        return (
          content.includes("[mcp_servers.mcp_router]") ||
          content.includes("[mcp_servers.router]") ||
          content.includes("[mcp_servers.mcp-router]")
        );
      }

      // Parse as JSON for other formats
      const config = JSON.parse(content);

      // Check for router in mcpServers (various key names)
      if (config.mcpServers) {
        if (
          config.mcpServers["mcp-router"] ||
          config.mcpServers["router"] ||
          config.mcpServers["mcp_router"]
        ) {
          return true;
        }
      }

      // Check servers (VSCode format)
      if (config.servers) {
        if (
          config.servers["mcp-router"] ||
          config.servers["router"] ||
          config.servers["mcp_router"]
        ) {
          return true;
        }
      }

      // Check mcp.router (OpenCode format)
      if (config.mcp) {
        if (
          config.mcp["mcp-router"] ||
          config.mcp["router"] ||
          config.mcp["mcp_router"]
        ) {
          return true;
        }
      }

      return false;
    } catch {
      return false;
    }
  }

  /**
   * Check if there are other MCP servers configured (besides MCP Router)
   * Handles multiple config formats matching checkMcpConfigured
   */
  private async checkHasOtherMcpServers(configPath: string): Promise<boolean> {
    if (!configPath) {
      return false;
    }

    // Router key names to filter out
    const routerKeys = ["mcp-router", "router", "mcp_router"];

    try {
      const exists = await this.fileExists(configPath);
      if (!exists) {
        return false;
      }

      const content = await fsPromises.readFile(configPath, "utf8");

      // Handle TOML files - check for any mcp_servers sections besides router
      if (configPath.endsWith(".toml")) {
        const mcpServerMatches = content.match(/\[mcp_servers\.(\w+)\]/g);
        if (mcpServerMatches) {
          const serverNames = mcpServerMatches.map((m) =>
            m.replace("[mcp_servers.", "").replace("]", ""),
          );
          const otherServers = serverNames.filter(
            (name) => !routerKeys.includes(name),
          );
          return otherServers.length > 0;
        }
        return false;
      }

      // Parse as JSON
      const config = JSON.parse(content);

      // Check mcpServers
      if (config.mcpServers) {
        const servers = Object.keys(config.mcpServers).filter(
          (key) => !routerKeys.includes(key),
        );
        if (servers.length > 0) {
          return true;
        }
      }

      // Check servers (VSCode format)
      if (config.servers) {
        const servers = Object.keys(config.servers).filter(
          (key) => !routerKeys.includes(key),
        );
        if (servers.length > 0) {
          return true;
        }
      }

      // Check mcp (OpenCode format)
      if (config.mcp) {
        const servers = Object.keys(config.mcp).filter(
          (key) => !routerKeys.includes(key),
        );
        if (servers.length > 0) {
          return true;
        }
      }

      return false;
    } catch {
      return false;
    }
  }

  /**
   * Check if skills directory exists and contains skills
   * Skills are considered "configured" when:
   * 1. The skills directory exists (supports glob patterns like * for dynamic paths)
   * 2. The directory contains at least one skill (symlink or directory with skill content)
   */
  private async checkSkillsConfigured(skillsPath: string): Promise<boolean> {
    if (!skillsPath) {
      return false;
    }

    try {
      // Expand ~ to home directory if present
      const expandedPath = expandHomePath(skillsPath);

      // Handle glob patterns in the path (e.g., for Claude Desktop's nested UUID paths)
      let pathsToCheck: string[];
      if (expandedPath.includes("*")) {
        pathsToCheck = resolveGlobPath(expandedPath);
        if (pathsToCheck.length === 0) {
          return false;
        }
      } else {
        pathsToCheck = [expandedPath];
      }

      // Check each resolved path for skills
      for (const pathToCheck of pathsToCheck) {
        // Check if directory exists
        const exists = await this.fileExists(pathToCheck);
        if (!exists) {
          continue;
        }

        // Check if directory contains any skills (symlinks or skill directories)
        const entries = await fsPromises.readdir(pathToCheck, {
          withFileTypes: true,
        });

        // Skills can be:
        // 1. Symlinks to skill directories
        // 2. Directories containing skill files (SKILL.md, *.skill, etc.)
        // Exclude hidden files/directories (starting with .)
        const hasSkills = entries.some(
          (entry) =>
            !entry.name.startsWith(".") &&
            (entry.isSymbolicLink() || entry.isDirectory()),
        );

        if (hasSkills) {
          return true;
        }
      }

      return false;
    } catch {
      return false;
    }
  }

  /**
   * Generate a token for a client
   */
  private async generateClientToken(
    client: ClientApp,
    serverAccess?: TokenServerAccess,
  ): Promise<string> {
    const tokenManager = new TokenManager();
    const access = serverAccess ?? client.serverAccess;
    const token = tokenManager.generateToken({
      clientId: client.id,
      serverAccess: access,
    });
    return token.id;
  }

  /**
   * Write MCP configuration to client's config file
   */
  private async writeMcpConfig(
    client: ClientApp,
    token: string,
  ): Promise<void> {
    if (!client.mcpConfigPath) {
      throw new Error("Client has no MCP config path");
    }

    // Ensure directory exists
    const configDir = path.dirname(client.mcpConfigPath);
    await fsPromises.mkdir(configDir, { recursive: true });

    const standardDef = client.isStandard
      ? getClientById(client.id)
      : undefined;
    const format =
      standardDef?.configFormat ||
      (client.mcpConfigPath.endsWith(".toml") ? "toml" : "json");

    if (format === "toml") {
      await this.updateMcpRouterConfigToml(client.mcpConfigPath, token);
      return;
    }

    if (format !== "json") {
      throw new Error("Unsupported MCP config format");
    }

    let config: any = {};
    try {
      const content = await fsPromises.readFile(client.mcpConfigPath, "utf8");
      config = JSON.parse(content);
    } catch {
      config = {};
    }

    const routerConfig = this.createMcpRouterConfig(token);

    if (config.servers) {
      config.servers["mcp-router"] = routerConfig;
    } else if (config.mcp) {
      config.mcp["mcp-router"] = routerConfig;
    } else {
      config.mcpServers = {
        ...(config.mcpServers || {}),
        "mcp-router": routerConfig,
      };
    }

    await fsPromises.writeFile(
      client.mcpConfigPath,
      JSON.stringify(config, null, 2),
      "utf8",
    );
  }

  private createMcpRouterConfig(tokenId: string): {
    command: string;
    args: string[];
    env: Record<string, string>;
  } {
    return {
      command: "npx",
      args: ["-y", "@mcp_router/cli@latest", "connect"],
      env: {
        MCPR_TOKEN: tokenId,
      },
    };
  }

  private async updateMcpRouterConfigToml(
    filePath: string,
    tokenId: string,
  ): Promise<void> {
    const isWindows = process.platform === "win32";
    const command = isWindows
      ? "C:\\\\Program Files\\\\nodejs\\\\npx.cmd"
      : "npx";
    const localAppData = isWindows
      ? path.join(os.homedir(), "AppData", "Local")
      : null;
    const escapedLocalAppData = localAppData?.replace(/\\/g, "\\\\");

    const blockMain =
      `[mcp_servers.mcp_router]\n` +
      `command = "${command}"\n` +
      `args    = ["-y", "@mcp_router/cli@latest", "connect"]\n` +
      `startup_timeout_sec = 120\n`;
    let blockEnv =
      `\n[mcp_servers.mcp_router.env]\n` + `MCPR_TOKEN = "${tokenId}"\n`;
    if (escapedLocalAppData) {
      blockEnv += `LOCALAPPDATA = "${escapedLocalAppData}"\n`;
    }
    const newBlock = `${blockMain}${blockEnv}`;

    let content = "";
    try {
      content = await fsPromises.readFile(filePath, "utf8");
    } catch {
      // no file yet
    }

    if (content) {
      const blockPattern =
        /\[mcp_servers\.mcp_router\][\s\S]*?(?:\n\[mcp_servers\.mcp_router\.env\][\s\S]*?)?(?=\n\[[^\n]+\]|$)/g;
      let replaced = false;
      content = content.replace(blockPattern, () => {
        if (replaced) {
          return "";
        }
        replaced = true;
        return newBlock;
      });

      if (!replaced) {
        content = content.trimEnd();
        if (content.length > 0 && !content.endsWith("\n")) {
          content += "\n";
        }
        content += `\n${newBlock}`;
      } else {
        content = content.replace(/\n{3,}/g, "\n\n").trimEnd();
        if (!content.endsWith("\n")) {
          content += "\n";
        }
      }
    } else {
      content = newBlock;
    }

    await fsPromises.writeFile(filePath, content, "utf8");
  }

  /**
   * Check if a file exists
   */
  private async fileExists(filePath: string): Promise<boolean> {
    try {
      await fsPromises.access(filePath);
      return true;
    } catch {
      return false;
    }
  }
}

/**
 * Get the ClientAppService instance
 */
export function getClientAppService(): ClientAppService {
  return ClientAppService.getInstance();
}
