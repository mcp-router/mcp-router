import { test, expect } from '../fixtures/electron-app';
import { HomePage } from '../fixtures/page-objects/home.page';
import { WorkspacePage } from '../fixtures/page-objects/workspace.page';
import { testData } from '../fixtures/test-data';
import { waitForAppReady } from '../utils/helpers';

test.describe('Workspace Management', () => {
  let homePage: HomePage;
  let workspacePage: WorkspacePage;
  
  test.beforeEach(async ({ page }) => {
    await waitForAppReady(page);
    homePage = new HomePage(page);
    workspacePage = new WorkspacePage(page);
  });
  
  test('should display default workspace on first launch', async () => {
    const currentWorkspace = await homePage.getCurrentWorkspace();
    expect(currentWorkspace).toBe(testData.workspace.default);
  });
  
  test('should create a new workspace', async () => {
    const workspaceName = `Test-${Date.now()}`;
    
    await workspacePage.createWorkspace(workspaceName, 'Test workspace for E2E testing');
    
    // Verify workspace was created and switched to
    const currentWorkspace = await homePage.getCurrentWorkspace();
    expect(currentWorkspace).toBe(workspaceName);
  });
  
  test('should switch between workspaces', async () => {
    // Create two workspaces
    const workspace1 = `Workspace1-${Date.now()}`;
    const workspace2 = `Workspace2-${Date.now()}`;
    
    await workspacePage.createWorkspace(workspace1);
    await workspacePage.createWorkspace(workspace2);
    
    // Should be on workspace2 after creation
    let currentWorkspace = await homePage.getCurrentWorkspace();
    expect(currentWorkspace).toBe(workspace2);
    
    // Switch to workspace1
    await workspacePage.switchWorkspace(workspace1);
    currentWorkspace = await homePage.getCurrentWorkspace();
    expect(currentWorkspace).toBe(workspace1);
  });
  
  test('should list all workspaces', async () => {
    const workspaceList = await workspacePage.getWorkspaceList();
    
    // Should at least have the default workspace
    expect(workspaceList).toContain(testData.workspace.default);
    expect(workspaceList.length).toBeGreaterThanOrEqual(1);
  });
  
  test('should prevent deletion of current workspace', async ({ page }) => {
    const currentWorkspace = await homePage.getCurrentWorkspace();
    
    await homePage.openWorkspaceSwitcher();
    
    // Try to delete current workspace - button should be disabled
    const deleteButton = page.locator(`[data-testid="delete-workspace-${currentWorkspace}"]`);
    await expect(deleteButton).toBeDisabled();
  });
});