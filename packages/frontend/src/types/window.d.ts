/**
 * Window type extensions for platform detection
 */

declare global {
  interface Window {
    electronAPI?: any; // This is just for detection, actual type is defined in Electron app
  }
}

export {};
