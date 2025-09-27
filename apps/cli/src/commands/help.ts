/**
 * Displays help information for the mcpr CLI
 */
export function executeHelp(): void {
  console.log(`
  @mcp_router/cli - Model Context Protocol Router Command Line Interface

  Usage:
    npx @mcp_router/cli <command> [options]

  Commands:
    connect   Connect to an MCP HTTP server
    serve     Start an HTTP server that aggregates stdio MCP servers
    version   Show the CLI version
    help      Show this help message

  Connect Options:
    --host <host>   Specify the host (default: localhost)
    --port <port>   Specify the port (default: 3282)

  Serve Options:
    --port <port>     HTTP server port (default: 3283)
    --verbose, -v     Enable verbose logging

    Single server mode:
      <command> [args...]   The stdio MCP server command to run

    Multiple servers mode:
      --server <id> <name> <command> [args...]   Add a server to aggregate
                                                 (can be specified multiple times)

  Examples:
    # Connect to an MCP HTTP server
    npx @mcp_router/cli connect --host localhost --port 3282

    # Serve a single stdio MCP server via HTTP
    npx @mcp_router/cli serve --port 3283 npx -y @modelcontextprotocol/server-filesystem /tmp

    # Serve with legacy separator syntax
    npx @mcp_router/cli serve --port 3283 -- python my-mcp-server.py --arg1 value1

    # Aggregate multiple MCP servers
    npx @mcp_router/cli serve --port 3283 \\
      --server fs "Filesystem" npx -y @modelcontextprotocol/server-filesystem /tmp \\
      --server git "Git" npx -y @modelcontextprotocol/server-git --repository /path/to/repo

  Notes:
    - In multiple server mode, each server gets a unique ID and human-readable name
    - Tools from all servers are combined and available through the HTTP endpoint
    - Resources are namespaced by server name (e.g., resource://servername/path)
    - The aggregator automatically handles routing requests to the appropriate server
  `);
}
