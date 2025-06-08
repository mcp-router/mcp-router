import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useOutletContext } from 'react-router-dom';
import { Input } from '../../ui/input';
import { Textarea } from '../../ui/textarea';
import { 
    Server,
    Save
} from 'lucide-react';
import { Label } from '../../ui/label';
import { ScrollArea } from '../../ui/scroll-area';
import { Switch } from '../../ui/switch';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '../../ui/tabs';
import { Button } from '../../ui/button';
import { DeployedAgent, MCPServerConfig, AgentConfig } from "../../../types";
import { useTranslation } from 'react-i18next';
import { isAgentConfigured } from '../../../lib/utils/agent-utils';
import { McpSettings } from '../build/McpSettings';
import { useAgentStore } from '../../../lib/stores';

interface ServerConfigVariable {
  name: string;
  value: string;
  description?: string;
  required?: boolean;
  type?: 'env' | 'arg'; // 変数の種類を識別
}

// AgentConfigの型から'id'を除いた型を定義  
type AgentConfigWithoutId = Omit<AgentConfig, 'id'>;

/**
 * Agent Settings Component
 * Manages agent settings (basic server configuration and advanced agent properties)
 */
const AgentSettings: React.FC = () => {
    const { t } = useTranslation();
    const { agent } = useOutletContext<{ agent: DeployedAgent }>();
    const [isAutoSavePending, setIsAutoSavePending] = useState(false);
    const autoSaveTimerRef = useRef<NodeJS.Timeout | null>(null);
    const lastSavedStateRef = useRef<string>('');
    
    // Zustand store
    const { updateDeployedAgent } = useAgentStore();
    
    // 現在のエージェントの状態（編集中の値）
    const [currentAgent, setCurrentAgent] = useState<AgentConfig>({
        id: agent.id,
        name: agent.name || '',
        purpose: agent.purpose || '',
        description: agent.description || '',
        instructions: agent.instructions || '',
        mcpServers: agent.mcpServers || [],
        toolPermissions: agent.toolPermissions || {},
        autoExecuteTool: agent.autoExecuteTool ?? true,
        createdAt: agent.createdAt || Date.now(),
        updatedAt: agent.updatedAt || Date.now(),
    });

    // AgentSettingsFormに渡すためのsetAgent関数を作成
    const setAgentWithoutId = useCallback((value: React.SetStateAction<AgentConfigWithoutId>) => {
        setCurrentAgent(current => {
            const id = current.id;
            
            if (typeof value === 'function') {
                // current から id を除いたオブジェクトを作成
                const { id: _id, ...rest } = current;
                // 関数を適用して新しい状態を取得
                const newStateWithoutId = value(rest);
                // id を復元して返す
                const newState = { ...newStateWithoutId, id };
                
                // Check if MCP servers changed and update related state
                if (JSON.stringify(newState.mcpServers) !== JSON.stringify(current.mcpServers)) {
                    // Re-extract server data when servers change
                    const { variables, instructions } = extractServerData(newState.mcpServers);
                    
                    setAgentState(prev => ({
                        ...prev,
                        serverVariables: variables,
                        serverInstructions: instructions
                    }));
                }
                
                return newState;
            } else {
                // オブジェクトの場合は直接マージして id を保持
                const newState = { ...value, id };
                
                // Check if MCP servers changed and update related state
                if (JSON.stringify(newState.mcpServers) !== JSON.stringify(current.mcpServers)) {
                    // Re-extract server data when servers change
                    const { variables, instructions } = extractServerData(newState.mcpServers);
                    
                    setAgentState(prev => ({
                        ...prev,
                        serverVariables: variables,
                        serverInstructions: instructions
                    }));
                }
                
                return newState;
            }
        });
    }, []); // extractServerData関数をdependencyから削除し、関数内で定義し直す

    // Helper function to extract server data (moved inside component to avoid dependency issues)
    const extractServerData = useCallback((servers: MCPServerConfig[]) => {
        const variables: Record<string, ServerConfigVariable[]> = {};
        const instructions: Record<string, string> = {};

        servers.forEach(server => {
            // Extract env variables (these are from environment configuration)
            const envVars = Object.entries(server.env || {}).map(([name, value]) => ({
                name,
                value: value || '',
                required: server.required?.includes(name),
                type: 'env' as const
            }));

            // Extract arg variables (these are placeholders in args array)
            const argVars = server.args?.reduce((acc, arg) => {
                const match = arg.match(/^\{([^}]+)\}$/);
                if (match && !envVars.some(v => v.name === match[1])) {
                    acc.push({
                        name: match[1],
                        value: '',
                        required: server.required?.includes(match[1]),
                        type: 'arg' as const
                    });
                }
                return acc;
            }, [] as Array<ServerConfigVariable & { type: 'arg' }>) || [];

            variables[server.id] = [...envVars, ...argVars];
            instructions[server.id] = server.setupInstructions || '';
        });

        return { variables, instructions };
    }, []);

    // All agent state in a single object for server variables tracking
    const [agentState, setAgentState] = useState({
        configurationComplete: false,
        serverVariables: {} as Record<string, ServerConfigVariable[]>,
        serverInstructions: {} as Record<string, string>,
    });

    // Initialize state from agent data
    useEffect(() => {
        if (!agent?.mcpServers) return;

        const { variables, instructions } = extractServerData(agent.mcpServers);
        
        // Update current agent state to match the latest agent data
        setCurrentAgent({
            id: agent.id,
            name: agent.name || '',
            purpose: agent.purpose || '',
            description: agent.description || '',
            instructions: agent.instructions || '',
            mcpServers: agent.mcpServers || [],
            toolPermissions: agent.toolPermissions || {},
            autoExecuteTool: agent.autoExecuteTool ?? true,
            createdAt: agent.createdAt || Date.now(),
            updatedAt: agent.updatedAt || Date.now(),
        });
        
        setAgentState({
            configurationComplete: isAgentConfigured(agent),
            serverVariables: variables,
            serverInstructions: instructions,
        });
    }, [agent, extractServerData]);

    // Update state helper
    const updateAgentState = (updates: Partial<typeof agentState>) => {
        setAgentState(prev => ({ ...prev, ...updates }));
    };

    // Handle variable value change
    const handleVariableChange = (serverId: string, varName: string, value: string) => {
        updateAgentState({
            serverVariables: {
                ...agentState.serverVariables,
                [serverId]: agentState.serverVariables[serverId]?.map(v => 
                    v.name === varName ? { ...v, value } : v
                ) || []
            }
        });
    };

    // Manual save function
    const manualSave = useCallback(async () => {
        if (!agent) return;

        try {
            // Update MCP servers with new values
            const updatedServers = currentAgent.mcpServers.map((server: MCPServerConfig) => {
                const serverVars = agentState.serverVariables[server.id] || [];
                
                const updatedEnv: Record<string, string> = {};
                
                serverVars
                    .filter(variable => variable.type === 'env' || !variable.type)
                    .forEach(variable => {
                        if (variable.value !== undefined && variable.value !== null) {
                            updatedEnv[variable.name] = variable.value;
                        }
                    });
                
                return {
                    ...server,
                    env: updatedEnv,
                    setupInstructions: agentState.serverInstructions[server.id] || server.setupInstructions
                };
            });

            const updatedAgent = {
                ...currentAgent,
                mcpServers: updatedServers,
            };

            await window.electronAPI.updateDeployedAgent(agent.id, updatedAgent);
            
            // Update the Zustand store to reflect changes
            updateDeployedAgent(agent.id, updatedAgent);
            
            // Update lastSavedState to current state after successful save
            lastSavedStateRef.current = JSON.stringify({
                agent: updatedAgent,
                serverVariables: agentState.serverVariables,
                serverInstructions: agentState.serverInstructions
            });
            
            // Update current agent state with the saved values
            setCurrentAgent(updatedAgent);
            updateAgentState({ configurationComplete: isAgentConfigured(updatedAgent) });
            
            // Clear auto-save pending state and timer
            if (autoSaveTimerRef.current) {
                clearTimeout(autoSaveTimerRef.current);
                autoSaveTimerRef.current = null;
            }
            setIsAutoSavePending(false);
        } catch (error) {
            console.error('Manual save failed:', error);
        }
    }, [agent, currentAgent, agentState, updateDeployedAgent]);

    // Auto-save function - saves silently without toast notifications
    const autoSave = useCallback(async () => {
        if (!agent) return;

        try {
            // Update MCP servers with new values
            const updatedServers = currentAgent.mcpServers.map((server: MCPServerConfig) => {
                const serverVars = agentState.serverVariables[server.id] || [];
                
                const updatedEnv: Record<string, string> = {};
                
                serverVars
                    .filter(variable => variable.type === 'env' || !variable.type)
                    .forEach(variable => {
                        if (variable.value !== undefined && variable.value !== null) {
                            updatedEnv[variable.name] = variable.value;
                        }
                    });
                
                return {
                    ...server,
                    env: updatedEnv,
                    setupInstructions: agentState.serverInstructions[server.id] || server.setupInstructions
                };
            });

            const updatedAgent = {
                ...currentAgent,
                mcpServers: updatedServers,
            };

            await window.electronAPI.updateDeployedAgent(agent.id, updatedAgent);
            
            // Update the Zustand store to reflect changes
            updateDeployedAgent(agent.id, updatedAgent);
            
            // Update lastSavedState to current state after successful save
            lastSavedStateRef.current = JSON.stringify({
                agent: updatedAgent,
                serverVariables: agentState.serverVariables,
                serverInstructions: agentState.serverInstructions
            });
            
            // Update current agent state with the saved values
            setCurrentAgent(updatedAgent);
            updateAgentState({ configurationComplete: isAgentConfigured(updatedAgent) });
        } catch (error) {
            console.error('Auto-save failed:', error);
        }
    }, [agent, currentAgent, agentState, updateDeployedAgent]);

    // Auto-save effect - triggers save 5 seconds after last change
    useEffect(() => {
        const currentState = JSON.stringify({
            agent: currentAgent,
            serverVariables: agentState.serverVariables,
            serverInstructions: agentState.serverInstructions
        });
        

        // Check if state has actually changed
        if (currentState !== lastSavedStateRef.current) {
            // Clear existing timer
            if (autoSaveTimerRef.current) {
                clearTimeout(autoSaveTimerRef.current);
            }

            // Show auto-save pending indicator
            setIsAutoSavePending(true);

            // Set new timer for auto-save (5 seconds after last change)
            autoSaveTimerRef.current = setTimeout(async () => {
                await autoSave();
                setIsAutoSavePending(false);
                autoSaveTimerRef.current = null;
            }, 5000);
        }

        // Cleanup timer on unmount
        return () => {
            if (autoSaveTimerRef.current) {
                clearTimeout(autoSaveTimerRef.current);
                setIsAutoSavePending(false);
            }
        };
    }, [currentAgent, agentState, autoSave]);

    // Initialize lastSavedState on mount
    useEffect(() => {
        if (agent) {
            lastSavedStateRef.current = JSON.stringify({
                agent: currentAgent,
                serverVariables: agentState.serverVariables,
                serverInstructions: agentState.serverInstructions
            });
            setIsAutoSavePending(false);
        }
    }, [agent]); // Only run when agent changes (initial load)

    return (
        <div className="flex flex-col h-full">
            <div className="pb-4 mb-4 border-b">
                <div className="flex justify-between items-center">
                    <div className="flex items-center gap-3">
                        <h2 className="text-lg font-medium">{t('agents.settings')}</h2>
                        {/* Auto-save indicator */}
                        {isAutoSavePending && (
                            <div className="flex items-center space-x-1">
                                <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse"></div>
                                <span className="text-xs text-muted-foreground">
                                    {t('agents.autoSaving', 'Auto-saving...')}
                                </span>
                            </div>
                        )}
                    </div>
                    <div className="flex gap-2 items-center">
                        <div className="flex items-center space-x-1 mr-3">
                            <span className={`text-sm ${agentState.configurationComplete ? 'text-green-600' : 'text-amber-600'}`}>
                                {agentState.configurationComplete ? t('agents.status.configured') : t('agents.status.unconfigured')}
                            </span>
                        </div>
                        
                        {/* Manual save button */}
                        <Button
                            size="sm"
                            onClick={manualSave}
                            disabled={!isAutoSavePending}
                            className="h-8 w-8 p-0"
                        >
                            <Save className="h-4 w-4" />
                        </Button>
                    </div>
                </div>
            </div>

            <Tabs defaultValue="basic" className="flex-1 h-[calc(100%-4rem)]">
                <TabsList className="grid w-full grid-cols-2">
                    <TabsTrigger value="basic">{t('agents.tabs.basic')}</TabsTrigger>
                    <TabsTrigger value="advanced">{t('agents.tabs.advanced')}</TabsTrigger>
                </TabsList>
                
                <TabsContent value="basic" className="mt-4 h-[calc(100%-3rem)]">
                    <ScrollArea className="h-full overflow-auto">
                        {agent?.mcpServers && agent.mcpServers.length > 0 ? (
                            <div className="space-y-8">
                                {/* <div className="flex items-center space-x-2">
                                    <Switch
                                        id="auto-execute-tool"
                                        checked={currentAgent.autoExecuteTool}
                                        onCheckedChange={(checked) => setCurrentAgent(prev => ({ ...prev, autoExecuteTool: checked }))}
                                    />
                                    <Label htmlFor="auto-execute-tool">{t('agents.autoExecuteTool')}</Label>
                                </div> */}
                                {agent.mcpServers.length > 0 && agent.mcpServers.filter(server => (agentState.serverVariables[server.id]?.length || 0) > 0).length !== 0 && (
                                    agent.mcpServers
                                        .filter(server => (agentState.serverVariables[server.id]?.length || 0) > 0)
                                        .map(server => (
                                        <div key={server.id} className="pb-6 border-b last:border-b-0">
                                            <div className="flex items-center mb-4">
                                                <Server className="mr-2 h-5 w-5 text-muted-foreground" />
                                                <h3 className="text-base font-medium">{server.name}</h3>
                                            </div>

                                            {agentState.serverInstructions[server.id] && (
                                                <div className="p-3 bg-muted/50 rounded-md mb-5 whitespace-pre-line text-sm text-muted-foreground">
                                                    {agentState.serverInstructions[server.id]}
                                                </div>
                                            )}
                                            
                                            <div className="space-y-5">
                                                {agentState.serverVariables[server.id]?.map((variable, index) => (
                                                    <div key={`${server.id}-${variable.name}`} className="flex flex-col gap-2">
                                                        <Label htmlFor={`var-${server.id}-${variable.name}`}>
                                                            {variable.name}
                                                            {variable.required && (
                                                                <span className="text-destructive ml-1">*</span>
                                                            )}
                                                        </Label>
                                                        <Input
                                                            id={`var-${server.id}-${variable.name}`}
                                                            value={variable.value}
                                                            onChange={(e) => handleVariableChange(server.id, variable.name, e.target.value)}
                                                        />
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    ))
                                )}
                            </div>
                        ) : (
                            <div className="text-center py-10 text-muted-foreground">
                                <p>{t('agents.noServersConfigured')}</p>
                            </div>
                        )}
                    </ScrollArea>
                </TabsContent>
                
                <TabsContent value="advanced" className="mt-4 h-[calc(100%-3rem)]">
                    <ScrollArea className="h-full overflow-auto">
                        <div className="space-y-6">
                            <div className="space-y-2">
                                <Label htmlFor="agent-name">{t('agents.fields.name')}</Label>
                                <Input
                                    id="agent-name"
                                    value={currentAgent.name}
                                    onChange={(e) => setCurrentAgent(prev => ({ ...prev, name: e.target.value }))}
                                    placeholder={t('agents.placeholders.name')}
                                />
                            </div>
                            
                            <div className="space-y-2">
                                <Label htmlFor="agent-purpose">{t('agents.fields.purpose')}</Label>
                                <Textarea
                                    id="agent-purpose"
                                    value={currentAgent.purpose}
                                    onChange={(e) => setCurrentAgent(prev => ({ ...prev, purpose: e.target.value }))}
                                    placeholder={t('agents.placeholders.purpose')}
                                    rows={3}
                                />
                            </div>
                            
                            <div className="space-y-2">
                                <Label htmlFor="agent-description">{t('agents.fields.description')}</Label>
                                <Textarea
                                    id="agent-description"
                                    value={currentAgent.description}
                                    onChange={(e) => setCurrentAgent(prev => ({ ...prev, description: e.target.value }))}
                                    placeholder={t('agents.placeholders.description')}
                                    rows={4}
                                />
                            </div>
                            
                            <div className="space-y-2">
                                <Label htmlFor="agent-instructions">{t('agents.fields.instructions')}</Label>
                                <Textarea
                                    id="agent-instructions"
                                    value={currentAgent.instructions}
                                    onChange={(e) => setCurrentAgent(prev => ({ ...prev, instructions: e.target.value }))}
                                    placeholder={t('agents.placeholders.instructions')}
                                    rows={8}
                                />
                            </div>

                            {/* MCP Servers Section */}
                            <div className="border-t pt-6 mt-8">
                                <McpSettings
                                    agent={currentAgent}
                                    setAgent={setAgentWithoutId}
                                />
                            </div>
                        </div>
                    </ScrollArea>
                </TabsContent>
            </Tabs>
        </div>
    );
};

export default AgentSettings;
