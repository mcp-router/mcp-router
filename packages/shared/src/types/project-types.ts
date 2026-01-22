export type ToolCatalogSearchStrategy = "bm25" | "cloud";
export type ProjectOptimization = ToolCatalogSearchStrategy | null;

export interface Project {
  id: string;
  name: string;
  createdAt: number;
  updatedAt: number;
  optimization: ProjectOptimization;
}

// Shared constants for project handling
// Use these across main, renderer, and CLI to avoid drift
export const UNASSIGNED_PROJECT_ID = "__unassigned__" as const;
export const PROJECT_HEADER = "x-mcpr-project" as const;
export const DEFAULT_SEARCH_STRATEGY: ToolCatalogSearchStrategy = "bm25";
