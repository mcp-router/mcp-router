# Operations Runbook

> Auto-generated from `package.json` - Last updated: 2026-02-03

## Deployment Procedures

### Building for Release

#### macOS (Universal)

```bash
# Build for current architecture
pnpm --filter @mcp_router/electron package

# Build for specific architectures
pnpm --filter @mcp_router/electron package:x64    # Intel Macs
pnpm --filter @mcp_router/electron package:arm64  # Apple Silicon
```

#### Creating Distributables

```bash
# Create DMG/installer for current architecture
pnpm --filter @mcp_router/electron make

# Create for specific architectures
pnpm --filter @mcp_router/electron make:x64
pnpm --filter @mcp_router/electron make:arm64
```

#### Publishing Release

```bash
# Publish to GitHub Releases
pnpm --filter @mcp_router/electron publish
```

**Prerequisites:**
- `GITHUB_TOKEN` environment variable must be set
- Repository must have releases enabled
- Version in `package.json` must be updated

### Pre-Release Checklist

- [ ] Run `pnpm typecheck` - all packages pass
- [ ] Run `pnpm knip` - no critical unused code
- [ ] Run `pnpm lint:fix` - no lint errors
- [ ] Run `pnpm test:e2e` - E2E tests pass
- [ ] Update version in `package.json` files
- [ ] Update CHANGELOG.md
- [ ] Test on both x64 and arm64 if targeting macOS

## Application Paths

### User Data Locations

| Platform | Path |
|----------|------|
| macOS | `~/Library/Application Support/MCP Router/` |
| Windows | `%APPDATA%/MCP Router/` |
| Linux | `~/.config/MCP Router/` |

### Database Files

| File | Purpose |
|------|---------|
| `mcprouter.db` | Main database (workspace metadata) |
| `workspaces/{id}/workspace-{id}.db` | Per-workspace data |

### Log Files

| File | Purpose |
|------|---------|
| `logs/main.log` | Main process logs |
| `logs/renderer.log` | Renderer process logs |

### Configuration Files

| File | Purpose |
|------|---------|
| `settings.json` | Global app settings |
| `skills/` | User skills directory |

## HTTP Server

MCP Router runs an HTTP server for client connections:

| Setting | Default | Description |
|---------|---------|-------------|
| Port | 3282 | HTTP/SSE server port |
| Host | localhost | Bind address |

### Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/mcp` | POST | Streamable HTTP transport (per-request Server+Transport) |
| `/mcp/sse` | GET | SSE connection setup |
| `/mcp/messages` | POST | SSE client messages |
| `/api/health` | GET | Health check (returns `{"status":"healthy"}`) |
| `/api/*` | Various | REST API routes (servers, tools, etc.) |

## Common Issues and Fixes

### 1. Application Won't Start

**Symptoms:** App launches but shows blank window or crashes immediately.

**Solutions:**
```bash
# Clear app data (backup first!)
rm -rf ~/Library/Application\ Support/MCP\ Router/

# Reinstall the app
```

### 2. Native Module Errors

**Symptoms:** Errors about `better-sqlite3` or other native modules.

**Solutions:**
```bash
# Rebuild native modules
pnpm postinstall

# Or full rebuild
rm -rf node_modules
pnpm install
```

### 3. MCP Server Connection Failures

**Symptoms:** Servers show as "failed" or "disconnected".

**Checks:**
1. Verify server command/URL is correct
2. Check if required environment variables are set
3. Review logs for specific error messages
4. Test server command manually in terminal

### 4. Database Corruption

**Symptoms:** App crashes on startup with SQLite errors.

**Solutions:**
```bash
# Backup and remove corrupted database
mv ~/Library/Application\ Support/MCP\ Router/mcprouter.db ~/Desktop/mcprouter.db.bak

# App will create fresh database on next launch
# Note: This will lose all workspace data
```

### 5. Port Already in Use

**Symptoms:** "EADDRINUSE" error for port 3282.

**Solutions:**
```bash
# Find process using port
lsof -i :3282

# Kill the process
kill -9 <PID>
```

### 6. Client App Configuration Issues

**Symptoms:** AI clients can't connect to MCP Router.

**Checks:**
1. Verify token is generated for the client
2. Check client's MCP config file exists and is valid JSON
3. Ensure MCP Router is running
4. Verify server access permissions are set

## Rollback Procedures

### Reverting to Previous Version

1. Download previous release from GitHub Releases
2. Quit current MCP Router
3. Install previous version
4. Launch and verify functionality

### Database Rollback

**Warning:** Database schema changes may not be backward compatible.

```bash
# Backup current database
cp ~/Library/Application\ Support/MCP\ Router/mcprouter.db ~/Desktop/mcprouter.db.backup

# If rollback needed, restore backup
cp ~/Desktop/mcprouter.db.backup ~/Library/Application\ Support/MCP\ Router/mcprouter.db
```

## Monitoring

### Health Checks

The application provides internal health monitoring:

1. **Server Status:** Check "Servers" page for connection states
2. **Activity Logs:** Review "Logs" page for request/response history
3. **Console Logs:** Access via Developer Tools (Cmd+Option+I on macOS)

### Key Metrics to Monitor

| Metric | Location | Healthy State |
|--------|----------|---------------|
| Server connections | Servers page | All green/connected |
| HTTP server | Tray icon | Running |
| Memory usage | Activity Monitor | < 500MB typical |
| CPU usage | Activity Monitor | < 5% idle |

## Security Considerations

### Token Management

- Tokens are stored in the workspace database
- Each client app has a unique token
- Tokens can be regenerated from Client Apps page
- Server access is controlled per-token

### Path Security

- Skills can only be created in designated directories
- Symlinks are restricted to user home directory
- Path traversal attacks are prevented

See [SECURITY.md](./SECURITY.md) for full security documentation.

## Support

### Getting Help

1. Check this runbook for common issues
2. Review [GitHub Issues](https://github.com/mcp-router/mcp-router/issues)
3. Submit new issue with:
   - App version
   - Operating system and version
   - Steps to reproduce
   - Error messages / logs

### Log Collection

For bug reports, collect:

```bash
# Copy logs to desktop
cp -r ~/Library/Application\ Support/MCP\ Router/logs ~/Desktop/mcp-router-logs

# Include database info (not the data itself)
sqlite3 ~/Library/Application\ Support/MCP\ Router/mcprouter.db ".schema" > ~/Desktop/mcp-router-logs/schema.sql
```
