/**
 * Platform API React Context
 *
 * Provides platform API to React components through context
 * Adapted for Electron-specific use
 */

import React, { createContext, useContext } from "react";
import { PlatformAPI } from "./types/platform-api";

// Create the context
const PlatformAPIContext = createContext<PlatformAPI | null>(null);

// Provider component props
interface PlatformAPIProviderProps {
  platformAPI: PlatformAPI;
  children: React.ReactNode;
}

// Provider component
export function PlatformAPIProvider({
  platformAPI,
  children,
}: PlatformAPIProviderProps) {
  return (
    <PlatformAPIContext.Provider value={platformAPI}>
      {children}
    </PlatformAPIContext.Provider>
  );
}
