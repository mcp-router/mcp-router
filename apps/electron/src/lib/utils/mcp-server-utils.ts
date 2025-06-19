import { v4 as uuidv4 } from 'uuid';

/**
 * Validates a JSON input for MCP server configuration format
 * Works with both mcpServers object wrapper and direct server configurations
 * 
 * @param jsonInput The JSON input string or object to validate
 * @returns Validation result with parsed data if valid
 */
export function validateMcpServerJson(jsonInput: string | object): { 
  valid: boolean; 
  error?: string; 
  jsonData?: any;
  serverConfigs?: Record<string, any>;
} {
  try {
    // Parse JSON if input is a string
    const parsed = typeof jsonInput === 'string' ? JSON.parse(jsonInput) : jsonInput;
    
    // Determine if the JSON has mcpServers wrapper or is a direct server config
    const mcpServers = parsed.mcpServers || parsed;
    
    if (typeof mcpServers !== 'object' || mcpServers === null) {
      return { valid: false, error: 'Invalid JSON format: Expected an object' };
    }
    
    const serverNames = Object.keys(mcpServers);
    
    if (serverNames.length === 0) {
      return { valid: false, error: 'No server configurations found' };
    }
    
    // Check if at least one server has the required fields
    for (const serverName of serverNames) {
      const server = mcpServers[serverName];
      if (!server || typeof server !== 'object') {
        return { 
          valid: false, 
          error: `Invalid server configuration for '${serverName}': Expected an object` 
        };
      }
      
      if (!server.command || typeof server.command !== 'string') {
        return { 
          valid: false, 
          error: `Missing or invalid command for server '${serverName}'` 
        };
      }
      
      if (!Array.isArray(server.args)) {
        return { 
          valid: false, 
          error: `Arguments must be an array for server '${serverName}'` 
        };
      }
    }
    
    return { 
      valid: true, 
      jsonData: parsed,
      serverConfigs: mcpServers
    };
  } catch (error: any) {
    return { 
      valid: false, 
      error: `Invalid JSON: ${error.message}` 
    };
  }
}

/**
 * Processes MCP server configurations from validated JSON
 * Handles duplicate names by creating unique names
 * 
 * @param serverConfigs The validated server configurations object
 * @param existingServerNames Set of existing server names to avoid duplicates
 * @returns Array of processed server configurations
 */
export function processMcpServerConfigs(
  serverConfigs: Record<string, any>,
  existingServerNames: Set<string>
): Array<{
  name: string;
  originalName?: string;
  success: boolean;
  server?: any;
  message?: string;
}> {
  const results: Array<{
    name: string;
    originalName?: string;
    success: boolean;
    server?: any;
    message?: string;
  }> = [];
  
  // Clone the set to avoid modifying the original
  const currentNames = new Set(existingServerNames);
  
  // Process each server in the configuration
  for (const [serverName, serverConfig] of Object.entries(serverConfigs)) {
    try {
      // Ensure server config is an object
      if (!serverConfig || typeof serverConfig !== 'object') {
        results.push({
          name: serverName,
          success: false,
          message: 'Invalid server configuration'
        });
        continue;
      }
      
      // Generate a unique name if the server name already exists
      let uniqueName = serverName;
      let counter = 2;
      while (currentNames.has(uniqueName)) {
        uniqueName = `${serverName}-${counter}`;
        counter++;
      }
      
      // Add the unique name to our set to prevent duplicates within this batch
      currentNames.add(uniqueName);
      
      // Extract command, args, and env from the configuration
      const { command, args, env } = serverConfig;
      
      // Create MCPServerConfig object
      const mcpServerConfig = {
        id: uuidv4(),
        name: uniqueName,
        command: command || '',
        args: args || [],
        env: env || {},
        autoStart: false,
        disabled: false,
        serverType: 'local' as const
      };
      
      results.push({
        name: uniqueName,
        originalName: serverName !== uniqueName ? serverName : undefined,
        success: true,
        server: mcpServerConfig
      });
    } catch (error: any) {
      results.push({
        name: serverName,
        success: false,
        message: `Error processing server: ${error.message}`
      });
    }
  }
  
  return results;
}
