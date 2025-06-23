// Platform API interface
export { PlatformAPI } from './platform-api-interface';

// Platform API factory and utilities
export { 
  isElectron, 
  isWeb, 
  WebPlatformAPI, 
  createPlatformAPI 
} from './platform-api-factory';

// Platform API React context and provider
export { 
  PlatformAPIProvider, 
  usePlatformAPI as usePlatformAPIContext,
  usePlatformAPIAvailable 
} from './platform-api-context';

// Platform API shim for backward compatibility
export { 
  initializePlatformAPIShim,
  getPlatformAPI,
  platformAPI,
  usePlatformAPI
} from './platform-api-shim';