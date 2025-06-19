'use client';

import { TRPCProvider } from '@electron-monorepo/frontend';

export function Providers({ children }: { children: React.ReactNode }) {
  return <TRPCProvider>{children}</TRPCProvider>;
}
