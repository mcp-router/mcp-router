/**
 * Workspace management domain API
 */

import type {
  Workspace,
  WorkspaceCreateConfig,
  WorkspaceUpdateConfig,
} from "../../workspace";

export interface WorkspaceAPI {
  list(): Promise<Workspace[]>;
  get(id: string): Promise<Workspace | null>;
  create(config: WorkspaceCreateConfig): Promise<Workspace>;
  update(
    id: string,
    updates: Partial<WorkspaceUpdateConfig>,
  ): Promise<Workspace>;
  delete(id: string): Promise<void>;
  switch(id: string): Promise<void>;
  getActive(): Promise<Workspace | null>;
}
