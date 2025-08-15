import { Page } from "@playwright/test";
import { BasePage } from "./base.page";

export class ServerPage extends BasePage {
  constructor(page: Page) {
    super(page);
  }

  async navigateToManual() {
    await this.clickByTestId("server-tab-manual");
    await this.waitForTestId("manual-server-form");
  }

  async navigateToDiscover() {
    await this.clickByTestId("server-tab-discover");
    await this.waitForTestId("discover-server-list");
  }

  async addManualServer(config: {
    name: string;
    command: string;
    args?: string[];
    description?: string;
  }) {
    await this.navigateToManual();

    await this.fillByTestId("server-name-input", config.name);
    await this.fillByTestId("server-command-input", config.command);

    if (config.args && config.args.length > 0) {
      await this.fillByTestId("server-args-input", config.args.join(" "));
    }

    if (config.description) {
      await this.fillByTestId("server-description-input", config.description);
    }

    await this.clickByTestId("add-server-btn");

    // Wait for server to be added
    await this.waitForTestId(`server-item-${config.name}`);
  }

  async startServer(name: string) {
    await this.clickByTestId(`server-start-${name}`);

    // Wait for server to start
    await this.page.waitForSelector(
      `[data-testid="server-status-${name}"][data-status="running"]`,
      { timeout: 10000 },
    );
  }

  async stopServer(name: string) {
    await this.clickByTestId(`server-stop-${name}`);

    // Wait for server to stop
    await this.page.waitForSelector(
      `[data-testid="server-status-${name}"][data-status="stopped"]`,
      { timeout: 10000 },
    );
  }

  async getServerStatus(name: string): Promise<string> {
    const statusElement = await this.getByTestId(`server-status-${name}`);
    return (await statusElement.getAttribute("data-status")) || "unknown";
  }

  async deleteServer(name: string) {
    await this.clickByTestId(`server-menu-${name}`);
    await this.clickByTestId("server-delete-option");

    // Confirm deletion
    await this.waitForTestId("confirm-dialog");
    await this.clickByTestId("confirm-delete-btn");

    // Wait for server to be removed
    await this.page.waitForSelector(`[data-testid="server-item-${name}"]`, {
      state: "hidden",
    });
  }

  async searchServers(query: string) {
    await this.fillByTestId("server-search-input", query);
    await this.page.keyboard.press("Enter");
  }

  async getServerList(): Promise<string[]> {
    const servers = await this.page.$$eval(
      '[data-testid^="server-item-"]',
      (elements) =>
        elements.map(
          (el) =>
            el.getAttribute("data-testid")?.replace("server-item-", "") || "",
        ),
    );

    return servers.filter((name) => name);
  }
}
