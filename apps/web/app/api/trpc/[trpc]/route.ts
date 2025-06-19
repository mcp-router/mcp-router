import { fetchRequestHandler } from '@trpc/server/adapters/fetch';
import { appRouter } from '@electron-monorepo/api';
import { createContext } from '@electron-monorepo/api/src/context';

const handler = (request: Request) => {
  return fetchRequestHandler({
    endpoint: '/api/trpc',
    req: request,
    router: appRouter,
    createContext,
  });
};

export { handler as GET, handler as POST };
