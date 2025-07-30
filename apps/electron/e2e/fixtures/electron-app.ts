import { test as base, Page, ElectronApplication, _electron as electron } from '@playwright/test';
import path from 'path';

export type TestFixtures = {
  electronApp: ElectronApplication;
  page: Page;
};

export const test = base.extend<TestFixtures>({
  electronApp: async ({}, use) => {
    const appPath = path.join(__dirname, '../..');
    
    // Launch electron app
    const app = await electron.launch({
      args: [appPath],
      env: {
        ...process.env,
        NODE_ENV: 'test',
        E2E_TEST: 'true',
      },
    });
    
    // Wait for the first window to open
    await app.firstWindow();
    
    await use(app);
    
    // Clean up
    await app.close();
  },
  
  page: async ({ electronApp }, use) => {
    const page = await electronApp.firstWindow();
    
    // Wait for app to be ready
    await page.waitForLoadState('domcontentloaded');
    
    // Add custom test attributes for better element selection
    await page.addInitScript(() => {
      window.electronAPI = window.electronAPI || {};
    });
    
    await use(page);
  },
});

export { expect } from '@playwright/test';