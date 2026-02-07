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

const HowToUseContent: React.FC<HowToUseProps> = ({ token }) => {
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

// Main component
const HowToUse = forwardRef<HowToUseHandle, HowToUseProps>(({ token }, ref) => {
  const { t } = useTranslation();
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  useImperativeHandle(ref, () => ({
    showDialog: () => setIsDialogOpen(true),
  }));

  const content = <HowToUseContent token={token} />;

  return (
    <>
      {/* Inline display when used directly */}
      {!isDialogOpen && content}

      {/* Dialog version */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="w-[100vw] mx-auto flex flex-col">
          <DialogHeader>
            <DialogTitle>{t("clientApps.howToUse")}</DialogTitle>
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
