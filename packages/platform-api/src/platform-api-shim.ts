/**
 * Platform API Shim Layer
 * 
 * This provides backward compatibility for components that directly import platformAPI
 * while preparing for migration to context-based approach
 */

import { PlatformAPI } from "./platform-api-interface";

// Global platform API instance holder
let _platformAPI: PlatformAPI | null = null;

/**
 * Initialize the platform API shim with a specific implementation
 * This should be called once at app startup
 */
export function initializePlatformAPIShim(api: PlatformAPI): void {
  _platformAPI = api;
}

/**
 * Get the current platform API instance
 * Throws if not initialized
 */
export function getPlatformAPI(): PlatformAPI {
  if (!_platformAPI) {
    throw new Error(
      'Platform API not initialized. Call initializePlatformAPIShim() first.'
    );
  }
  return _platformAPI;
}

/**
 * Legacy export for backward compatibility
 * Components can import { platformAPI } and it will work
 */
export const platformAPI = new Proxy({} as PlatformAPI, {
  get(target, prop, receiver) {
    const api = getPlatformAPI();
    return Reflect.get(api, prop, receiver);
  }
});

/**
 * Hook for backward compatibility
 * Provides same interface as before but uses the shim
 */
export const usePlatformAPI = () => platformAPI;