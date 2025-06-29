/**
 * Platform API React Context
 *
 * Provides platform API to React components through context
 */

import React, { createContext, useContext } from "react";
import { PlatformAPI } from "./platform-api-interface";

// Create the context
const PlatformAPIContext = createContext<PlatformAPI | null>(null);

// Provider component props
export interface PlatformAPIProviderProps {
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

// Hook to use the platform API
export function usePlatformAPI(): PlatformAPI {
  const context = useContext(PlatformAPIContext);

  if (!context) {
    throw new Error("usePlatformAPI must be used within a PlatformAPIProvider");
  }

  return context;
}
