# ADR: Refactoring to Modular Architecture

## Status
Partially Implemented (January 2025)

## Context

The current Electron application's main process uses a 3-layer structure (application, infrastructure, utils). However, the following issues remain:

### Current Issues

1. **Circular Dependencies**
    - infrastructure → application
    - application → infrastructure
    - Mutual dependencies between layers persist

2. **Unclear Responsibility Boundaries**
    - Features are integrated into application but classification is unclear
    - Same functionality is scattered across multiple directories
    - New developers cannot determine appropriate placement

3. **Contribution Difficulties**
    - Complex layer structure leads to high learning costs
    - Unclear where things are located
    - Unclear how to write tests

4. **Decreased Maintainability**
    - Adding features requires changes across multiple layers
    - Refactoring is difficult
    - Ensuring test coverage is challenging

## Decision

We adopt a self-contained structure organized by feature modules (Modular Architecture).

### New Directory Structure

```
apps/electron/src/main/
├── modules/                 # Feature modules (self-contained) - Future target structure
│   ├── auth/               # Authentication module
│   │   ├── auth.ipc.ts           # IPC handlers
│   │   └── auth.service.ts       # Business logic
│   │
│   ├── cloud-sync/         # Cloud synchronization module
│   │
│   ├── marketplace/        # Marketplace module
│   │
│   ├── mcp-apps-manager/   # MCP app management module
│   │
│   ├── mcp-logger/         # MCP logging module
│   │
│   ├── mcp-server-manager/ # MCP server management module
│   │
│   ├── mcp-server-runtime/ # MCP server runtime module
│   │
│   ├── projects/           # Projects module
│   │
│   ├── skills/             # Skills module
│   │
│   ├── tool-catalog/       # Tool catalog module
│   │
│   ├── workflow/           # Workflow module
│   │   ├── workflow.service.ts
│   │   ├── workflow.repository.ts
│   │   ├── workflow.ipc.ts
│   │   └── __tests__/
│   │
│   └── workspace/          # Workspace module
│       ├── workspace.service.ts
│       ├── workspace.repository.ts
│       ├── workspace.ipc.ts
│       └── __tests__/
├── utils/                 # Utilities
│   ├── logger.ts
│   ├── logger-factory.ts
│   ├── fetch-utils.ts
│   ├── environment.ts
│   ├── env-utils.ts
│   ├── log-cleanup.ts
│   ├── url-validation-utils.ts
│   └── uri-utils.ts
│
└── main.ts                # Application entry point
```

### Module Structure Details

Each module consists of the following files:

1. **`.service.ts`** - Business logic
    - Domain knowledge implementation
    - Business rule application
    - External dependencies via interfaces

2. **`.repository.ts`** - Data access layer
    - Interaction with database
    - Data persistence and retrieval
    - Access via SQLiteManager

3. **`.ipc.ts`** - IPC handlers
    - Communication with renderer process
    - Calling service methods
    - Response formatting

4. **`.types.ts`** - Type definitions
    - Module-specific types
    - Interface definitions
    - Constant definitions

### Dependency Rules

```
IPC Handler → Service → Repository → Shared Database
     ↓           ↓           ↓
   Types       Types       Types
```

- **Unidirectional dependency**: Upper layers depend only on lower layers
- **No horizontal dependencies**: Avoid direct dependencies between modules
- **Via common features**: Inter-module communication goes through shared interfaces

### Dependency Injection Pattern

```typescript
// modules/auth/auth.service.ts
export interface AuthRepository {
  findUserByEmail(email: string): Promise<User | null>;
  createUser(data: CreateUserDto): Promise<User>;
}

export class AuthService {
  constructor(private repository: AuthRepository) {}

  async authenticate(email: string, password: string) {
    // Business logic
  }
}

// modules/auth/auth.repository.ts
export class AuthRepositoryImpl implements AuthRepository {
  constructor(private db: Database) {}

  async findUserByEmail(email: string) {
    // Database access
  }
}

// modules/auth/auth.ipc.ts
export function registerAuthHandlers(authService: AuthService) {
  ipcMain.handle('auth:login', async (_, { email, password }) => {
    return authService.authenticate(email, password);
  });
}
```

### Test Strategy

```typescript
// modules/auth/__tests__/auth.service.test.ts
describe('AuthService', () => {
  let service: AuthService;
  let mockRepository: jest.Mocked<AuthRepository>;

  beforeEach(() => {
    mockRepository = {
      findUserByEmail: jest.fn(),
      createUser: jest.fn(),
    };
    service = new AuthService(mockRepository);
  });

  test('should authenticate valid user', async () => {
    mockRepository.findUserByEmail.mockResolvedValue({
      id: '1',
      email: 'test@example.com',
      password: 'hashed',
    });

    const result = await service.authenticate('test@example.com', 'password');
    expect(result).toBeTruthy();
  });
});
```

## Consequences

### Advantages

1. **Ease of Understanding**
    - Self-contained by feature
    - Intuitive file placement
    - Low learning cost for new developers

2. **Maintainability**
    - Easy to add features
    - Refactoring is localized
    - Impact scope is clear

3. **Testability**
    - Easy to mock
    - Easy to write unit tests
    - Easy to ensure test coverage

4. **Parallel Development**
    - Fewer conflicts between modules
    - Easier team development
    - Clear responsibility scope

### Disadvantages

1. **Initial Migration Cost**
    - Requires large-scale movement of existing code
    - Potential for temporary instability

2. **Duplication of Common Features**
    - Similar code may occur in each module
    - Need to determine timing for consolidation

## Migration Plan

### Phase 1: Preparation
- [ ] Create new directory structure
- [ ] Prepare common features (shared)
- [ ] Build dependency injection mechanism

### Phase 2: Gradual Migration
- [ ] Sequential migration of each module

### Phase 3: Cleanup
- [ ] Delete old structure
- [ ] Update documentation
- [ ] Final testing

## References

- [Modular Architecture Pattern](https://martinfowler.com/articles/modular-architecture.html)
- [Feature-Sliced Design](https://feature-sliced.design/)
- [Vertical Slice Architecture](https://jimmybogard.com/vertical-slice-architecture/)
