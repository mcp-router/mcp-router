/**
 * Platform API factory
 *
 * This module provides utilities for creating platform-specific API instances
 */

import { PlatformAPI } from "./platform-api-interface";

// Platform detection
export const isElectron = () => {
  return typeof window !== "undefined" && window.electronAPI !== undefined;
};

export const isWeb = () => {
  return typeof window !== "undefined" && !window.electronAPI;
};

/**
 * Factory function to create platform-specific API instance
 * @param customImplementation Optional custom implementation to use
 * @returns Platform API instance with domain-based structure
 */
export function createPlatformAPI(
  customImplementation?: PlatformAPI,
): PlatformAPI {
  if (customImplementation) {
    return customImplementation;
  }

  if (isElectron()) {
    // In Electron, the implementation should be provided by the app
    throw new Error("Electron platform API implementation must be provided");
  }

  // For web, the implementation should be provided by the app
  throw new Error("Web platform API implementation must be provided");
}
