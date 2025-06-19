import React, { forwardRef, useImperativeHandle, useState } from 'react';
import { TokenScope } from '../../../lib/types/token-types';
import { useTranslation } from 'react-i18next';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';

interface HowToUseProps {
  token?: string;
  scopes?: TokenScope[];
}

export interface HowToUseHandle {
  showDialog: () => void;
}

// English version component
const HowToUseEN: React.FC<HowToUseProps> = ({ token, scopes }) => {
  
  // Helper function to get scope label
  const getScopeLabel = (scope: TokenScope): string => {
    switch (scope) {
      case TokenScope.MCP_SERVER_MANAGEMENT:
        return "MCP Server Management";
      case TokenScope.LOG_MANAGEMENT:
        return "Log Management";
      case TokenScope.APPLICATION:
        return "Application";
      default:
        return scope;
    }
  };
  
  // Helper function to get scope description
  const getScopeDescription = (scope: TokenScope): string => {
    switch (scope) {
      case TokenScope.MCP_SERVER_MANAGEMENT:
        return "Allows managing MCP servers and connections";
      case TokenScope.LOG_MANAGEMENT:
        return "Allows access to logs and monitoring";
      case TokenScope.APPLICATION:
        return "Allows access to application features";
      default:
        return "";
    }
  };
  return (
    <>
      {/* CLI Usage */}
      <div className="mb-6">
        <h4 className="text-md font-semibold mb-3">1. Using with CLI</h4>
        <p className="mb-3 text-muted-foreground">
          {token 
            ? "Set the token as an environment variable and connect:" 
            : "Connect using mcpr-cli:"}
        </p>
        <div className="overflow-x-auto w-full">
          <pre className="bg-muted p-4 rounded-lg text-xs whitespace-pre min-w-min w-max">{
          token 
            ? `# Export token as environment variable
export MCPR_TOKEN="${token}"

npx -y mcpr-cli@latest connect`
            : `npx -y mcpr-cli@latest connect`
        }</pre>
        </div>
      </div>

      {/* Config File Usage */}
      <div className="mb-6">
        <h4 className="text-md font-semibold mb-3">2. Using in MCP Server Configuration</h4>
        <p className="mb-3 text-muted-foreground">Add to your MCP server configuration file:</p>
        <div className="overflow-x-auto w-full">
          <pre className="bg-muted p-4 rounded-lg text-xs whitespace-pre min-w-min w-max">{
          token 
            ? `{
  "mcpServers": {
    "mcp-router": {
      "command": "npx",
      "args": [
        "-y",
        "mcpr-cli@latest",
        "connect"
      ],
      "env": {
        "MCPR_TOKEN": "${token}"
      }
    }
  }
}`
            : `{
  "mcpServers": {
    "mcp-router": {
      "command": "npx",
      "args": [
        "-y",
        "mcpr-cli",
        "connect"
      ]
    }
  }
}`
        }</pre>
        </div>
      </div>

      {/* Token Scopes Info */}
      {token && scopes && scopes.length > 0 && (
        <div className="mb-6">
          <h4 className="text-md font-semibold mb-3">3. Token Scopes</h4>
          <p className="mb-3 text-muted-foreground">
            This token has the following permission scopes:
          </p>
          <ul className="list-disc list-inside space-y-2 bg-muted p-4 rounded-lg">
            {scopes.map(scope => (
              <li key={scope} className="ml-2">
                <span className="font-medium">{getScopeLabel(scope)}</span>
                <span className="text-sm text-muted-foreground ml-2">
                  — {getScopeDescription(scope)}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </>
  );
};

// Japanese version component
const HowToUseJA: React.FC<HowToUseProps> = ({ token, scopes }) => {
  
  // Helper function to get scope label
  const getScopeLabel = (scope: TokenScope): string => {
    switch (scope) {
      case TokenScope.MCP_SERVER_MANAGEMENT:
        return "MCPサーバー管理";
      case TokenScope.LOG_MANAGEMENT:
        return "ログ管理";
      case TokenScope.APPLICATION:
        return "アプリケーション";
      default:
        return scope;
    }
  };
  
  // Helper function to get scope description
  const getScopeDescription = (scope: TokenScope): string => {
    switch (scope) {
      case TokenScope.MCP_SERVER_MANAGEMENT:
        return "MCPサーバーと接続を管理する権限";
      case TokenScope.LOG_MANAGEMENT:
        return "ログとモニタリングにアクセスする権限";
      case TokenScope.APPLICATION:
        return "アプリケーション機能にアクセスする権限";
      default:
        return "";
    }
  };
  return (
    <>
      {/* CLI Usage */}
      <div className="mb-6">
        <h4 className="text-md font-semibold mb-3">1. CLIでの使用方法</h4>
        <p className="mb-3 text-muted-foreground">
          {token 
            ? "トークンを環境変数として設定して接続します：" 
            : "mcpr-cliを使って接続します："}
        </p>
        <div className="overflow-x-auto w-full">
          <pre className="bg-muted p-4 rounded-lg text-xs whitespace-pre min-w-min w-max">{
          token 
            ? `# トークンを環境変数としてエクスポート
export MCPR_TOKEN="${token}"

# mcpr-cliを使って接続
npx -y mcpr-cli connect`
            : `# mcpr-cliを使って接続
npx -y mcpr-cli connect`
        }</pre>
        </div>
      </div>

      {/* Config File Usage */}
      <div className="mb-6">
        <h4 className="text-md font-semibold mb-3">2. MCPサーバ設定での使用方法</h4>
        <p className="mb-3 text-muted-foreground">MCPサーバ設定ファイルに追加します：</p>
        <div className="overflow-x-auto w-full">
          <pre className="bg-muted p-4 rounded-lg text-xs whitespace-pre min-w-min w-max">{
          token 
            ? `{
  "mcpServers": {
    "mcp-router": {
      "command": "npx",
      "args": [
        "-y",
        "mcpr-cli@latest",
        "connect"
      ],
      "env": {
        "MCPR_TOKEN": "${token}"
      }
    }
  }
}`
            : `{
  "mcpServers": {
    "mcp-router": {
      "command": "npx",
      "args": [
        "-y",
        "mcpr-cli",
        "connect"
      ]
    }
  }
}`
        }</pre>
        </div>
      </div>

      {/* Token Scopes Info */}
      {token && scopes && scopes.length > 0 && (
        <div className="mb-6">
          <h4 className="text-md font-semibold mb-3">3. トークンスコープ</h4>
          <p className="mb-3 text-muted-foreground">
            このトークンには次の権限スコープがあります：
          </p>
          <ul className="list-disc list-inside space-y-2 bg-muted p-4 rounded-lg">
            {scopes.map(scope => (
              <li key={scope} className="ml-2">
                <span className="font-medium">{getScopeLabel(scope)}</span>
                <span className="text-sm text-muted-foreground ml-2">
                  — {getScopeDescription(scope)}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </>
  );
};

// Main component that switches based on language
const HowToUse = forwardRef<HowToUseHandle, HowToUseProps>(({ token, scopes }, ref) => {
  const { t, i18n } = useTranslation();
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  useImperativeHandle(ref, () => ({
    showDialog: () => setIsDialogOpen(true)
  }));

  const content = i18n.language === 'ja' 
    ? <HowToUseJA token={token} scopes={scopes} />
    : <HowToUseEN token={token} scopes={scopes} />;

  return (
    <>
      {/* Inline display when used directly */}
      {!isDialogOpen && content}
      
      {/* Dialog version */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="w-[100vw] mx-auto flex flex-col">
          <DialogHeader>
            <DialogTitle>{t('mcpApps.howToUse')}</DialogTitle>
          </DialogHeader>
          <ScrollArea className="max-h-[70vh] overflow-auto">
            {content}
          </ScrollArea>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
              {t('common.close')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
});

HowToUse.displayName = 'HowToUse';

export default HowToUse;
