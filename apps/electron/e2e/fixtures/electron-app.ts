import { test as base, Page, ElectronApplication, _electron as electron } from '@playwright/test';
import path from 'path';
import { getMainWindow } from '../utils/helpers';

export type TestFixtures = {
  electronApp: ElectronApplication;
  page: Page;
};

export const test = base.extend<TestFixtures>({
  electronApp: async ({}, use) => {
    // Launch electron app from webpack build
    const appPath = path.join(__dirname, '../../.webpack/arm64/main/index.js');
    
    const app = await electron.launch({
      args: [appPath, '--env=production'],
    });
    
    // Wait for app to start up
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Get the main visible window
    const mainWindow = await getMainWindow(app);
    if (!mainWindow) {
      throw new Error('No visible window found');
    }
    
    // Wait for app to be ready
    await mainWindow.waitForLoadState('domcontentloaded');
    await mainWindow.waitForTimeout(1000); // Give app time to initialize
    
    await use(app);
    
    // Clean up
    await app.close();
  },
  
  page: async ({ electronApp }, use) => {
    const page = await getMainWindow(electronApp);
    if (!page) {
      throw new Error('No visible window found');
    }
    
    // Wait for app to be ready
    await page.waitForLoadState('domcontentloaded');

    await use(page);
  },
});

export { expect } from '@playwright/test';