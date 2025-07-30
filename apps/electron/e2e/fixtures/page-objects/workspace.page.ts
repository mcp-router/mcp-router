import { Page } from '@playwright/test';
import { BasePage } from './base.page';

export class WorkspacePage extends BasePage {
  constructor(page: Page) {
    super(page);
  }
  
  async openWorkspaceDialog() {
    await this.clickByTestId('create-workspace-btn');
    await this.waitForTestId('workspace-dialog');
  }
  
  async createWorkspace(name: string, description?: string) {
    await this.openWorkspaceDialog();
    
    await this.fillByTestId('workspace-name-input', name);
    
    if (description) {
      await this.fillByTestId('workspace-description-input', description);
    }
    
    await this.clickByTestId('create-btn');
    
    // Wait for dialog to close
    await this.page.waitForSelector('[data-testid="workspace-dialog"]', { state: 'hidden' });
  }
  
  async switchWorkspace(name: string) {
    await this.clickByTestId('workspace-switcher');
    await this.waitForTestId('workspace-menu');
    
    await this.page.click(`[data-testid="workspace-${name}"]`);
    
    // Wait for workspace to switch
    await this.page.waitForFunction(
      (workspaceName) => {
        const element = document.querySelector('[data-testid="current-workspace"]');
        return element?.textContent === workspaceName;
      },
      name,
      { timeout: 5000 }
    );
  }
  
  async deleteWorkspace(name: string) {
    await this.clickByTestId('workspace-switcher');
    await this.waitForTestId('workspace-menu');
    
    // Click delete button for specific workspace
    await this.page.click(`[data-testid="delete-workspace-${name}"]`);
    
    // Confirm deletion
    await this.waitForTestId('confirm-dialog');
    await this.clickByTestId('confirm-delete-btn');
  }
  
  async getWorkspaceList(): Promise<string[]> {
    await this.clickByTestId('workspace-switcher');
    await this.waitForTestId('workspace-menu');
    
    const workspaces = await this.page.$$eval(
      '[data-testid^="workspace-"]',
      elements => elements.map(el => el.textContent || '').filter(text => text)
    );
    
    // Close menu
    await this.page.keyboard.press('Escape');
    
    return workspaces;
  }
}