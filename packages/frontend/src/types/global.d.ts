import type { AppRouter } from '@electron-monorepo/api';
import type { createTRPCProxyClient } from '@trpc/client';

declare global {
  interface Window {
    electronTRPC?: ReturnType<typeof createTRPCProxyClient<AppRouter>>;
  }
}

export {};
