export interface MCPServerConfig {
  id: string;
  name: string;
  env: Record<string, string>;
  setupInstructions?: string;
  autoStart?: boolean;
  disabled?: boolean;
  description?: string;
  serverType: 'local' | 'remote' | 'remote-streamable';
  command?: string;
  args?: string[];
  remoteUrl?: string;
  bearerToken?: string;
  inputParams?: Record<string, { default: string; description: string }>;
  required?: string[];
  latestVersion?: string;
  verificationStatus?: 'verified' | 'unverified';
  version?: string;
  toolPermissions?: MCPServerToolPermissions;
}

export interface MCPTool {
  name: string;
  description?: string;
  enabled?: boolean;
  inputSchema?: any;
}

export interface MCPServerToolPermissions {
  [toolName: string]: boolean;
}

export interface MCPResource {
  uri: string;
  name: string;
  description?: string;
}

export interface MCPPrompt {
  name: string;
  description?: string;
  inputSchema?: any;
}