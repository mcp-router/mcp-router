import { test as base, Page, ElectronApplication, _electron as electron } from '@playwright/test';
import path from 'path';
import { randomBytes } from 'crypto';

export type TestFixtures = {
  electronApp: ElectronApplication;
  page: Page;
};

export const test = base.extend<TestFixtures>({
  electronApp: async ({}, use) => {
    // Launch electron app from packaged version
    const platform = process.platform;
    let appPath: string;
    
    if (platform === 'darwin') {
      appPath = path.join(__dirname, '../../out/MCP Router-darwin-arm64/MCP Router.app/Contents/MacOS/MCP Router');
    } else if (platform === 'win32') {
      appPath = path.join(__dirname, '../../out/MCP Router-win32-x64/MCP Router.exe');
    } else {
      appPath = path.join(__dirname, '../../out/MCP Router-linux-x64/MCP Router');
    }
    
    // Unique user data dir for each test to avoid singleton lock
    const userDataDir = path.join(__dirname, '../../.test-data', randomBytes(8).toString('hex'));
    
    const app = await electron.launch({
      executablePath: appPath,
      args: [
        `--user-data-dir=${userDataDir}`,
        '--no-sandbox',
        '--disable-dev-shm-usage',
      ],
      env: {
        ...process.env,
        NODE_ENV: 'test',
        E2E_TEST: 'true',
        ELECTRON_DISABLE_SECURITY_WARNINGS: 'true',
      },
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