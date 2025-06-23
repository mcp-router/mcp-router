export interface AgentChatMessage {
    role: "user" | "assistant" | "system";
    content: string;
}
export interface AgentUseRequest {
    message: string;
    agentId: string;
    history: AgentChatMessage[];
    sessionId?: string;
}
export interface AgentSetupRequest {
    message: string;
    agentId: string;
    history: AgentChatMessage[];
    servers: any[];
}
//# sourceMappingURL=agent-api.d.ts.map