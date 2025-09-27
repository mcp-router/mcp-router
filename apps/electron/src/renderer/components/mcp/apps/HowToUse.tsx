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

  const content =
    i18n.language === "ja" ? (
      <HowToUseJA token={token} />
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
