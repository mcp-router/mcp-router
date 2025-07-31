import { test, expect } from '../fixtures/electron-app';
import { waitForAppReady } from '../utils/helpers';

test.describe('App Launch', () => {
  test('should launch the application successfully', async ({ electronApp, page }) => {
    // Wait for app to be ready
    await waitForAppReady(page);
    
    // Check if window is visible
    const isVisible = await page.isVisible();
    expect(isVisible).toBe(true);
    
    // Check window title
    const title = await page.title();
    expect(title).toBe('MCP Router');
    
    // Check if main content is rendered
    const hasRoot = await page.locator('#root').count();
    expect(hasRoot).toBe(1);
  });
  
  test('should show main window with correct dimensions', async ({ electronApp }) => {
    const windows = await electronApp.windows();
    expect(windows.length).toBeGreaterThan(0);
    
    const mainWindow = windows[0];
    const bounds = await electronApp.evaluate(async ({ BrowserWindow }) => {
      const win = BrowserWindow.getAllWindows()[0];
      return win.getBounds();
    });
    
    expect(bounds.width).toBeGreaterThanOrEqual(800);
    expect(bounds.height).toBeGreaterThanOrEqual(600);
  });
  
  test('should have proper menu bar', async ({ electronApp }) => {
    const menuItems = await electronApp.evaluate(async ({ Menu }) => {
      const menu = Menu.getApplicationMenu();
      if (!menu) return [];
      
      return menu.items.map(item => ({
        label: item.label,
        visible: item.visible,
      }));
    });
    
    // Check for essential menu items
    const menuLabels = menuItems.map(item => item.label);
    expect(menuLabels).toContain('File');
    expect(menuLabels).toContain('Edit');
    expect(menuLabels).toContain('View');
    expect(menuLabels).toContain('Help');
  });
  
  test('should handle app close gracefully', async ({ electronApp }) => {
    // Get initial window count
    const initialWindows = await electronApp.windows();
    expect(initialWindows.length).toBeGreaterThan(0);
    
    // Close the main window
    await electronApp.close();
    
    // Verify app is closed
    const finalWindows = await electronApp.windows().catch(() => []);
    expect(finalWindows.length).toBe(0);
  });
});