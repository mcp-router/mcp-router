import type { Project } from "../../project-types";

export interface ProjectsAPI {
  list: () => Promise<Project[]>;
  create: (input: { name: string; color?: string }) => Promise<Project>;
  update: (
    id: string,
    updates: { name?: string; color?: string },
  ) => Promise<Project>;
  delete: (id: string) => Promise<void>;
}
