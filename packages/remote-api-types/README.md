# @mcp_router/remote-api-types

tRPC client package for MCP Router Remote API

## Overview

This package provides a tRPC client for communicating with the MCP Router remote workspace API.

## Usage

### Client side (MCP Router)

```typescript
import { createRemoteAPIClient } from '@mcp_router/remote-api-types';

const client = createRemoteAPIClient({
  url: 'https://api.example.com',
  token: 'your-bearer-token',
});

// Get server list
const servers = await client.servers.list.query();

// Create a server
const newServer = await client.servers.create.mutate({
  name: 'My Server',
  config: {
    id: 'server-1',
    name: 'My Server',
    serverType: 'local',
    command: 'node',
    args: ['server.js'],
    env: {},
  },
});
```

### Server side (Remote API Server)

```typescript
import { initTRPC, TRPCError } from '@trpc/server';
import {
  createServerSchema,
  updateServerSchema,
  deleteServerSchema,
  logQueryOptionsSchema
} from '@mcp_router/remote-api-types/schema';

const t = initTRPC.create();

// Authentication middleware
const isAuthed = t.middleware(({ ctx, next }) => {
  if (!ctx.user) {
    throw new TRPCError({ code: 'UNAUTHORIZED' });
  }
  return next({
    ctx: {
      user: ctx.user,
    },
  });
});

const protectedProcedure = t.procedure.use(isAuthed);

const serversRouter = t.router({
  list: protectedProcedure
    .query(async ({ ctx }) => {
      // Return server list
      return await db.servers.findMany({
        where: { userId: ctx.user.id }
      });
    }),

  get: protectedProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ input, ctx }) => {
      return await db.servers.findFirst({
        where: { id: input.id, userId: ctx.user.id }
      });
    }),

  create: protectedProcedure
    .input(createServerSchema)
    .mutation(async ({ input, ctx }) => {
      // Create a server
      return await db.servers.create({
        data: {
          ...input,
          userId: ctx.user.id
        }
      });
    }),

  update: protectedProcedure
    .input(updateServerSchema)
    .mutation(async ({ input, ctx }) => {
      const { id, ...data } = input;
      return await db.servers.update({
        where: { id, userId: ctx.user.id },
        data
      });
    }),

  delete: protectedProcedure
    .input(deleteServerSchema)
    .mutation(async ({ input, ctx }) => {
      await db.servers.delete({
        where: { id: input.id, userId: ctx.user.id }
      });
    }),

  start: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ input, ctx }) => {
      // Start the server
      await startMCPServer(input.id, ctx.user.id);
    }),

  stop: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ input, ctx }) => {
      // Stop the server
      await stopMCPServer(input.id, ctx.user.id);
    }),
});

const logsRouter = t.router({
  list: protectedProcedure
    .input(logQueryOptionsSchema.optional())
    .query(async ({ input, ctx }) => {
      // Return logs
      const where = {
        userId: ctx.user.id,
        ...(input?.serverId && { serverId: input.serverId }),
        ...(input?.clientId && { clientId: input.clientId }),
        ...(input?.requestType && { requestType: input.requestType }),
        ...(input?.responseStatus && { responseStatus: input.responseStatus }),
        ...(input?.startDate && { timestamp: { gte: new Date(input.startDate).getTime() } }),
        ...(input?.endDate && { timestamp: { lte: new Date(input.endDate).getTime() } }),
      };

      const [logs, total] = await Promise.all([
        db.logs.findMany({
          where,
          skip: input?.offset,
          take: input?.limit || 100,
          orderBy: { timestamp: 'desc' }
        }),
        db.logs.count({ where })
      ]);

      return { logs, total };
    }),

  get: protectedProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ input, ctx }) => {
      return await db.logs.findFirst({
        where: { id: input.id, userId: ctx.user.id }
      });
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ input, ctx }) => {
      await db.logs.delete({
        where: { id: input.id, userId: ctx.user.id }
      });
    }),

  clear: protectedProcedure
    .input(z.object({ serverId: z.string().optional() }).optional())
    .mutation(async ({ input, ctx }) => {
      await db.logs.deleteMany({
        where: {
          userId: ctx.user.id,
          ...(input?.serverId && { serverId: input.serverId })
        }
      });
    }),
});

export const appRouter = t.router({
  servers: serversRouter,
  logs: logsRouter,
});

export type AppRouter = typeof appRouter;
```

## API

### Servers API

- `list()` - Get server list
- `get({ id })` - Get a specific server
- `create(input)` - Create a server
- `update({ id, ...data })` - Update a server
- `delete({ id })` - Delete a server
- `start({ id })` - Start a server
- `stop({ id })` - Stop a server
- `getStatus({ id })` - Get server status

### Logs API

- `list(options?)` - Get log list
- `get({ id })` - Get a specific log entry
- `delete({ id })` - Delete a log entry
- `clear({ serverId? })` - Clear logs

### Auth API

- `getCurrentUser()` - Get the current user
- `getAppState()` - Get the application state
- `signIn(input)` - Sign in
- `signUp(input)` - Sign up
- `signOut()` - Sign out
- `requestPasswordReset(input)` - Request a password reset
- `resetPassword(input)` - Reset password
- `refreshToken()` - Refresh the token

### Workspaces API

- `list()` - Get workspace list
- `get({ id })` - Get a specific workspace
- `getCurrent()` - Get the current workspace
- `create(input)` - Create a workspace
- `update(input)` - Update a workspace
- `delete({ id })` - Delete a workspace
- `setActive({ id })` - Set the active workspace
- `connectRemote(input)` - Connect to a remote workspace
- `disconnect({ id })` - Disconnect from a workspace
- `validateRemoteConnection(input)` - Validate a remote connection

### Apps API

- `list()` - Get app list
- `get({ id })` - Get a specific app
- `create(input)` - Create an app
- `update(input)` - Update an app
- `delete({ id })` - Delete an app
- `listTokens({ clientId? })` - Get token list
- `generateToken(input)` - Generate a token
- `validateToken(input)` - Validate a token
- `revokeToken({ tokenId })` - Revoke a token
- `checkUpdates()` - Check for updates
- `updatePackage(input)` - Update a package

### Settings API

- `get()` - Get settings
- `update(input)` - Update settings
- `reset()` - Reset settings
- `getDisplayRules()` - Get display rules
- `createDisplayRule(input)` - Create a display rule
- `updateDisplayRule(input)` - Update a display rule
- `deleteDisplayRule({ id })` - Delete a display rule
- `reorderDisplayRules({ ruleIds })` - Reorder display rules
- `exportSettings()` - Export settings
- `importSettings(input)` - Import settings
