# @mcp_router/cli

Command-line interface for the MCP Router - connect to a running MCP HTTP server via the command line.

## Are you new here?

If you're new to MCP Router:

1. First, download and install the MCP Router application from [our website](https://mcp-router.net)
2. Start the MCP Router application and ensure it's running properly
3. Then, usually this cli is installed as part of the MCP Router installation, but if you want to install it separately, you can do so using npm


## Usage

### Connect Command (Stdio → HTTP)

The `connect` command creates a bridge from stdio to HTTP, allowing stdio-based MCP clients to connect to an HTTP MCP server:

```bash
export MCPR_TOKEN=your_access_token
# Connect to a local MCP Router
npx @mcp_router/cli connect

# Connect to a custom host/port
npx @mcp_router/cli connect --host example.com --port 8080

# Display help
npx @mcp_router/cli --help
```

### Serve Command (HTTP → Stdio)

The `serve` command creates an HTTP server that forwards requests to a stdio-based MCP server:

```bash
# Start an HTTP server on default port 3283 that forwards to a stdio MCP server
npx @mcp_router/cli serve npx @modelcontextprotocol/server-filesystem /path/to/dir

# Use a custom port
npx @mcp_router/cli serve --port 8080 python my-mcp-server.py

# Enable authentication with a Bearer token
npx @mcp_router/cli serve --token secret123 python my-mcp-server.py

# Pass arguments to the MCP server
npx @mcp_router/cli serve -- node my-server.js --config config.json
```

This is useful when you have a stdio-based MCP server that you want to expose via HTTP.

