import { createTRPCReact } from '@trpc/react-query';
import type { AppRouter } from '@electron-monorepo/api';

// Create a single shared tRPC instance
export const trpc = createTRPCReact<AppRouter>();
