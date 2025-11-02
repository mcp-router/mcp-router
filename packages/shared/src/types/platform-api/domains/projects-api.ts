import type { Project } from "../../project-types";

export interface ProjectsAPI {
  list: () => Promise<Project[]>;
  create: (input: { name: string }) => Promise<Project>;
  update: (id: string, updates: { name?: string }) => Promise<Project>;
  delete: (id: string) => Promise<void>;
}
