import { initTRPC } from '@trpc/server';
import { z } from 'zod';
import superjson from 'superjson';
import type { User } from '@electron-monorepo/shared';

const t = initTRPC.create({
  transformer: superjson,
});

export const appRouter = t.router({
  sayHello: t.procedure
    .input(z.object({ name: z.string() }))
    .query(({ input }) => {
      return `Hello ${input.name}!`;
    }),

  fetchUser: t.procedure
    .input(z.object({ id: z.string() }))
    .query(({ input }): User => {
      return {
        id: input.id,
        name: 'Test User',
        email: 'test@example.com',
      };
    }),

  addUser: t.procedure
    .input(
      z.object({
        name: z.string(),
        email: z.string().email(),
      })
    )
    .mutation(({ input }): User => {
      return {
        id: Math.random().toString(36).substring(2, 11),
        name: input.name,
        email: input.email,
      };
    }),
});

export type AppRouter = typeof appRouter;
