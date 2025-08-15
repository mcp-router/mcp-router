import { Page } from "@playwright/test";

export abstract class BasePage {
  constructor(protected page: Page) {}

  async waitForLoadComplete() {
    await this.page.waitForLoadState("networkidle");
  }

  async clickByTestId(testId: string) {
    await this.page.click(`[data-testid="${testId}"]`);
  }

  async fillByTestId(testId: string, value: string) {
    await this.page.fill(`[data-testid="${testId}"]`, value);
  }

  async getByTestId(testId: string) {
    return this.page.locator(`[data-testid="${testId}"]`);
  }

  async waitForTestId(testId: string, options?: { timeout?: number }) {
    await this.page.waitForSelector(`[data-testid="${testId}"]`, options);
  }

  async isVisible(testId: string): Promise<boolean> {
    return await this.page.isVisible(`[data-testid="${testId}"]`);
  }

  async getText(testId: string): Promise<string> {
    return (await this.page.textContent(`[data-testid="${testId}"]`)) || "";
  }

  async screenshot(name: string) {
    await this.page.screenshot({ path: `e2e/screenshots/${name}.png` });
  }
}
