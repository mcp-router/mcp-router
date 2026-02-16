# Contributing to MCP Router

Thank you for your interest in contributing to **MCP Router**!
Issues, pull requests, documentation improvements, and feedback are all welcome.

## Code of Conduct

By participating in this project, you agree to follow our
[Code of Conduct](CODE_OF_CONDUCT.md).

## Prerequisites

| Requirement | Version |
|-------------|---------|
| Node.js | >= 20.0.0 |
| pnpm | >= 8.0.0 |

We use `pnpm` workspaces and `turbo`. Please do not use `npm` or `yarn` for this repository.

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
│   └── cli/               # CLI tool (@mcp_router/cli)
├── packages/
│   ├── shared/            # Shared types & utilities
│   ├── remote-api-types/  # API Zod schemas
│   ├── ui/                # Shared UI components
│   └── tailwind-config/   # Tailwind configuration
└── docs/                  # Documentation
    ├── adr/               # Architecture Decision Records
    ├── design/            # Design documents
    └── plans/             # Implementation plans
```

## Available Scripts

### Root Level (Monorepo)

| Script | Description |
|--------|-------------|
| `pnpm dev` | Start development mode for electron app and dependencies |
| `pnpm build` | Build all packages |
| `pnpm typecheck` | Run TypeScript type checking across all packages |
| `pnpm lint:fix` | Lint and auto-fix code |
| `pnpm knip` | Find unused code, dependencies, and exports |
| `pnpm test:e2e` | Run E2E tests (requires packaging first) |

### Electron App (`apps/electron`)

| Script | Description |
|--------|-------------|
| `pnpm --filter @mcp_router/electron dev` | Start with logging enabled |
| `pnpm --filter @mcp_router/electron package` | Package for current architecture |
| `pnpm --filter @mcp_router/electron test` | Run unit tests |
| `pnpm --filter @mcp_router/electron test:e2e` | Run E2E tests (after packaging) |
| `pnpm --filter @mcp_router/electron format` | Format code with Prettier |

## Development Workflow

### 1. Feature Development

```bash
pnpm dev
# Make changes and test in real-time (hot-reloads on changes)
```

### 2. Before Committing

```bash
pnpm typecheck   # Type check
pnpm knip        # Find unused code
pnpm lint:fix    # Lint and fix
```

### 3. Testing

```bash
# Unit tests
pnpm --filter @mcp_router/electron test

# E2E tests (requires packaging first)
pnpm test:e2e
```

## Adding New Features

See [NEW_FEATURE_CHECKLIST.md](docs/NEW_FEATURE_CHECKLIST.md) for the complete checklist.

Key steps:
1. Add types in `packages/shared/src/types/`
2. Create Service/Repository in `apps/electron/src/main/modules/`
3. Add IPC handler and register in `infrastructure/ipc.ts`
4. Expose in `preload.ts`
5. Implement Platform API
6. Register singleton reset in `platform-api-manager.ts`
7. Add translations in `locales/en.json`

## Coding Guidelines

### TypeScript and type definitions

- Prefer **TypeScript** (`.ts` / `.tsx`) for new code
- Follow the guidelines in `docs/TYPE_DEFINITION_GUIDELINES.md`
- Shared types belong in `packages/shared/src/types/`
- Component props interfaces are allowed in `.tsx` files
- Custom ESLint rules (`no-scattered-types`, `no-type-reexport`) enforce these conventions

### Style and linting

- The project uses **ESLint** and **Prettier**
- Try not to disable lint rules globally; if you must use an inline disable, add an explanation in the PR description
- Follow existing patterns in nearby code rather than introducing new styles

### Tests

- Add or update tests when you change behavior
- For Electron-related changes, consider E2E tests under `apps/electron/e2e`
- If you cannot add tests for a change, explain why in the PR description

## Pull Request Workflow

1. **Create a branch** from `main`
2. Keep changes focused on a single topic or feature
3. Before pushing:
   - `pnpm build`
   - `pnpm typecheck`
   - `pnpm lint:fix`
   - `pnpm test:e2e` (when relevant to Electron)
4. Update documentation as needed (files under `docs/` if behavior or architecture changes)
5. Open a pull request:
   - Use a clear, descriptive title
   - Fill in the PR template (`.github/PULL_REQUEST_TEMPLATE.md`)
   - Link related issues (e.g., `Closes #123`)
   - Describe testing performed and any known limitations

Small, incremental PRs are easier to review and merge than large, multi-purpose changes.

## Issue Guidelines

When opening an issue, please:

- Use the provided **Bug report** or **Feature request** templates
- Provide as much detail as possible: OS/version, MCP Router version, steps to reproduce
- Attach logs or screenshots where helpful

## Security Issues

If you believe you have found a security vulnerability, **please do not open a public GitHub issue**. Contact the maintainers privately (see `CODE_OF_CONDUCT.md` for contact info).

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

- SQLite databases stored in user data directory
- No external API keys required for core functionality
- Optional: GitHub token for marketplace features (auto-detected from environment)

## Communication

- GitHub Issues -- for bugs and feature requests
- Discord -- for questions and community discussion:
  https://discord.com/invite/dwG9jPrhxB

## See Also

- [CLAUDE.md](CLAUDE.md) -- AI assistant guidance and architecture overview
- [Electron Directory Structure](docs/adr/ELECTRON_DIRECTORY_STRUCTURE.md) -- detailed directory layout and module reference
