import { test as base, Page, ElectronApplication, _electron as electron } from '@playwright/test';
import path from 'path';

export type TestFixtures = {
  electronApp: ElectronApplication;
  page: Page;
};

export const test = base.extend<TestFixtures>({
  electronApp: async ({}, use) => {
    // Launch electron app from webpack build
    const appPath = path.join(__dirname, '../../.webpack/arm64/main/index.js');
    
    const app = await electron.launch({
      args: [appPath],
    });
    
    // Wait for the first window to open
    const window = await app.firstWindow();
    
    // Wait for app to be ready
    await window.waitForLoadState('domcontentloaded');
    await window.waitForTimeout(2000); // Give app time to initialize
    
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