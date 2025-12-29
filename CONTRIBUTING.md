# Contributing to MCP Router

Thank you for your interest in contributing to **MCP Router**!  
Issues, pull requests, documentation improvements, and feedback are all welcome.

This document describes how to work on the project, coding conventions, and the basic workflow for issues and pull requests.

## Code of Conduct

By participating in this project, you agree to follow our  
[Code of Conduct](CODE_OF_CONDUCT.md).

We aim to keep the community friendly, respectful, and inclusive. If you experience or observe unacceptable behavior, please contact the maintainers as described in the Code of Conduct.

## Project Overview

This repository is a monorepo managed with `pnpm` and `turbo`.  
The main parts are:

- `apps/electron` — Desktop app (Electron)
- `apps/cli` — CLI tool (`@mcp_router/cli`)
- `packages/shared` — Shared logic and TypeScript types
- `packages/remote-api-types` — Remote API schemas and types
- `packages/ui` — Shared UI components
- `packages/tailwind-config` — Shared Tailwind CSS config
- `docs` — Design docs, ADRs, and guidelines

When adding or changing code, please keep this structure in mind and place changes in the appropriate package/app.

## Ways to Contribute

- **Report bugs** using GitHub Issues
- **Suggest features or improvements**
- **Improve documentation** (README, docs, comments, examples)
- **Contribute code** via pull requests

If you are unsure whether an idea or change is a good fit, feel free to open an issue first or ask in our Discord community.

## Development Setup

### Prerequisites

- Node.js `>= 20.0.0`
- pnpm `>= 8.0.0`

We use `pnpm` workspaces and `turbo`. Please do not use `npm` or `yarn` for this repository.

### Install dependencies

```bash
pnpm install
```

### Run the app in development

Develop the desktop app and related packages:

```bash
pnpm dev
```

This runs the relevant `turbo` pipelines (including the Electron app).

### Useful scripts

- `pnpm dev` — Run development mode for core apps
- `pnpm build` — Build all packages/apps
- `pnpm typecheck` — Run TypeScript type checks
- `pnpm lint:fix` — Run ESLint and fix simple issues
- `pnpm test:e2e` — Run end-to-end tests for the Electron app
- `pnpm knip` — Analyze unused code (see `docs/` for context)

Please try to run at least `pnpm typecheck` and `pnpm lint:fix` before opening a PR.  
For Electron changes, also run `pnpm test:e2e` when possible.

## Coding Guidelines

### TypeScript and type definitions

MCP Router relies heavily on type safety and shared types.

- Prefer **TypeScript** (`.ts` / `.tsx`) for new code.
- Follow the guidelines in  
  `docs/TYPE_DEFINITION_GUIDELINES.md`.
- Do not introduce scattered type definitions:
  - Shared types belong in `packages/shared/src/types/` (or other allowed locations listed in the guideline).
  - Component props interfaces are allowed in `.tsx` files when they follow the rules.
- Custom ESLint rules (`no-scattered-types`, `no-type-reexport`) enforce these conventions.

If you are unsure where a type should live, check existing patterns in `packages/shared/src/types/` or open a discussion in your PR.

### Style and linting

- The project uses **ESLint** and **Prettier**.
- Try not to disable lint rules globally; if you must use an inline disable, add a short explanation in the PR description.
- Keep functions and components focused and small when possible.
- Follow existing patterns in nearby code rather than introducing new styles.

### Tests

- Add or update tests when you change behavior, especially in critical areas (auth, workspace management, networking, etc.).
- For Electron-related changes, consider E2E tests under `apps/electron/e2e`.
- If you cannot add tests for a change, explain why in the PR description.

## Pull Request Workflow

1. **Create a branch** from `main`.
2. Keep changes focused on a single topic or feature.
3. Before pushing:
   - `pnpm build`
   - `pnpm typecheck`
   - `pnpm lint:fix`
   - `pnpm test:e2e` (when relevant to Electron)
4. Update documentation as needed:
   - `README.md`, `README_ja.md`, `README_zh.md`
   - Files under `docs/` (design docs, ADRs, guidelines) if behavior or architecture changes
5. Open a pull request:
   - Use a clear, descriptive title
   - Fill in the PR template (`.github/PULL_REQUEST_TEMPLATE.md`)
   - Link related issues (e.g., `Closes #123`)
   - Describe testing performed and any known limitations

Small, incremental PRs are easier to review and merge than large, multi-purpose changes.

## Issue Guidelines

When opening an issue, please:

- Use the provided **Bug report** or **Feature request** templates
- Provide as much detail as possible:
  - OS and version
  - MCP Router version
  - How you installed MCP Router
  - Steps to reproduce (for bugs)
  - Expected vs actual behavior
- Attach logs or screenshots where helpful

For questions that are not bugs or clear feature requests, GitHub Discussions or Discord may be more appropriate.

## Security Issues

If you believe you have found a security vulnerability:

- **Please do not open a public GitHub issue at first.**
- Contact the maintainers privately (for example via the contact in `CODE_OF_CONDUCT.md` or other official channels).
- Provide as much detail as possible so we can reproduce and assess the impact.

We will work with you to investigate and, if needed, coordinate a fix and disclosure.

## Communication

For questions, ideas, or general discussion:

- GitHub Issues — for bugs and feature requests
- Discord — for questions and community discussion:  
  https://discord.com/invite/dwG9jPrhxB

Thank you again for helping improve MCP Router!

