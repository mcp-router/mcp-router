# @mcp_router/remote-api-types

tRPCクライアントパッケージ for MCP Router Remote API

## 概要

このパッケージは、MCP RouterのリモートワークスペースAPIとの通信に使用するtRPCクライアントを提供します。

## 使用方法

### クライアント側（MCP Router）

```typescript
import { createRemoteAPIClient } from '@mcp_router/remote-api-types';

const client = createRemoteAPIClient({
  url: 'https://api.example.com',
  token: 'your-bearer-token',
});

// サーバー一覧を取得
const servers = await client.servers.list.query();

// サーバーを作成
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

### サーバー側（Remote API Server）

```typescript
import { initTRPC, TRPCError } from '@trpc/server';
import { 
  createServerSchema, 
  updateServerSchema,
  deleteServerSchema,
  logQueryOptionsSchema 
} from '@mcp_router/remote-api-types/schema';

const t = initTRPC.create();

// 認証ミドルウェア
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
      // サーバー一覧を返す
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
      // サーバーを作成
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
      // サーバーを起動
      await startMCPServer(input.id, ctx.user.id);
    }),
    
  stop: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ input, ctx }) => {
      // サーバーを停止
      await stopMCPServer(input.id, ctx.user.id);
    }),
});

const logsRouter = t.router({
  list: protectedProcedure
    .input(logQueryOptionsSchema.optional())
    .query(async ({ input, ctx }) => {
      // ログを返す
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

- `list()` - サーバー一覧を取得
- `get({ id })` - 特定のサーバーを取得
- `create(input)` - サーバーを作成
- `update({ id, ...data })` - サーバーを更新
- `delete({ id })` - サーバーを削除
- `start({ id })` - サーバーを起動
- `stop({ id })` - サーバーを停止
- `getStatus({ id })` - サーバーのステータスを取得

### Logs API

- `list(options?)` - ログ一覧を取得
- `get({ id })` - 特定のログを取得
- `delete({ id })` - ログを削除
- `clear({ serverId? })` - ログをクリア

### Auth API

- `getCurrentUser()` - 現在のユーザーを取得
- `getAppState()` - アプリケーションの状態を取得
- `signIn(input)` - サインイン
- `signUp(input)` - サインアップ
- `signOut()` - サインアウト
- `requestPasswordReset(input)` - パスワードリセットをリクエスト
- `resetPassword(input)` - パスワードをリセット
- `refreshToken()` - トークンをリフレッシュ

### Workspaces API

- `list()` - ワークスペース一覧を取得
- `get({ id })` - 特定のワークスペースを取得
- `getCurrent()` - 現在のワークスペースを取得
- `create(input)` - ワークスペースを作成
- `update(input)` - ワークスペースを更新
- `delete({ id })` - ワークスペースを削除
- `setActive({ id })` - アクティブなワークスペースを設定
- `connectRemote(input)` - リモートワークスペースに接続
- `disconnect({ id })` - ワークスペースから切断
- `validateRemoteConnection(input)` - リモート接続を検証

### Apps API

- `list()` - アプリ一覧を取得
- `get({ id })` - 特定のアプリを取得
- `create(input)` - アプリを作成
- `update(input)` - アプリを更新
- `delete({ id })` - アプリを削除
- `listTokens({ clientId? })` - トークン一覧を取得
- `generateToken(input)` - トークンを生成
- `validateToken(input)` - トークンを検証
- `revokeToken({ tokenId })` - トークンを無効化
- `checkUpdates()` - アップデートをチェック
- `updatePackage(input)` - パッケージを更新

### Settings API

- `get()` - 設定を取得
- `update(input)` - 設定を更新
- `reset()` - 設定をリセット
- `getDisplayRules()` - 表示ルールを取得
- `createDisplayRule(input)` - 表示ルールを作成
- `updateDisplayRule(input)` - 表示ルールを更新
- `deleteDisplayRule({ id })` - 表示ルールを削除
- `reorderDisplayRules({ ruleIds })` - 表示ルールを並び替え
- `exportSettings()` - 設定をエクスポート
- `importSettings(input)` - 設定をインポート
