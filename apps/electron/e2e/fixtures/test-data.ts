export const testData = {
  workspace: {
    default: "Default",
    test: "E2E Test Workspace",
    production: "Production Workspace",
  },

  server: {
    example: {
      name: "Example MCP Server",
      command: "node",
      args: ["./test-server.js"],
      description: "Test MCP server for E2E testing",
    },
    python: {
      name: "Python MCP Server",
      command: "python",
      args: ["-m", "mcp_server"],
      description: "Python-based MCP server",
    },
  },
  auth: {
    testUser: {
      email: "test@example.com",
      password: "test123456",
    },
  },

  settings: {
    theme: {
      light: "light",
      dark: "dark",
      system: "system",
    },
    language: {
      english: "en",
      japanese: "ja",
    },
  },
};
