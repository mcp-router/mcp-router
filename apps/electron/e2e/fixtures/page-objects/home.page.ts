import { Page } from "@playwright/test";
import { BasePage } from "./base.page";

export class HomePage extends BasePage {
  constructor(page: Page) {
    super(page);
  }

  async navigateToServers() {
    await this.clickByTestId("nav-servers");
    await this.waitForTestId("servers-page");
  }

  async navigateToLogs() {
    await this.clickByTestId("nav-logs");
    await this.waitForTestId("logs-page");
  }

  async navigateToSettings() {
    await this.clickByTestId("nav-settings");
    await this.waitForTestId("settings-page");
  }

  async getCurrentWorkspace(): Promise<string> {
    return await this.getText("current-workspace");
  }

  async openWorkspaceSwitcher() {
    await this.clickByTestId("workspace-switcher");
    await this.waitForTestId("workspace-menu");
  }

  async isAuthenticated(): Promise<boolean> {
    // Check if main navigation is visible
    return await this.isVisible("main-navigation");
  }
}
