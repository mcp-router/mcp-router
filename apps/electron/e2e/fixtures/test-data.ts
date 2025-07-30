export const testData = {
  workspace: {
    default: 'Default',
    test: 'E2E Test Workspace',
    production: 'Production Workspace',
  },
  
  server: {
    example: {
      name: 'Example MCP Server',
      command: 'node',
      args: ['./test-server.js'],
      description: 'Test MCP server for E2E testing',
    },
    python: {
      name: 'Python MCP Server',
      command: 'python',
      args: ['-m', 'mcp_server'],
      description: 'Python-based MCP server',
    },
  },
  
  agent: {
    basic: {
      name: 'Test Agent',
      description: 'Basic test agent for E2E testing',
      prompt: 'You are a helpful assistant for testing purposes.',
    },
    advanced: {
      name: 'Advanced Test Agent',
      description: 'Advanced agent with multiple MCP servers',
      prompt: 'You are an advanced assistant with access to multiple tools.',
    },
  },
  
  auth: {
    testUser: {
      email: 'test@example.com',
      password: 'test123456',
    },
  },
  
  settings: {
    theme: {
      light: 'light',
      dark: 'dark',
      system: 'system',
    },
    language: {
      english: 'en',
      japanese: 'ja',
    },
  },
};