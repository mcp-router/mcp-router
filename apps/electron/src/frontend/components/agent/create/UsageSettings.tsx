import React, { useState, useEffect } from "react";
import { AgentConfig } from "@mcp-router/shared";
import { Label } from "@mcp-router/ui";
import { Textarea } from "@mcp-router/ui";
import { Button } from "@mcp-router/ui";
import { Input } from "@mcp-router/ui";
import { t } from "i18next";
import { Loader2, Bot } from "lucide-react";
import { toast } from "sonner";
import { usePlatformAPI } from "@/lib/platform-api";

// Usage Settings Component
interface UsageSettingsProps {
  agent: AgentConfig;
  setAgent: React.Dispatch<React.SetStateAction<Omit<AgentConfig, "id">>>;
}

export const UsageSettings: React.FC<UsageSettingsProps> = ({
  agent,
  setAgent,
}) => {
  const platformAPI = usePlatformAPI();
  const [authToken, setAuthToken] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);

  // Get authentication token from Electron API
  useEffect(() => {
    const fetchAuthToken = async () => {
      try {
        const status = await platformAPI.auth.getStatus();
        if (status.authenticated && status.token) {
          setAuthToken(status.token);
        }
      } catch (error) {
        console.error("Error fetching authentication token:", error);
      }
    };

    fetchAuthToken();
  }, []);

  // Generate agent information
  const handleGenerate = async () => {
    if (!agent.purpose || !authToken) {
      if (!authToken) {
        toast.error(t("agents.loginRequired.featureDescription"));
      }
      return;
    }

    setIsGenerating(true);

    try {
      // Use fetch to call API directly
      const response = await fetch("https://mcp-router.net/api/agent/copilot", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
        },
        body: JSON.stringify({ purpose: agent.purpose }),
      });

      const data = await response.json();

      // Apply generation results
      if (data && data.instructions) {
        setAgent({
          ...agent,
          instructions: data.instructions || agent.instructions,
        });
      }
    } catch (error) {
      console.error("Error generating agent:", error);
      toast.error(t("agents.errors.generateFailed"));
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="name">{t("agents.fields.name")}</Label>
        <Input
          id="name"
          value={agent.name}
          onChange={(e) => setAgent({ ...agent, name: e.target.value })}
          placeholder={t("agents.namePlaceholder")}
          disabled={isGenerating}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="purpose">{t("agents.fields.purpose")}</Label>
        <Textarea
          id="purpose"
          value={agent.purpose}
          onChange={(e) => setAgent({ ...agent, purpose: e.target.value })}
          placeholder={t("agents.purposePlaceholder")}
          rows={3}
          disabled={isGenerating}
        />
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label htmlFor="instructions">
            {t("agents.fields.instructions")}
          </Label>
          {agent.purpose && !agent.instructions && (
            <Button
              onClick={handleGenerate}
              disabled={isGenerating || !authToken}
              size="sm"
              title={
                !authToken ? t("agents.loginRequired.featureDescription") : ""
              }
            >
              {isGenerating ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Bot className="h-4 w-4 mr-2" />
              )}
              {isGenerating ? t("agents.generating") : t("agents.generate")}
              {!authToken && " (Login Required)"}
            </Button>
          )}
        </div>
        <Textarea
          id="instructions"
          value={agent.instructions}
          onChange={(e) => setAgent({ ...agent, instructions: e.target.value })}
          placeholder={t("agents.instructionsPlaceholder")}
          rows={10}
          disabled={isGenerating}
        />
      </div>
    </div>
  );
};
