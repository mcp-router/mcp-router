import React, { forwardRef, useImperativeHandle, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@mcp_router/ui";
import { Button } from "@mcp_router/ui";
import { ScrollArea } from "@mcp_router/ui";

interface HowToUseProps {
  token?: string;
}

export interface HowToUseHandle {
  showDialog: () => void;
}

// English version component
const HowToUseEN: React.FC<HowToUseProps> = ({ token }) => {
  return (
    <>
      {/* CLI Usage */}
      <div className="mb-6">
        <h4 className="text-md font-semibold mb-3">1. Using with CLI</h4>
        <p className="mb-3 text-muted-foreground">
          {token
            ? "Connect to the MCP Router server:"
            : "Connect using @mcp_router/cli:"}
        </p>
        <div className="overflow-x-auto w-full">
          <pre className="bg-muted p-4 rounded-lg text-xs whitespace-pre min-w-min w-max">
            {token
              ? `# Export token as environment variable
export MCPR_TOKEN="${token}"

npx -y @mcp_router/cli@latest connect`
              : `npx -y @mcp_router/cli@latest connect`}
          </pre>
        </div>
      </div>

      {/* Config File Usage */}
      <div className="mb-6">
        <h4 className="text-md font-semibold mb-3">
          2. Using in MCP Server Configuration
        </h4>
        <p className="mb-3 text-muted-foreground">
          Add to your MCP server configuration file:
        </p>
        <div className="overflow-x-auto w-full">
          <pre className="bg-muted p-4 rounded-lg text-xs whitespace-pre min-w-min w-max">
            {`{
  "mcpServers": {
    "mcp-router": {
      "command": "npx",
      "args": [
        "-y",
        "@mcp_router/cli@latest",
        "connect"
      ],
      "env": {
        "MCPR_TOKEN": "${token}"
      }
    }
  }
}`}
          </pre>
        </div>
      </div>

      {/* Project Selection */}
      <div className="mb-6">
        <h4 className="text-md font-semibold mb-3">
          3. Specify a project (optional)
        </h4>
        <p className="mb-3 text-muted-foreground">
          Add the project name when you want to scope access to a specific
          project:
        </p>
        <div className="overflow-x-auto w-full">
          <pre className="bg-muted p-4 rounded-lg text-xs whitespace-pre min-w-min w-max">
            {token
              ? `# After exporting MCPR_TOKEN
npx -y @mcp_router/cli@latest connect --project "project-name"`
              : `npx -y @mcp_router/cli@latest connect --project "project-name"`}
          </pre>
        </div>
        <p className="mb-3 text-muted-foreground">
          Include the same arguments in the MCP server configuration if you
          launch it from a config file:
        </p>
        <div className="overflow-x-auto w-full">
          <pre className="bg-muted p-4 rounded-lg text-xs whitespace-pre min-w-min w-max">
            {`{
  "mcpServers": {
    "mcp-router": {
      "command": "npx",
      "args": [
        "-y",
        "@mcp_router/cli@latest",
        "connect",
        "--project",
        "project-name"
      ],
      "env": {
        "MCPR_TOKEN": "${token}"
      }
    }
  }
}`}
          </pre>
        </div>
      </div>
    </>
  );
};

// Japanese version component
const HowToUseJA: React.FC<HowToUseProps> = ({ token }) => {
  return (
    <>
      {/* CLI Usage */}
      <div className="mb-6">
        <h4 className="text-md font-semibold mb-3">1. CLIでの使用方法</h4>
        <p className="mb-3 text-muted-foreground">
          {token
            ? "トークンを環境変数として設定して接続します："
            : "@mcp_router/cliを使って接続します："}
        </p>
        <div className="overflow-x-auto w-full">
          <pre className="bg-muted p-4 rounded-lg text-xs whitespace-pre min-w-min w-max">
            {token
              ? `# トークンを環境変数としてエクスポート
export MCPR_TOKEN="${token}"

# mcpr-cliを使って接続
npx -y @mcp_router/cli@latest connect`
              : `# mcpr-cliを使って接続
npx -y @mcp_router/cli@latest connect`}
          </pre>
        </div>
      </div>

      {/* Config File Usage */}
      <div className="mb-6">
        <h4 className="text-md font-semibold mb-3">
          2. MCPサーバ設定での使用方法
        </h4>
        <p className="mb-3 text-muted-foreground">
          MCPサーバ設定ファイルに追加します：
        </p>
        <div className="overflow-x-auto w-full">
          <pre className="bg-muted p-4 rounded-lg text-xs whitespace-pre min-w-min w-max">
            {`{
  "mcpServers": {
    "mcp-router": {
      "command": "npx",
      "args": [
        "-y",
        "@mcp_router/cli@latest",
        "connect"
      ],
      "env": {
        "MCPR_TOKEN": "${token}"
      }
    }
  }
}`}
          </pre>
        </div>
      </div>

      {/* Project Selection */}
      <div className="mb-6">
        <h4 className="text-md font-semibold mb-3">
          3. プロジェクトを指定する（任意）
        </h4>
        <p className="mb-3 text-muted-foreground">
          特定のプロジェクトにアクセスを限定したい場合は、プロジェクト名を指定します：
        </p>
        <div className="overflow-x-auto w-full">
          <pre className="bg-muted p-4 rounded-lg text-xs whitespace-pre min-w-min w-max">
            {token
              ? `# MCPR_TOKENを設定済みの場合
npx -y @mcp_router/cli@latest connect --project "project-name"`
              : `npx -y @mcp_router/cli@latest connect --project "project-name"`}
          </pre>
        </div>
        <p className="mb-3 text-muted-foreground">
          MCPサーバ設定ファイルから起動する際も同様に引数を追加できます：
        </p>
        <div className="overflow-x-auto w-full">
          <pre className="bg-muted p-4 rounded-lg text-xs whitespace-pre min-w-min w-max">
            {`{
  "mcpServers": {
    "mcp-router": {
      "command": "npx",
      "args": [
        "-y",
        "@mcp_router/cli@latest",
        "connect",
        "--project",
        "project-name"
      ],
      "env": {
        "MCPR_TOKEN": "${token}"
      }
    }
  }
}`}
          </pre>
        </div>
      </div>
    </>
  );
};

// Chinese version component
const HowToUseZH: React.FC<HowToUseProps> = ({ token }) => {
  return (
    <>
      {/* CLI 使用 */}
      <div className="mb-6">
        <h4 className="text-md font-semibold mb-3">1. 通过 CLI 使用</h4>
        <p className="mb-3 text-muted-foreground">
          {token
            ? "将令牌设置为环境变量后连接 MCP Router："
            : "使用 @mcp_router/cli 建立连接："}
        </p>
        <div className="overflow-x-auto w-full">
          <pre className="bg-muted p-4 rounded-lg text-xs whitespace-pre min-w-min w-max">
            {token
              ? `# 将令牌导出为环境变量
export MCPR_TOKEN="${token}"

# 使用 mcpr-cli 连接
npx -y @mcp_router/cli@latest connect`
              : `# 使用 mcpr-cli 连接
npx -y @mcp_router/cli@latest connect`}
          </pre>
        </div>
      </div>

      {/* 配置文件使用 */}
      <div className="mb-6">
        <h4 className="text-md font-semibold mb-3">
          2. 在 MCP 服务器配置中使用
        </h4>
        <p className="mb-3 text-muted-foreground">
          将以下内容加入您的 MCP 服务器配置文件：
        </p>
        <div className="overflow-x-auto w-full">
          <pre className="bg-muted p-4 rounded-lg text-xs whitespace-pre min-w-min w-max">
            {`{
  "mcpServers": {
    "mcp-router": {
      "command": "npx",
      "args": [
        "-y",
        "@mcp_router/cli@latest",
        "connect"
      ],
      "env": {
        "MCPR_TOKEN": "${token}"
      }
    }
  }
}`}
          </pre>
        </div>
      </div>

      {/* Project Selection */}
      <div className="mb-6">
        <h4 className="text-md font-semibold mb-3">3. 指定项目（可选）</h4>
        <p className="mb-3 text-muted-foreground">
          如果需要限制到特定项目，请在连接时加入项目名称：
        </p>
        <div className="overflow-x-auto w-full">
          <pre className="bg-muted p-4 rounded-lg text-xs whitespace-pre min-w-min w-max">
            {token
              ? `# 设置 MCPR_TOKEN 之后
npx -y @mcp_router/cli@latest connect --project "project-name"`
              : `npx -y @mcp_router/cli@latest connect --project "project-name"`}
          </pre>
        </div>
        <p className="mb-3 text-muted-foreground">
          通过配置文件启动时也可以添加相同的参数：
        </p>
        <div className="overflow-x-auto w-full">
          <pre className="bg-muted p-4 rounded-lg text-xs whitespace-pre min-w-min w-max">
            {`{
  "mcpServers": {
    "mcp-router": {
      "command": "npx",
      "args": [
        "-y",
        "@mcp_router/cli@latest",
        "connect",
        "--project",
        "project-name"
      ],
      "env": {
        "MCPR_TOKEN": "${token}"
      }
    }
  }
}`}
          </pre>
        </div>
      </div>
    </>
  );
};

// Main component that switches based on language
const HowToUse = forwardRef<HowToUseHandle, HowToUseProps>(({ token }, ref) => {
  const { t, i18n } = useTranslation();
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  useImperativeHandle(ref, () => ({
    showDialog: () => setIsDialogOpen(true),
  }));

  const content = i18n.language.startsWith("ja") ? (
    <HowToUseJA token={token} />
  ) : i18n.language.startsWith("zh") ? (
    <HowToUseZH token={token} />
  ) : (
    <HowToUseEN token={token} />
  );

  return (
    <>
      {/* Inline display when used directly */}
      {!isDialogOpen && content}

      {/* Dialog version */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="w-[100vw] mx-auto flex flex-col">
          <DialogHeader>
            <DialogTitle>{t("mcpApps.howToUse")}</DialogTitle>
          </DialogHeader>
          <ScrollArea className="max-h-[70vh] overflow-auto">
            {content}
          </ScrollArea>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
              {t("common.close")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
});

HowToUse.displayName = "HowToUse";

export default HowToUse;
