import { BrowserWindow } from "electron";

// API configuration constants
export const BASE_URL = "https://mcp-router.net/";
export const API_BASE_URL = `${BASE_URL}api`;

// Main window registry
let mainWindowRef: BrowserWindow | null = null;

export function setMainWindow(window: BrowserWindow | null): void {
  mainWindowRef = window;
}

export function getMainWindow(): BrowserWindow | null {
  return mainWindowRef;
}
