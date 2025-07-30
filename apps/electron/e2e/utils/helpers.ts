import { Page } from '@playwright/test';
import fs from 'fs/promises';
import path from 'path';

export async function waitForAppReady(page: Page) {
  // Wait for the app to be fully loaded
  await page.waitForLoadState('domcontentloaded');
  
  // Wait for React to render
  await page.waitForFunction(() => {
    const root = document.getElementById('root');
    return root && root.children.length > 0;
  });
  
  // Additional wait for any initial loading states
  await page.waitForTimeout(1000);
}

export async function clearTestData() {
  // Clear test workspace data if exists
  const testDataPath = path.join(process.env.HOME || '', '.mcp-router-test');
  try {
    await fs.rm(testDataPath, { recursive: true, force: true });
  } catch (error) {
    // Ignore if doesn't exist
  }
}

export async function takeScreenshot(page: Page, name: string) {
  const screenshotDir = path.join(__dirname, '../screenshots');
  await fs.mkdir(screenshotDir, { recursive: true });
  
  await page.screenshot({
    path: path.join(screenshotDir, `${name}-${Date.now()}.png`),
    fullPage: true,
  });
}

export async function mockElectronAPI(page: Page) {
  await page.addInitScript(() => {
    // Mock electron API for testing
    window.electronAPI = {
      auth: {
        login: async () => ({ success: true }),
        logout: async () => ({ success: true }),
        getAuthState: async () => ({ isAuthenticated: true }),
      },
      workspace: {
        list: async () => [{ id: '1', name: 'Default' }],
        create: async () => ({ id: '2', name: 'Test Workspace' }),
        switch: async () => ({ success: true }),
      },
      server: {
        list: async () => [],
        create: async () => ({ id: '1', name: 'Test Server' }),
        start: async () => ({ success: true }),
        stop: async () => ({ success: true }),
      },
    };
  });
}

export function generateTestId(): string {
  return `test-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}