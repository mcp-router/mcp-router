import { SingletonService } from "@/main/modules/singleton-service";
import { ProjectRepository } from "./projects.repository";
import type { Project } from "@mcp_router/shared";

export class ProjectService extends SingletonService<
  Project,
  string,
  ProjectService
> {
  protected constructor() {
    super();
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
      const project = {
        name: input.name.trim(),
        createdAt: Date.now(),
        updatedAt: Date.now(),
      } as Omit<Project, "id">;
      return repo.add(project);
    } catch (error) {
      return this.handleError("create", error);
    }
  }

  update(id: string, updates: Partial<Pick<Project, "name">>): Project {
    try {
      const repo = ProjectRepository.getInstance();
      const existing = repo.getById(id);
      if (!existing) throw new Error("Project not found");
      const merged: Project = {
        ...existing,
        ...updates,
        name: (updates.name ?? existing.name).trim(),
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
      const repo = ProjectRepository.getInstance();
      // Unassign servers from this project (set NULL)
      const db = (
        repo as {
          database: import("@/main/infrastructure/database/sqlite-manager").SqliteManager;
        }
      ).database;
      db.execute(
        "UPDATE servers SET project_id = NULL WHERE project_id = :id",
        { id },
      );
      // Delete project
      const ok = repo.delete(id);
      if (!ok) throw new Error("Failed to delete project");
    } catch (error) {
      this.handleError("delete", error);
    }
  }
}

export function getProjectService(): ProjectService {
  return ProjectService.getInstance();
}
