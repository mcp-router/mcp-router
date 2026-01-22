import type { Project, ProjectOptimization } from "../../project-types";

export interface ProjectsAPI {
  list: () => Promise<Project[]>;
  create: (input: { name: string }) => Promise<Project>;
  update: (
    id: string,
    updates: { name?: string; optimization?: ProjectOptimization },
  ) => Promise<Project>;
  delete: (id: string) => Promise<void>;
}
