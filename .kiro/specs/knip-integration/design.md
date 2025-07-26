# Design Document

## Overview

This design outlines the integration of Knip into the MCP Router monorepo to identify unused files, dependencies, and exports. Knip will be configured to work seamlessly with the existing pnpm workspace structure, Turbo build system, and TypeScript/React/Electron stack.

The solution provides automated dead code detection across all packages while minimizing false positives through careful configuration of entry points, ignore patterns, and workspace-specific rules.

## Architecture

### Integration Points

1. **Package Management**: Knip will be installed as a root-level devDependency
2. **Build Pipeline**: Integration with Turbo for efficient workspace analysis
3. **CI/CD**: NPM scripts for manual and automated execution
4. **Configuration**: Centralized configuration with workspace-specific overrides

### Workspace Structure Analysis

The monorepo contains:
- **apps/electron**: Main Electron application with React frontend
- **packages/shared**: Shared TypeScript utilities and types
- **packages/ui**: React component library with Radix UI
- **packages/cli**: Command-line interface tools
- **packages/remote-api-types**: API type definitions
- **packages/tailwind-config**: Shared Tailwind configuration

## Components and Interfaces

### Configuration Structure

```typescript
interface KnipConfig {
  workspaces: {
    [workspaceName: string]: {
      entry: string[];
      project: string[];
      ignore: string[];
      ignoreDependencies?: string[];
      ignoreExportsUsedInFile?: Record<string, string[]>;
    }
  };
  ignore: string[];
  ignoreDependencies: string[];
  ignoreWorkspaces: string[];
}
```

### Entry Points Mapping

Each workspace will have specific entry points:

- **Root**: Package scripts, configuration files
- **apps/electron**: Main process, renderer, preload scripts
- **packages/shared**: Public API exports
- **packages/ui**: Component exports, style exports
- **packages/cli**: CLI entry points
- **packages/remote-api-types**: Type definition exports
- **packages/tailwind-config**: Configuration exports

### Ignore Patterns

Global ignore patterns for:
- Build artifacts (dist/, out/, .webpack/)
- Generated files (*.d.ts from build)
- Test files (*.test.ts, *.spec.ts)
- Configuration files with dynamic imports
- Electron-specific patterns

## Data Models

### Analysis Report Structure

```typescript
interface KnipReport {
  files: string[];           // Unused files
  dependencies: string[];    // Unused dependencies
  devDependencies: string[]; // Unused dev dependencies
  exports: Array<{           // Unused exports
    file: string;
    exports: string[];
  }>;
  types: Array<{            // Unused types
    file: string;
    types: string[];
  }>;
}
```

### Configuration Templates

#### Root Configuration (knip.json)
```json
{
  "workspaces": {
    ".": {
      "entry": ["scripts/**/*.{js,ts}", "*.config.{js,ts,mjs}"],
      "ignore": ["**/*.d.ts", "**/dist/**", "**/.turbo/**"]
    },
    "apps/electron": {
      "entry": [
        "src/main.ts",
        "src/renderer.ts", 
        "src/preload.ts",
        "src/background.tsx",
        "forge.config.ts",
        "webpack.*.ts"
      ],
      "ignoreDependencies": [
        "electron",
        "@electron/rebuild",
        "electron-squirrel-startup"
      ]
    },
    "packages/shared": {
      "entry": ["src/index.ts"],
      "project": ["src/**/*.ts"]
    },
    "packages/ui": {
      "entry": ["src/index.ts"],
      "project": ["src/**/*.{ts,tsx}"],
      "ignoreExportsUsedInFile": {
        "src/components/*.tsx": ["default"]
      }
    }
  }
}
```

## Error Handling

### False Positive Mitigation

1. **Workspace Dependencies**: Properly handle `workspace:*` dependencies
2. **Dynamic Imports**: Configure ignore patterns for runtime-loaded modules
3. **Electron Specifics**: Handle main/renderer process separation
4. **React Components**: Account for JSX usage patterns
5. **Type-only Imports**: Distinguish between runtime and type dependencies

### Error Recovery

- Graceful handling of malformed configuration
- Fallback to default patterns for unknown file types
- Clear error messages for configuration issues
- Validation of workspace paths and entry points

## Testing Strategy

### Unit Testing

1. **Configuration Validation**: Test knip.json schema compliance
2. **Entry Point Detection**: Verify correct entry point identification
3. **Ignore Pattern Matching**: Test ignore pattern effectiveness
4. **Workspace Resolution**: Validate workspace-specific configurations

### Integration Testing

1. **Full Monorepo Analysis**: Run Knip against entire codebase
2. **Turbo Integration**: Test execution through Turbo pipeline
3. **CI/CD Integration**: Validate automated execution scenarios
4. **Report Generation**: Test different output formats

### Performance Testing

1. **Large Codebase Analysis**: Measure execution time on full monorepo
2. **Incremental Analysis**: Test workspace-specific execution
3. **Memory Usage**: Monitor resource consumption during analysis
4. **Cache Effectiveness**: Validate Turbo caching benefits

### Validation Scenarios

1. **Known Unused Code**: Verify detection of intentionally unused files
2. **False Positive Prevention**: Ensure legitimate code isn't flagged
3. **Dependency Analysis**: Test accurate dependency usage detection
4. **Export Analysis**: Validate export usage across workspace boundaries

## Implementation Phases

### Phase 1: Basic Setup
- Install Knip dependency
- Create basic configuration
- Add npm scripts
- Test on single workspace

### Phase 2: Monorepo Configuration
- Configure all workspaces
- Set up entry points and ignore patterns
- Integrate with Turbo
- Add CI/CD scripts

### Phase 3: Optimization
- Fine-tune ignore patterns
- Add workspace-specific rules
- Optimize performance
- Add reporting enhancements

### Phase 4: Documentation and Maintenance
- Create usage documentation
- Set up automated reporting
- Establish maintenance procedures
- Train team on usage patterns