# Contributing Guide

> Auto-generated from `package.json` - Last updated: 2026-02-03

## Prerequisites

| Requirement | Version |
|-------------|---------|
| Node.js | >= 20.0.0 |
| pnpm | >= 8.0.0 (using 10.22.0) |

## Quick Start

```bash
# Clone repository
git clone https://github.com/mcp-router/mcp-router
cd mcp-router

# Install dependencies
pnpm install

# Start development
pnpm dev
```

## Available Scripts

### Root Level (Monorepo)

| Script | Command | Description |
|--------|---------|-------------|
| `dev` | `turbo run dev --filter=...` | Start development mode for electron app and dependencies |
| `build` | `turbo run build` | Build all packages |
| `typecheck` | `turbo run typecheck` | Run TypeScript type checking across all packages |
| `lint:fix` | `eslint . --ext .ts,.tsx,.js,.jsx,.mjs,.cjs --fix` | Lint and auto-fix code |
| `knip` | `knip` | Find unused code, dependencies, and exports |
| `test:e2e` | `pnpm --filter @mcp_router/electron run test:e2e` | Run E2E tests (requires packaging first) |
| `make` | `turbo run make` | Create distributable packages |
| `publish` | `turbo run publish --filter=@mcp_router/electron` | Publish electron app |

### Electron App (`apps/electron`)

| Script | Command | Description |
|--------|---------|-------------|
| `start` | `electron-forge start` | Start electron app |
| `dev` | `electron-forge start --enable-logging` | Start with logging enabled |
| `package` | `electron-forge package` | Package for current architecture |
| `package:x64` | `electron-forge package` | Package for x64 architecture |
| `package:arm64` | `electron-forge package` | Package for ARM64 architecture |
| `make` | `electron-forge make` | Create distributable |
| `make:x64` | `electron-forge make --arch=x64` | Create x64 distributable |
| `make:arm64` | `electron-forge make --arch=arm64` | Create ARM64 distributable |
| `lint` | `eslint --ext .ts,.tsx .` | Lint TypeScript files |
| `lint:fix` | `eslint --ext .ts,.tsx . --fix` | Lint and fix TypeScript files |
| `format` | `prettier --write .` | Format code with Prettier |
| `format:check` | `prettier --check .` | Check code formatting |
| `typecheck` | `tsc --noEmit` | Type check without emitting |
| `test` | `vitest run` | Run unit tests |
| `test:e2e` | `playwright test` | Run E2E tests (after packaging) |
| `test:e2e:headed` | `playwright test --headed` | Run E2E tests with browser visible |
| `rebuild` | `electron-rebuild` | Rebuild native modules |
| `rebuild:x64` | `electron-rebuild --arch=x64` | Rebuild for x64 |
| `rebuild:arm64` | `electron-rebuild --arch=arm64` | Rebuild for ARM64 |

## Development Workflow

### 1. Feature Development

```bash
# Start development server
pnpm dev

# Make changes and test in real-time
# The app hot-reloads on changes
```

### 2. Before Committing

```bash
# Type check
pnpm typecheck

# Find unused code
pnpm knip

# Lint and fix
pnpm lint:fix
```

### 3. Testing

```bash
# Unit tests
pnpm --filter @mcp_router/electron test

# E2E tests (requires packaging first)
pnpm test:e2e
```

## Project Structure

```
mcp-router/
├── apps/
│   ├── electron/          # Main Electron + React app
│   │   ├── src/
│   │   │   ├── main/      # Main process (Node.js)
│   │   │   ├── renderer/  # Renderer process (React)
│   │   │   └── preload.ts # IPC bridge
│   │   └── e2e/           # E2E tests
│   └── cli/               # CLI tool
├── packages/
│   ├── shared/            # Shared types & utilities
│   ├── remote-api-types/  # API Zod schemas
│   ├── ui/                # Shared UI components
│   └── tailwind-config/   # Tailwind configuration
├── docs/                  # Documentation
│   ├── adr/               # Architecture Decision Records
│   ├── design/            # Design documents
│   ├── plans/             # Implementation plans
│   └── reviews/           # Review documents
└── .reports/              # Generated reports
```

## Adding New Features

See [NEW_FEATURE_CHECKLIST.md](./NEW_FEATURE_CHECKLIST.md) for the complete checklist.

Key steps:
1. Add types in `packages/shared/src/types/`
2. Create Service/Repository in `apps/electron/src/main/modules/`
3. Add IPC handler and register in `infrastructure/ipc.ts`
4. Expose in `preload.ts`
5. Implement Platform API
6. Register singleton reset in `platform-api-manager.ts`
7. Add translations in `locales/{en,ja,zh}.json`

## Code Quality Tools

| Tool | Purpose | Command |
|------|---------|---------|
| TypeScript | Type safety | `pnpm typecheck` |
| ESLint | Code linting | `pnpm lint:fix` |
| Prettier | Code formatting | `pnpm --filter @mcp_router/electron format` |
| Knip | Dead code detection | `pnpm knip` |
| Vitest | Unit testing | `pnpm --filter @mcp_router/electron test` |
| Playwright | E2E testing | `pnpm test:e2e` |

## Environment Variables

No `.env.example` file exists. The application uses:
- SQLite databases in user data directory
- No external API keys required for core functionality
- Optional: GitHub token for marketplace features (auto-detected from environment)

## Troubleshooting

### Native Module Issues

```bash
# Rebuild native modules
pnpm postinstall

# Or for specific architecture
pnpm --filter @mcp_router/electron rebuild:arm64
```

### TypeScript Errors

```bash
# Clear turbo cache and rebuild
rm -rf node_modules/.cache/turbo
pnpm typecheck
```

### Test Failures

```bash
# Run tests with verbose output
pnpm --filter @mcp_router/electron test -- --reporter=verbose
```
