# Repository Guidelines

## Project Structure & Module Organization
Monorepo managed with `pnpm` workspaces and Turborepo.

- `apps/electron`: Electron + React desktop app (`src/main`, `src/renderer`, `e2e/`).
- `apps/cli`: `mcpr` CLI.
- `packages/shared`: shared types and utilities.
- `packages/remote-api-types`: remote API schemas.
- `packages/ui`, `packages/tailwind-config`: shared UI/styling.
- `docs/`: architecture and process docs.
- `tools/eslint-rules/`: custom lint rules.

## Build, Test, and Development Commands
Use `pnpm` only (not npm/yarn).

- `pnpm install`: install workspace dependencies.
- `pnpm dev`: run core workspaces in dev mode.
- `pnpm build`: build all packages/apps.
- `pnpm typecheck`: run TypeScript checks across the monorepo.
- `pnpm lint:fix`: run ESLint and auto-fix.
- `pnpm knip`: detect unused files/exports/dependencies.
- `pnpm --filter @mcp_router/electron test`: run Vitest tests.
- `pnpm test:e2e`: package and run Electron Playwright E2E.

## Coding Style & Naming Conventions
- TypeScript-first (`.ts`/`.tsx`).
- Prettier defaults: 2 spaces, semicolons, double quotes, 80-char width.
- Follow ESLint, including repo custom rules.
- Prefix intentionally unused variables with `_` to satisfy linting.
- Keep shared types in `packages/shared/src/types`.
- Follow module naming patterns: `*.service.ts`, `*.repository.ts`, `*.ipc.ts`.

## Testing Guidelines
- Unit/integration tests use Vitest (`*.test.ts`); E2E uses Playwright (`apps/electron/e2e/specs/*.spec.ts`).
- Add or update tests for behavior changes, or explain test gaps in the PR.

## Commit & Pull Request Guidelines
- Use conventional commit style, e.g. `feat(system): ...`, `fix(security): ...`, `chore: ...`.
- Keep commits scoped to one concern.
- Follow `.github/PULL_REQUEST_TEMPLATE.md` with summary, linked issues, and test steps.
- Include screenshots/videos for UI changes and update docs when behavior changes.

## Agent-Native Practices
- Keep action parity: if users can do it in UI/CLI, agents should have a documented tool/command path.
- Keep context parity: agents and humans should operate from the same repo state and assumptions.
- Keep a shared workspace: avoid agent-only output silos.
- Review parity checks: `apps/electron` UI changes, `apps/cli`/`packages/*` command paths, and docs updates should each state how parity was validated.

## Security & Configuration Tips
- Copy `.env.example` to `.env` for local configuration.
- Never commit secrets (tokens, signing keys, credentials).
- Report security issues privately instead of opening public vulnerability issues.

## Review References
- `docs/solutions/code-quality/REVIEW_QUICK_START.md`: recurring high-risk review checklist.
- `docs/solutions/code-quality/codebase-review-institutional-knowledge.md`: recurring patterns and prevention guidance.
