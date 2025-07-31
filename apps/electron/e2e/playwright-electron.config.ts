import { defineConfig } from '@playwright/test';
import path from 'path';

/**
 * Electron app E2E test configuration
 */
export default defineConfig({
  testDir: './specs',
  timeout: 60000,
  fullyParallel: false,
  workers: 1,
  // retries: process.env.CI ? 2 : 0,
  reporter: [['html']],
  
  // use: {
  //   trace: 'retain-on-failure',
  //   screenshot: 'only-on-failure',
  //   video: 'retain-on-failure',
  // },
});