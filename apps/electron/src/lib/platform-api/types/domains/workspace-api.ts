/**
 * Workspace management domain API
 */

export interface Workspace {
  id: string;
  name: string;
  description?: string;
  settings?: WorkspaceSettings;
  createdAt: Date;
  updatedAt: Date;
}

export interface WorkspaceSettings {
  defaultAgentId?: string;
  defaultServerIds?: string[];
  theme?: "light" | "dark" | "system";
  customConfig?: any;
}

export interface CreateWorkspaceInput {
  name: string;
  description?: string;
  settings?: WorkspaceSettings;
}

export interface UpdateWorkspaceInput {
  name?: string;
  description?: string;
  settings?: Partial<WorkspaceSettings>;
}

export interface WorkspaceAPI {
  list(): Promise<Workspace[]>;
  get(id: string): Promise<Workspace | null>;
  create(input: CreateWorkspaceInput): Promise<Workspace>;
  update(id: string, updates: UpdateWorkspaceInput): Promise<Workspace>;
  delete(id: string): Promise<void>;
  setActive(id: string): Promise<void>;
  getActive(): Promise<Workspace | null>;
}
