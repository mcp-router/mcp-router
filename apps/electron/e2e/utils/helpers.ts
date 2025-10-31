import { Page, ElectronApplication } from "@playwright/test";
import fs from "fs/promises";
import path from "path";

export async function waitForAppReady(page: Page) {
  // Wait for the app to be fully loaded
  await page.waitForLoadState("domcontentloaded");

  // Wait for React to render - using locator instead of waitForFunction to avoid CSP issues
  await page.locator("#root > *").waitFor({ state: "visible" });

  // Additional wait for any initial loading states
  await page.waitForTimeout(1000);
}

/**
 * Get the main application window (the one with #root element)
 */
export async function getMainWindow(
  electronApp: ElectronApplication,
): Promise<Page | null> {
  const allWindows = await electronApp.windows();

  for (const window of allWindows) {
    try {
      // Check if this window has #root element (main window)
      const hasRootElement = await window.evaluate(() => {
        return document.querySelector("#root") !== null;
      });

      if (hasRootElement) {
        return window;
      }
    } catch (error) {
      // Window might be closed or not ready
      console.log("Failed to check window for #root element:", error);
    }
  }

  return null;
}
