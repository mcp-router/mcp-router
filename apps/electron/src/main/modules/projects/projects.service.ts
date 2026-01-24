import { SingletonService } from "@/main/modules/singleton-service";
import { ProjectRepository } from "./projects.repository";
import {
  DEFAULT_SEARCH_STRATEGY,
  type Project,
  type ProjectOptimization,
} from "@mcp_router/shared";
import type { MCPServerManager } from "@/main/modules/mcp-server-manager/mcp-server-manager";
import { McpServerManagerRepository } from "../mcp-server-manager/mcp-server-manager.repository";

export class ProjectService extends SingletonService<
  Project,
  string,
  ProjectService
> {
  private static serverManagerProvider: (() => MCPServerManager) | null = null;

  protected constructor() {
    super();
  }

  // Centralized validation: trim, non-empty, no whitespace
  private validateAndNormalizeName(input: string): string {
    const name = (input ?? "").trim();
    if (!name) throw new Error("Project name cannot be empty");
    if (/\s/.test(name))
      throw new Error("Project name cannot contain whitespace");
    return name;
  }

  protected getEntityName(): string {
    return "Project";
  }

  public static getInstance(): ProjectService {
    return (this as any).getInstanceBase();
  }

  public static resetInstance(): void {
    this.resetInstanceBase(ProjectService);
  }

  public static setServerManagerProvider(
    provider: () => MCPServerManager,
  ): void {
    ProjectService.serverManagerProvider = provider;
  }

  private getServerManager(): MCPServerManager | null {
    try {
      return ProjectService.serverManagerProvider
        ? ProjectService.serverManagerProvider()
        : null;
    } catch (error) {
      console.error("Failed to resolve MCPServerManager:", error);
      return null;
    }
  }

  getOptimization(projectId: string): ProjectOptimization | undefined {
    try {
      const repo = ProjectRepository.getInstance();
      const project = repo.getById(projectId);
      return project?.optimization;
    } catch (error) {
      console.error(
        "[ProjectService] Failed to get project optimization:",
        error,
      );
      return undefined;
    }
  }

  list(): Project[] {
    try {
      return ProjectRepository.getInstance().getAll({ orderBy: "name" });
    } catch (error) {
      return this.handleError("list", error, []);
    }
  }

  create(input: { name: string }): Project {
    try {
      const repo = ProjectRepository.getInstance();
      const name = this.validateAndNormalizeName(input.name);

      const duplicate = repo.findByName(name);
      if (duplicate) {
        throw new Error(`Project "${name}" already exists`);
      }

      const project = {
        name,
        createdAt: Date.now(),
        updatedAt: Date.now(),
        optimization: DEFAULT_SEARCH_STRATEGY,
      } as Omit<Project, "id">;
      return repo.add(project);
    } catch (error) {
      return this.handleError("create", error);
    }
  }

  update(
    id: string,
    updates: Partial<Pick<Project, "name" | "optimization">>,
  ): Project {
    try {
      const repo = ProjectRepository.getInstance();
      const existing = repo.getById(id);
      if (!existing) throw new Error("Project not found");

      let nextName = existing.name;
      if (updates.name !== undefined) {
        const name = this.validateAndNormalizeName(updates.name);
        const duplicate = repo.findByName(name);
        if (duplicate && duplicate.id !== id) {
          throw new Error(`Project "${name}" already exists`);
        }
        nextName = name;
      }

      const merged: Project = {
        ...existing,
        ...updates,
        name: nextName,
        updatedAt: Date.now(),
      };
      const result = repo.update(id, merged);
      if (!result) throw new Error("Failed to update project");
      return result;
    } catch (error) {
      return this.handleError("update", error);
    }
  }

  delete(id: string): void {
    try {
      const projectRepo = ProjectRepository.getInstance();
      const serverRepo = McpServerManagerRepository.getInstance();
      const serverManager = this.getServerManager();
      const serversForProject = serverRepo
        .getAll()
        .filter((server) => server.projectId === id);

      if (serverManager) {
        for (const server of serversForProject) {
          const removed = serverManager.removeServer(server.id);
          if (!removed) {
            throw new Error(`Failed to remove server "${server.name}"`);
          }
        }
      } else {
        // Fall back to repository-level deletion if server manager is unavailable
        for (const server of serversForProject) {
          const removed = serverRepo.deleteServer(server.id);
          if (!removed) {
            throw new Error(`Failed to delete server ${server.id}`);
          }
        }
      }

      const remainingServers = serverRepo
        .getAll()
        .filter((server) => server.projectId === id);

      if (remainingServers.length > 0) {
        throw new Error(
          `Cannot delete project while ${remainingServers.length} servers still reference it.`,
        );
      }

      const ok = projectRepo.delete(id);
      if (!ok) throw new Error("Failed to delete project");
    } catch (error) {
      this.handleError("delete", error);
    }
  }
}

export function getProjectService(): ProjectService {
  return ProjectService.getInstance();
}
