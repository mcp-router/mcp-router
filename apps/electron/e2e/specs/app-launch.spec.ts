import { test, expect } from '../fixtures/electron-app';
import {waitForAppReady} from '../utils/helpers';

test.describe('App Launch', () => {
  test('should launch the application successfully', async ({ electronApp, page }) => {
    // Wait for app to be ready
    await waitForAppReady(page);
    
    // Check if window is visible
    const isVisible = await page.isVisible("#root");
    expect(isVisible).toBe(true);
    
    // Check window title
    const title = await page.title();
    expect(title).toBe('MCP Router');
    
    // Check if main content is rendered
    const hasRoot = await page.locator('#root').count();
    expect(hasRoot).toBe(1);
  });
  
  test('should show main window with correct dimensions', async ({ page }) => {
    // The page fixture already gives us the main window
    // Let's get the bounds from the page's viewport
    expect(page).not.toBeNull();
    const viewport = await page.viewportSize();
    if (viewport) {
      expect(viewport.width).toBeGreaterThanOrEqual(800);
      expect(viewport.height).toBeGreaterThanOrEqual(600);
    }
  });
  
  test('should handle app close gracefully', async ({ electronApp }) => {
    // Get initial window count
    const initialWindows = await electronApp.windows();
    expect(initialWindows.length).toBeGreaterThan(0);
    
    // Close the main window
    await electronApp.close();
    
    // Verify app is closed
    let finalWindows: any[] = [];
    try {
      finalWindows = await electronApp.windows();
    } catch (error) {
      // App is closed, windows() will throw
      finalWindows = [];
    }
    expect(finalWindows.length).toBe(0);
  });
});