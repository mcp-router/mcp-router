# MCP Router アプリケーション リファクタリング計画 (2025年版)

## 📖 目次

1. [概要](#概要)
2. [品質評価結果に基づく現状分析](#品質評価結果に基づく現状分析)
3. [優先度付きリファクタリング戦略](#優先度付きリファクタリング戦略)
4. [Critical Phase: セキュリティと品質保証](#critical-phase-セキュリティと品質保証)
5. [Phase 1: テスト基盤構築](#phase-1-テスト基盤構築)
6. [Phase 2: セキュリティ強化](#phase-2-セキュリティ強化)
7. [Phase 3: エラーハンドリング標準化](#phase-3-エラーハンドリング標準化)
8. [Phase 4: コンポーネント最適化と設定整理](#phase-4-コンポーネント最適化と設定整理)
9. [成功指標](#成功指標)
10. [リスク管理](#リスク管理)

## 概要

**コードベース品質評価結果: 7.5/10**

MCP Router は Model Context Protocol サーバーを管理するElectronアプリケーションです。包括的な品質評価の結果、既存のアーキテクチャは予想以上に良好な状態ですが、**致命的な課題**が特定されました。

### 🚨 **Critical Issues (即座に対応が必要)**

1. **テストカバレッジ: 0%** - 単体・統合・E2Eテストが存在しない
2. **セキュリティ脆弱性** - 入力検証不足、IPCパラメータ検証なし
3. **エラーハンドリング不統一** - 構造化されたログ記録不足

### 🎯 **更新されたリファクタリング目標**

1. **品質保証の確立**: 包括的なテスト戦略の実装
2. **セキュリティ強化**: 入力検証とセキュリティ監査の実施
3. **エラーハンドリング標準化**: 統一されたエラー処理システム
4. **保守性向上**: 設定値一元化とコンポーネント最適化

## 品質評価結果に基づく現状分析

### ✅ **優秀な実装領域 (8/10 以上)**

| 領域 | 評価 | 状況 |
|------|------|------|
| **アーキテクチャ設計** | 8/10 | レイヤー分離とモジュール構造が良好 |
| **TypeScript活用** | 8.5/10 | 型安全性が高く、適切なインターフェース設計 |
| **データベース設計** | 8/10 | Repository パターンとマイグレーション システム |
| **IPC通信パターン** | 8/10 | 一貫したインターフェースと命名規則 |
| **UI/UXアーキテクチャ** | 7.5/10 | Radix UI + Tailwind、Zustand状態管理 |

### 🔴 **Critical Issues (即座に対応が必要)**

| 課題 | 評価 | 現在の状況 | 影響度 |
|------|------|------------|--------|
| **テストカバレッジ** | 2/10 | 単体・統合・E2Eテストが存在しない | 🔴 High |
| **セキュリティ** | 7/10 | 入力検証不足、IPCパラメータ検証なし | 🔴 High |
| **エラーハンドリング** | 6/10 | 一貫性に欠け、構造化ログ不足 | 🟡 Medium |

### 🟡 **改善が必要な領域**

| ファイル/領域 | 行数 | 現在の問題 | 優先度 |
|-------------|------|-----------|--------|
| `src/main.ts` | 966行 | 設定値散在、IPCハンドラー集中 | 🟡 Medium |
| `src/components/Home.tsx` | 307行 | UI・検索・管理ロジック混在 | 🟡 Medium |
| パフォーマンス | - | 2秒ポーリング、メモリリーク懸念 | 🟡 Medium |

## 優先度付きリファクタリング戦略

### 🎯 **Critical Path (品質評価に基づく優先順位)**

| フェーズ | 重要度 | 期間 | 効果 | 現在の評価 |
|---------|--------|------|------|----------|
| Critical: セキュリティ・品質保証 | 🔴 Critical | 1週間 | 本番環境対応可能化 | 緊急対応必須 |
| Phase 1: テスト基盤構築 | 🔴 High | 2週間 | 品質保証・継続開発基盤 | 最重要課題 |
| Phase 2: セキュリティ強化 | 🔴 High | 1週間 | セキュリティ脆弱性解消 | 重要課題 |
| Phase 3: エラーハンドリング標準化 | 🟡 Medium | 1週間 | 保守性・デバッグ性向上 | 標準化課題 |
| Phase 4: コンポーネント最適化 | 🟡 Medium | 2週間 | 開発効率・ユーザビリティ | 漸進的改善 |

## Critical Phase: セキュリティと品質保証

### 🚨 **緊急対応項目 (最優先)**

#### 1. 入力検証の実装

**`src/lib/validation/input-validator.ts`**
```typescript
import { z } from 'zod';

// MCPサーバー設定の検証スキーマ
export const MCPServerConfigSchema = z.object({
  name: z.string().min(1, 'Server name is required').max(100, 'Server name too long'),
  description: z.string().optional(),
  serverType: z.enum(['local', 'remote', 'remote-streamable']),
  command: z.string().min(1).optional(),
  args: z.array(z.string()).optional(),
  env: z.record(z.string()).optional(),
  url: z.string().url().optional(),
});

// エージェント設定の検証スキーマ
export const AgentConfigSchema = z.object({
  name: z.string().min(1, 'Agent name is required').max(100, 'Agent name too long'),
  description: z.string().optional(),
  model: z.string().min(1, 'Model is required'),
  tools: z.array(z.string()).optional(),
  systemPrompt: z.string().optional(),
});

// IPCパラメータの検証
export function validateIpcParams<T>(schema: z.ZodSchema<T>, data: unknown): T {
  try {
    return schema.parse(data);
  } catch (error) {
    if (error instanceof z.ZodError) {
      throw new Error(`Validation failed: ${error.errors.map(e => e.message).join(', ')}`);
    }
    throw new Error('Invalid input data');
  }
}
```

**`src/main/utils/ipc-validator.ts`**
```typescript
import { ipcMain, IpcMainInvokeEvent } from 'electron';
import { z } from 'zod';
import { validateIpcParams } from '../../lib/validation/input-validator';

// 安全なIPCハンドラーラッパー
export function createSecureIpcHandler<TInput, TOutput>(
  channel: string,
  schema: z.ZodSchema<TInput>,
  handler: (event: IpcMainInvokeEvent, validatedInput: TInput) => Promise<TOutput>
) {
  return ipcMain.handle(channel, async (event, ...args) => {
    try {
      // 入力検証
      const validatedInput = validateIpcParams(schema, args[0]);
      
      // ハンドラー実行
      return await handler(event, validatedInput);
    } catch (error) {
      console.error(`IPC Error [${channel}]:`, error);
      throw error;
    }
  });
}

// 使用例
createSecureIpcHandler(
  'mcp:add',
  MCPServerConfigSchema,
  async (event, serverConfig) => {
    // 検証済みのserverConfigを使用
    return mcpServerManager.addServer(serverConfig);
  }
);
```

#### 2. セキュリティ監査の実装

**`src/lib/security/security-audit.ts`**
```typescript
import crypto from 'crypto';

export class SecurityAudit {
  private static readonly SENSITIVE_PATTERNS = [
    /api[_-]?key/i,
    /secret/i,
    /token/i,
    /password/i,
    /private[_-]?key/i,
  ];

  static sanitizeForLogging(data: any): any {
    if (typeof data !== 'object' || data === null) {
      return data;
    }

    const sanitized = { ...data };
    
    for (const [key, value] of Object.entries(sanitized)) {
      if (this.isSensitiveField(key)) {
        sanitized[key] = this.maskSensitiveValue(value);
      } else if (typeof value === 'object') {
        sanitized[key] = this.sanitizeForLogging(value);
      }
    }

    return sanitized;
  }

  private static isSensitiveField(fieldName: string): boolean {
    return this.SENSITIVE_PATTERNS.some(pattern => pattern.test(fieldName));
  }

  private static maskSensitiveValue(value: any): string {
    if (typeof value !== 'string') {
      return '[REDACTED]';
    }
    if (value.length <= 4) {
      return '*'.repeat(value.length);
    }
    return value.substring(0, 2) + '*'.repeat(value.length - 4) + value.substring(value.length - 2);
  }
}
```

#### 3. 構造化ログシステム

**`src/lib/logging/structured-logger.ts`**
```typescript
import winston from 'winston';
import { SecurityAudit } from '../security/security-audit';

interface LogContext {
  userId?: string;
  sessionId?: string;
  operation?: string;
  component?: string;
  timestamp?: Date;
}

export class StructuredLogger {
  private logger: winston.Logger;

  constructor() {
    this.logger = winston.createLogger({
      level: process.env.NODE_ENV === 'development' ? 'debug' : 'info',
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.errors({ stack: true }),
        winston.format.json(),
        winston.format.printf(({ timestamp, level, message, ...meta }) => {
          return JSON.stringify({
            timestamp,
            level,
            message,
            ...SecurityAudit.sanitizeForLogging(meta)
          });
        })
      ),
      transports: [
        new winston.transports.File({ 
          filename: 'logs/error.log', 
          level: 'error',
          maxsize: 10 * 1024 * 1024, // 10MB
          maxFiles: 5
        }),
        new winston.transports.File({ 
          filename: 'logs/combined.log',
          maxsize: 10 * 1024 * 1024, // 10MB
          maxFiles: 5
        }),
        new winston.transports.Console({
          format: winston.format.combine(
            winston.format.colorize(),
            winston.format.simple()
          )
        })
      ]
    });
  }

  info(message: string, context?: LogContext) {
    this.logger.info(message, context);
  }

  error(message: string, error?: Error, context?: LogContext) {
    this.logger.error(message, { 
      error: error?.message,
      stack: error?.stack,
      ...context 
    });
  }

  warn(message: string, context?: LogContext) {
    this.logger.warn(message, context);
  }

  debug(message: string, context?: LogContext) {
    this.logger.debug(message, context);
  }
}

export const logger = new StructuredLogger();
```

## Phase 1: テスト基盤構築

### 🎯 目標
品質保証の確立とテストカバレッジ80%以上の達成

#### 1.1 テスト環境のセットアップ

**`package.json` テスト関連の追加**
```json
{
  "devDependencies": {
    "vitest": "^1.0.0",
    "@testing-library/react": "^14.0.0",
    "@testing-library/jest-dom": "^6.0.0",
    "@testing-library/user-event": "^14.0.0",
    "happy-dom": "^12.0.0",
    "msw": "^2.0.0",
    "@vitest/coverage-v8": "^1.0.0",
    "@vitest/ui": "^1.0.0"
  },
  "scripts": {
    "test": "vitest",
    "test:ui": "vitest --ui",
    "test:coverage": "vitest --coverage",
    "test:watch": "vitest --watch",
    "test:integration": "vitest run --config vitest.integration.config.ts"
  }
}
```

**`vitest.config.ts`**
```typescript
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'happy-dom',
    setupFiles: ['./src/test/setup.ts'],
    globals: true,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      thresholds: {
        global: {
          branches: 80,
          functions: 80,
          lines: 80,
          statements: 80
        }
      },
      exclude: [
        'node_modules/',
        'src/test/',
        '**/*.test.{ts,tsx}',
        '**/*.config.{ts,js}',
        'src/main.ts' // Electronメインプロセスは除外
      ]
    }
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src')
    }
  }
});
```

#### 1.2 モックサービスとテストユーティリティ

**`src/test/mocks/electron-api.ts`**
```typescript
import { vi } from 'vitest';

export const mockElectronAPI = {
  // MCP Server API
  listMcpServers: vi.fn(),
  startMcpServer: vi.fn(),
  stopMcpServer: vi.fn(),
  addMcpServer: vi.fn(),
  removeMcpServer: vi.fn(),
  
  // Agent API
  listAgents: vi.fn(),
  createAgent: vi.fn(),
  updateAgent: vi.fn(),
  deleteAgent: vi.fn(),
  
  // Auth API
  login: vi.fn(),
  logout: vi.fn(),
  getAuthStatus: vi.fn(),
};

// グローバルモック設定
Object.defineProperty(window, 'electronAPI', {
  value: mockElectronAPI,
  writable: true
});
```

**`src/test/utils/test-utils.tsx`**
```typescript
import React from 'react';
import { render, RenderOptions } from '@testing-library/react';
import { HashRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

// テスト用プロバイダー
const TestProviders = ({ children }: { children: React.ReactNode }) => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false }
    }
  });

  return (
    <QueryClientProvider client={queryClient}>
      <HashRouter>
        {children}
      </HashRouter>
    </QueryClientProvider>
  );
};

// カスタムレンダー関数
export const renderWithProviders = (
  ui: React.ReactElement,
  options?: Omit<RenderOptions, 'wrapper'>
) => {
  return render(ui, { wrapper: TestProviders, ...options });
};

// よく使用するマッチャー
export * from '@testing-library/react';
export { renderWithProviders as render };
```

#### 1.3 サービス層の単体テスト

**`src/lib/services/__tests__/server-service.test.ts`**
```typescript
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ServerService } from '../server-service';
import { mockElectronAPI } from '../../../test/mocks/electron-api';

describe('ServerService', () => {
  let serverService: ServerService;

  beforeEach(() => {
    vi.clearAllMocks();
    serverService = ServerService.getInstance();
  });

  describe('getAll', () => {
    it('should return list of servers', async () => {
      const mockServers = [
        { id: '1', name: 'Test Server 1', status: 'stopped' },
        { id: '2', name: 'Test Server 2', status: 'running' }
      ];
      
      mockElectronAPI.listMcpServers.mockResolvedValue(mockServers);

      const result = await serverService.getAll();

      expect(result).toEqual(mockServers);
      expect(mockElectronAPI.listMcpServers).toHaveBeenCalledOnce();
    });

    it('should handle errors gracefully', async () => {
      const error = new Error('Database connection failed');
      mockElectronAPI.listMcpServers.mockRejectedValue(error);

      await expect(serverService.getAll()).rejects.toThrow('Database connection failed');
    });
  });

  describe('startServer', () => {
    it('should start server successfully', async () => {
      mockElectronAPI.startMcpServer.mockResolvedValue(true);

      const result = await serverService.startServer('test-id');

      expect(result).toBe(true);
      expect(mockElectronAPI.startMcpServer).toHaveBeenCalledWith('test-id');
    });
  });
});
```

#### 1.4 Reactコンポーネントのテスト

**`src/components/__tests__/Home.test.tsx`**
```typescript
import { describe, it, expect, vi } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { render } from '../../test/utils/test-utils';
import { Home } from '../Home';
import { mockElectronAPI } from '../../test/mocks/electron-api';

describe('Home Component', () => {
  it('should display list of servers', async () => {
    const mockServers = [
      { id: '1', name: 'Test Server 1', status: 'stopped' },
      { id: '2', name: 'Test Server 2', status: 'running' }
    ];
    
    mockElectronAPI.listMcpServers.mockResolvedValue(mockServers);

    render(<Home />);

    await waitFor(() => {
      expect(screen.getByText('Test Server 1')).toBeInTheDocument();
      expect(screen.getByText('Test Server 2')).toBeInTheDocument();
    });
  });

  it('should filter servers by search term', async () => {
    const mockServers = [
      { id: '1', name: 'Alpha Server', status: 'stopped' },
      { id: '2', name: 'Beta Server', status: 'running' }
    ];
    
    mockElectronAPI.listMcpServers.mockResolvedValue(mockServers);

    const user = userEvent.setup();
    render(<Home />);

    await waitFor(() => {
      expect(screen.getByText('Alpha Server')).toBeInTheDocument();
    });

    const searchInput = screen.getByPlaceholderText(/search/i);
    await user.type(searchInput, 'Alpha');

    await waitFor(() => {
      expect(screen.getByText('Alpha Server')).toBeInTheDocument();
      expect(screen.queryByText('Beta Server')).not.toBeInTheDocument();
    });
  });
});
```

## Phase 2: セキュリティ強化

### 🎯 目標
セキュリティ脆弱性の解消と安全な運用環境の確立

#### 2.1 CSP (Content Security Policy) の強化

**`src/main/security/csp-config.ts`**
```typescript
export const CSP_POLICIES = {
  development: [
    "default-src 'self' 'unsafe-inline' http://localhost:* ws://localhost:*",
    "script-src 'self' 'unsafe-eval' 'unsafe-inline'",
    "connect-src 'self' http://localhost:* ws://localhost:* https://mcp-router.net",
    "img-src 'self' data:",
    "style-src 'self' 'unsafe-inline'"
  ].join('; '),
  
  production: [
    "default-src 'self'",
    "script-src 'self'",
    "connect-src 'self' https://mcp-router.net",
    "img-src 'self' data:",
    "style-src 'self' 'unsafe-inline'"
  ].join('; ')
};

export function applyCspPolicy(isDev: boolean): void {
  const { session } = require('electron');
  
  session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
    callback({
      responseHeaders: {
        ...details.responseHeaders,
        'Content-Security-Policy': [isDev ? CSP_POLICIES.development : CSP_POLICIES.production],
        'X-Content-Type-Options': ['nosniff'],
        'X-Frame-Options': ['DENY'],
        'X-XSS-Protection': ['1; mode=block']
      }
    });
  });
}
```

#### 2.2 安全なIPCハンドリング

**`src/main/security/secure-ipc.ts`**
```typescript
import { ipcMain, IpcMainInvokeEvent } from 'electron';
import { z } from 'zod';
import { logger } from '../../lib/logging/structured-logger';

interface IpcContext {
  userId?: string;
  sessionId?: string;
  timestamp: Date;
}

export class SecureIpcManager {
  private static registeredHandlers = new Set<string>();

  static registerSecureHandler<TInput, TOutput>(
    channel: string,
    schema: z.ZodSchema<TInput>,
    handler: (event: IpcMainInvokeEvent, input: TInput, context: IpcContext) => Promise<TOutput>,
    options: {
      requireAuth?: boolean;
      rateLimit?: { maxCalls: number; windowMs: number };
    } = {}
  ) {
    if (this.registeredHandlers.has(channel)) {
      throw new Error(`Handler for channel ${channel} already registered`);
    }

    this.registeredHandlers.add(channel);

    ipcMain.handle(channel, async (event, ...args) => {
      const context: IpcContext = {
        timestamp: new Date()
      };

      try {
        // ログ記録
        logger.info(`IPC Request: ${channel}`, {
          component: 'IPC',
          operation: channel,
          ...context
        });

        // 認証チェック
        if (options.requireAuth) {
          // 認証ロジックの実装
        }

        // レート制限チェック
        if (options.rateLimit) {
          // レート制限ロジックの実装
        }

        // 入力検証
        const validatedInput = schema.parse(args[0]);

        // ハンドラー実行
        const result = await handler(event, validatedInput, context);

        logger.info(`IPC Response: ${channel}`, {
          component: 'IPC',
          operation: channel,
          success: true,
          ...context
        });

        return result;
      } catch (error) {
        logger.error(`IPC Error: ${channel}`, error, {
          component: 'IPC',
          operation: channel,
          ...context
        });

        // セキュリティを考慮したエラーレスポンス
        if (error instanceof z.ZodError) {
          throw new Error('Invalid input parameters');
        }
        
        throw new Error('Operation failed');
      }
    });
  }
}
```

## Phase 3: エラーハンドリング標準化

### 🎯 目標
統一されたエラー処理システムの確立

#### 3.1 統一エラー型の定義

**`src/lib/errors/app-errors.ts`**
```typescript
export enum ErrorCode {
  // 一般的エラー
  UNKNOWN_ERROR = 'UNKNOWN_ERROR',
  VALIDATION_ERROR = 'VALIDATION_ERROR',
  NETWORK_ERROR = 'NETWORK_ERROR',
  PERMISSION_DENIED = 'PERMISSION_DENIED',
  
  // サーバー関連
  SERVER_NOT_FOUND = 'SERVER_NOT_FOUND',
  SERVER_START_FAILED = 'SERVER_START_FAILED',
  SERVER_STOP_FAILED = 'SERVER_STOP_FAILED',
  SERVER_CONFIG_INVALID = 'SERVER_CONFIG_INVALID',
  
  // エージェント関連
  AGENT_NOT_FOUND = 'AGENT_NOT_FOUND',
  AGENT_CREATION_FAILED = 'AGENT_CREATION_FAILED',
  AGENT_DEPLOY_FAILED = 'AGENT_DEPLOY_FAILED',
  
  // データベース関連
  DATABASE_ERROR = 'DATABASE_ERROR',
  TRANSACTION_FAILED = 'TRANSACTION_FAILED',
}

export class AppError extends Error {
  constructor(
    public readonly code: ErrorCode,
    message: string,
    public readonly cause?: Error,
    public readonly context?: Record<string, any>
  ) {
    super(message);
    this.name = 'AppError';
  }

  static create(code: ErrorCode, message: string, cause?: Error, context?: Record<string, any>): AppError {
    return new AppError(code, message, cause, context);
  }

  toJSON() {
    return {
      name: this.name,
      code: this.code,
      message: this.message,
      context: this.context,
      cause: this.cause?.message,
      stack: this.stack
    };
  }
}

export type Result<T, E = AppError> = 
  | { success: true; data: T }
  | { success: false; error: E };
```

#### 3.2 エラーハンドリングユーティリティ

**`src/lib/errors/error-handler.ts`**
```typescript
import { ErrorCode, AppError, Result } from './app-errors';
import { logger } from '../logging/structured-logger';

export class ErrorHandler {
  static wrap<T>(
    operation: () => Promise<T>,
    errorCode: ErrorCode,
    context?: Record<string, any>
  ): Promise<Result<T>> {
    return operation()
      .then(data => ({ success: true, data } as const))
      .catch(error => {
        const appError = error instanceof AppError 
          ? error
          : AppError.create(errorCode, error.message, error, context);
        
        logger.error(`Operation failed: ${errorCode}`, appError, context);
        
        return { success: false, error: appError } as const;
      });
  }

  static handleApiError(error: unknown, defaultCode = ErrorCode.UNKNOWN_ERROR): AppError {
    if (error instanceof AppError) {
      return error;
    }
    
    if (error instanceof Error) {
      return AppError.create(defaultCode, error.message, error);
    }
    
    return AppError.create(defaultCode, 'An unknown error occurred');
  }

  static async handleAsyncOperation<T>(
    operation: () => Promise<T>,
    errorCode: ErrorCode,
    context?: Record<string, any>
  ): Promise<T> {
    try {
      return await operation();
    } catch (error) {
      const appError = this.handleApiError(error, errorCode);
      if (context) {
        appError.context = { ...appError.context, ...context };
      }
      throw appError;
    }
  }
}
```

## Phase 4: コンポーネント最適化と設定整理

### 🎯 目標
保守性の向上と開発効率の改善

#### 4.1 設定値の一元化

**`src/config/app-config.ts`**
```typescript
export const APP_CONFIG = {
  // アプリケーション基本設定
  APP_NAME: 'MCP Router',
  VERSION: process.env.npm_package_version || '1.0.0',
  
  // URLs
  BASE_URL: process.env.BASE_URL || 'https://mcp-router.net/',
  get API_BASE_URL() { return `${this.BASE_URL}api`; },
  
  // サーバー設定
  HTTP_SERVER_PORT: parseInt(process.env.HTTP_SERVER_PORT || '3282'),
  
  // タイムアウト・インターバル設定
  TRAY_UPDATE_INTERVAL: 5000,
  AUTO_UPDATE_INTERVAL: '1 hour',
  STARTUP_TIMEOUT: 10000,
  CONNECTION_RETRY_DELAY: 2000,
  
  // 識別子
  AGGREGATOR_SERVER_ID: 'mcp-router-aggregator',
  AGGREGATOR_SERVER_NAME: 'MCP Router Aggregator',
  
  // ファイルパス
  CONFIG_FILE_NAME: 'mcp-router-config.json',
  LOG_FILE_NAME: 'mcp-router.log',
  
  // 開発環境設定
  IS_DEV: process.env.NODE_ENV === 'development',
  IS_PROD: process.env.NODE_ENV === 'production',
} as const;

export type AppConfig = typeof APP_CONFIG;
```

#### 4.2 Home.tsx の最適化

**新しいコンポーネント構造:**
```
src/components/server/
├── ServerList.tsx              # メインコンテナ (100行以下)
├── components/
│   ├── ServerGrid.tsx          # サーバーグリッド表示
│   ├── ServerCard.tsx          # 個別サーバーカード
│   ├── ServerFilters.tsx       # フィルターコントロール
│   └── ServerActions.tsx       # アクションボタン
├── hooks/
│   ├── useServerList.ts        # サーバー一覧状態管理
│   ├── useServerSearch.ts      # 検索ロジック
│   └── useServerActions.ts     # サーバー操作
└── types/
    └── server-list-types.ts    # コンポーネント固有の型
```

**`src/components/server/hooks/useServerList.ts`**
```typescript
import { useState, useEffect, useMemo } from 'react';
import { useServerStore } from '../../../lib/stores';
import { useDebounce } from '../../hooks/useDebounce';
import type { MCPServer, ServerStatus } from '../../../lib/types';

interface UseServerListOptions {
  initialSearchTerm?: string;
  initialStatusFilter?: ServerStatus | 'all';
}

export function useServerList(options: UseServerListOptions = {}) {
  const { servers, isLoading, error, refreshServers } = useServerStore();
  
  const [searchTerm, setSearchTerm] = useState(options.initialSearchTerm || '');
  const [statusFilter, setStatusFilter] = useState<ServerStatus | 'all'>(
    options.initialStatusFilter || 'all'
  );
  
  const debouncedSearchTerm = useDebounce(searchTerm, 300);
  
  const filteredServers = useMemo(() => {
    return servers.filter(server => {
      const matchesSearch = !debouncedSearchTerm || 
        server.name.toLowerCase().includes(debouncedSearchTerm.toLowerCase()) ||
        server.description?.toLowerCase().includes(debouncedSearchTerm.toLowerCase());
      
      const matchesStatus = statusFilter === 'all' || server.status === statusFilter;
      
      return matchesSearch && matchesStatus;
    });
  }, [servers, debouncedSearchTerm, statusFilter]);
  
  return {
    // 状態
    servers: filteredServers,
    isLoading,
    error,
    searchTerm,
    statusFilter,
    
    // アクション
    setSearchTerm,
    setStatusFilter,
    refreshServers,
  };
}
```

## 成功指標

### 📊 **Critical Metrics (品質評価に基づく)**

| 指標 | 現在 | 目標 | 測定方法 |
|------|------|------|----------|
| **テストカバレッジ** | 0% | 80%以上 | Vitest coverage |
| **セキュリティスコア** | 7/10 | 9/10以上 | セキュリティ監査 |
| **エラーハンドリング** | 6/10 | 8/10以上 | コードレビュー |
| main.tsの行数 | 966行 | 200行以下 | 行数カウント |
| 最大コンポーネント行数 | 307行 | 150行以下 | ファイル行数分析 |

### 📈 **Quality Gates**

#### **Phase 1 完了基準**
- [ ] テストカバレッジ 80% 以上
- [ ] 全主要機能の単体テスト完了
- [ ] CI/CDパイプライン動作確認

#### **Phase 2 完了基準**
- [ ] セキュリティ脆弱性スキャン合格
- [ ] IPCパラメータ検証 100% 実装
- [ ] セキュリティ監査ログ動作確認

#### **Phase 3 完了基準**
- [ ] 統一エラーハンドリング 100% 適用
- [ ] 構造化ログ全体適用
- [ ] エラー追跡システム動作確認

## リスク管理

### 🚨 **Critical Risks**

1. **セキュリティ脆弱性の見落とし**
   - **対策**: 段階的なセキュリティ監査とペネトレーションテスト
   - **回避策**: 外部セキュリティ専門家によるレビュー

2. **テスト実装の遅延**
   - **対策**: 並行開発とペアプログラミング
   - **回避策**: 最重要機能の優先実装

3. **既存機能の破綻**
   - **対策**: 各段階での継続的統合テスト
   - **回避策**: 機能フラグによる段階的切り替え

### 🛡 **Mitigation Strategies**

1. **品質保証プロセス**
   - コードレビュー必須 (2名以上)
   - 自動テスト実行 (PR時)
   - セキュリティスキャン (日次)

2. **ロールバック計画**
   - 各フェーズでのタグ作成
   - データベーススキーマバージョニング
   - 設定の後方互換性維持

---

## 📝 まとめ

### 🚨 **Critical Path の重要性**

この更新されたリファクタリング計画は、**品質評価結果に基づく Critical Issues への対応**を最優先に設計されています。

### 🎯 **重要な変更点**

1. **セキュリティファースト**: 入力検証とセキュリティ強化を最優先
2. **テスト主導**: 品質保証を基盤とした開発プロセス
3. **段階的改善**: 既存の良好なアーキテクチャを活用
4. **現実的スケジュール**: 7週間で実行可能な計画

### 💡 **期待される効果**

- **短期**: セキュリティ脆弱性の解消と基本的品質保証
- **中期**: 包括的なテストカバレッジと開発効率向上
- **長期**: 持続可能で拡張性の高いアプリケーション基盤

この計画により、MCP Routerは**本番環境に適した高品質なアプリケーション**へと確実に進化します。