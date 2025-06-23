export interface MCPServerConfig {
    id: string;
    name: string;
    env: Record<string, string>;
    setupInstructions?: string;
    autoStart?: boolean;
    disabled?: boolean;
    description?: string;
    serverType: "local" | "remote" | "remote-streamable";
    command?: string;
    args?: string[];
    remoteUrl?: string;
    bearerToken?: string;
    inputParams?: Record<string, {
        default: string;
        description: string;
    }>;
    required?: string[];
    latestVersion?: string;
    verificationStatus?: "verified" | "unverified";
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
export interface MCPServer extends MCPServerConfig {
    id: string;
    status: "running" | "starting" | "stopping" | "stopped" | "error";
    logs?: string[];
    tools?: MCPTool[];
    resources?: MCPResource[];
    prompts?: MCPPrompt[];
}
export type Agent = AgentConfig;
export interface AgentConfig {
    id: string;
    name: string;
    purpose: string;
    description: string;
    instructions: string;
    mcpServers: MCPServerConfig[];
    toolPermissions?: Record<string, MCPAgentToolPermission[]>;
    autoExecuteTool: boolean;
    mcpServerEnabled?: boolean;
    createdAt?: number;
    updatedAt?: number;
}
export interface MCPAgentToolPermission {
    toolName: string;
    description: string;
    inputSchema?: any;
    enabled: boolean;
}
export interface DeployedAgent {
    id: string;
    name: string;
    description: string;
    mcpServers: MCPServerConfig[];
    purpose: string;
    instructions: string;
    autoExecuteTool: boolean;
    toolPermissions?: Record<string, MCPAgentToolPermission[]>;
    mcpServerEnabled?: boolean;
    userId?: string;
    originalId: string;
    createdAt: number;
    updatedAt: number;
}
export interface APIMCPServer {
    id: string;
    tags: string[];
    displayId: string;
    description: string;
    userId: string;
    iconUrl: string;
    createdAt: number;
    githubUrl: string;
    name: string;
    latestVersion: string;
    updatedAt: number;
    version: string;
}
export interface LocalMCPServer {
    id: string;
    displayId?: string;
    githubUrl: string | null;
    name: string;
    description: string;
    userId: string;
    createdAt: number;
    updatedAt: number;
    command?: string;
    args?: string[];
    envs?: Record<string, string>;
    iconUrl?: string;
    tags?: string[];
    verificationStatus?: "verified" | "unverified";
    inputParams?: Record<string, {
        default: string;
        description: string;
    }>;
    latestVersion?: string;
    version?: string;
    required?: string[];
}
export interface Pagination {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
}
export interface PaginatedResponse<T> {
    data: T[];
    pagination: Pagination;
}
//# sourceMappingURL=mcp-types.d.ts.map