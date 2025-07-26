# Knip Integration Guide

This document provides detailed information about the Knip integration in the MCP Router monorepo.

## Overview

[Knip](https://knip.dev/) is a comprehensive tool for finding unused files, dependencies, and exports in JavaScript and TypeScript projects. Our integration provides automated dead code detection across all workspaces in the monorepo.

## Architecture

### Workspace Configuration

Each workspace in the monorepo has its own Knip configuration:

- **Root workspace (`.`)**: Scripts, configuration files, and global patterns
- **Electron app (`apps/electron`)**: Main process, renderer, and preload scripts
- **Shared package (`packages/shared`)**: Common utilities and types
- **UI package (`packages/ui`)**: React components and hooks
- **CLI package (`packages/cli`)**: Command-line interface
- **Remote API types (`packages/remote-api-types`)**: Type definitions
- **Tailwind config (`packages/tailwind-config`)**: Styling configuration

### Integration with Turbo

Knip is integrated with Turbo for optimal performance:

```json
{
  "knip": {
    "cache": true,
    "outputs": [],
    "inputs": [
      "src/**/*.{ts,tsx,js,jsx}",
      "*.config.{js,ts,mjs}",
      "package.json",
      "knip.json",
      "tsconfig.json"
    ],
    "dependsOn": ["^build"],
    "env": ["NODE_ENV"],
    "passThroughEnv": ["CI"]
  }
}
```

## Usage Examples

### Basic Analysis

```bash
# Analyze all workspaces
pnpm knip

# Analyze specific workspace
pnpm knip --workspace packages/shared

# Generate JSON output
pnpm knip --reporter json
```

### Turbo Integration

```bash
# Run via Turbo (recommended)
pnpm turbo knip

# Run on specific workspaces with caching
pnpm turbo knip --filter=@mcp_router/ui --filter=@mcp_router/shared

# Run with continue flag to analyze all workspaces even if some fail
pnpm turbo knip --continue
```

### CI/CD Integration

```bash
# Exit with non-zero code if issues found (for CI)
pnpm knip:ci

# Run in CI environment with proper caching
CI=true pnpm turbo knip
```

## Configuration Details

### Global Ignore Patterns

```json
{
  "ignore": [
    "**/*.d.ts",           // TypeScript declaration files
    "**/dist/**",          // Build output
    "**/out/**",           // Electron build output
    "**/.turbo/**",        // Turbo cache
    "**/.webpack/**",      // Webpack cache
    "**/coverage/**",      // Test coverage
    "**/build/**",         // Build artifacts
    "**/.next/**",         // Next.js cache
    "**/node_modules/**",  // Dependencies
    "**/*.min.js",         // Minified files
    "**/*.test.{ts,tsx,js,jsx}",  // Test files
    "**/*.spec.{ts,tsx,js,jsx}",  // Spec files
    "**/forge.config.ts",  // Electron Forge config
    "**/*.map",            // Source maps
    "**/*.log",            // Log files
    "**/tmp/**",           // Temporary files
    "**/temp/**"           // Temporary files
  ]
}
```

### Dependency Analysis Rules

The configuration includes specific rules for handling different types of dependencies:

- **Build tools**: Webpack, Electron Forge, and related tools are ignored
- **Peer dependencies**: React and React DOM are handled as peer dependencies
- **Development dependencies**: ESLint, Prettier, and TypeScript tools are properly categorized

### Export Analysis Rules

Export analysis is configured to handle:

- **React components**: Default exports from component files
- **Utility functions**: Named exports from library files
- **Type definitions**: TypeScript type exports
- **Public APIs**: Workspace boundary exports

## Troubleshooting

### Common False Positives

1. **UI Component Libraries**
   ```
   Issue: @radix-ui components showing as unused
   Solution: These are used in component files that may not be analyzed in isolation
   ```

2. **Build Tool Dependencies**
   ```
   Issue: Webpack loaders showing as unused
   Solution: These are used by configuration files and are intentionally ignored
   ```

3. **Type-only Imports**
   ```
   Issue: TypeScript types showing as unused
   Solution: Configure ignoreExportsUsedInFile for type definition files
   ```

### Performance Optimization

1. **Use Turbo caching**: Always run via `pnpm turbo knip` for better performance
2. **Workspace filtering**: Use `--filter` to analyze specific workspaces
3. **Parallel execution**: Turbo runs multiple workspace analyses in parallel

### Debugging

```bash
# Run with debug information
pnpm knip --debug

# Show configuration hints
pnpm knip --include-config-hints

# Dry run to see what would be analyzed
pnpm turbo knip --dry-run
```

## Best Practices

### Development Workflow

1. **Regular Analysis**: Run Knip regularly during development
2. **Pre-commit Checks**: Consider adding Knip to pre-commit hooks
3. **CI Integration**: Include Knip in CI pipeline for automated checks

### Configuration Maintenance

1. **Review Ignore Patterns**: Regularly review and update ignore patterns
2. **Workspace Updates**: Update configuration when adding new workspaces
3. **Dependency Changes**: Adjust ignoreDependencies when build tools change

### Handling Results

1. **Prioritize Issues**: Focus on unused dependencies before unused exports
2. **Validate Findings**: Always verify that reported issues are actually unused
3. **Incremental Cleanup**: Address issues incrementally rather than all at once

## Advanced Configuration

### Custom Rules

You can customize analysis rules per workspace:

```json
{
  "workspaces": {
    "packages/ui": {
      "rules": {
        "dependencies": "error",
        "devDependencies": "warn",
        "exports": "off"
      }
    }
  }
}
```

### Plugin Integration

Knip supports plugins for various frameworks and tools. Our configuration includes:

- **React**: Automatic detection of JSX usage
- **TypeScript**: Type-aware analysis
- **Webpack**: Build tool integration

## Contributing

When contributing to the Knip configuration:

1. Test changes across all workspaces
2. Document any new ignore patterns
3. Update this guide with new usage patterns
4. Ensure CI pipeline continues to work

## Resources

- [Knip Documentation](https://knip.dev/)
- [Turbo Documentation](https://turbo.build/)
- [Project Configuration](../knip.json)