# E2E Tests for MCP Router

This directory contains end-to-end tests for the MCP Router Electron application using Playwright.

## Structure

```
e2e/
├── fixtures/          # Test fixtures and page objects
│   ├── electron-app.ts    # Electron app setup fixture
│   ├── test-data.ts       # Test data constants
│   └── page-objects/      # Page object models
├── specs/             # Test specifications
├── utils/             # Helper utilities
└── README.md          # This file
```

## Running Tests

```bash
# Run all tests
pnpm test:e2e

# Run tests in headed mode (see browser)
pnpm test:e2e:headed

# Debug tests
pnpm test:e2e:debug

# Open Playwright UI
pnpm test:e2e:ui
```

## Writing Tests

### Page Objects

Use the Page Object pattern for better maintainability:

```typescript
// e2e/fixtures/page-objects/example.page.ts
export class ExamplePage extends BasePage {
  async doSomething() {
    await this.clickByTestId('example-button');
  }
}
```

### Test Structure

```typescript
import { test, expect } from '../fixtures/electron-app';

test.describe('Feature Name', () => {
  test('should do something', async ({ page }) => {
    // Test implementation
  });
});
```

### Best Practices

1. Use `data-testid` attributes for element selection
2. Keep tests independent and atomic
3. Use descriptive test names
4. Clean up test data after tests
5. Use page objects for reusable interactions

## Debugging

- Screenshots are saved to `e2e/screenshots/` on failure
- Use `--debug` flag to step through tests
- Check `test-results/` for detailed failure information

## CI Integration

Tests run automatically on CI with:
- Headless mode
- Retry on failure (2 times)
- HTML report generation