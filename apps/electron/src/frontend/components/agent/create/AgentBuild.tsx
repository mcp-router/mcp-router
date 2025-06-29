import React, { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { AgentConfig } from "@mcp-router/shared";
import { usePlatformAPI } from "@mcp-router/platform-api";
import { Button } from "@mcp-router/ui";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@mcp-router/ui";
import { Badge } from "@mcp-router/ui";
import { PlusCircle } from "lucide-react";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";
import { useWorkspaceStore } from "../../../stores";

const AgentBuild: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const platformAPI = usePlatformAPI();
  const { currentWorkspace } = useWorkspaceStore();
  const [agents, setAgents] = useState<AgentConfig[]>([]);

  // エージェント一覧の取得
  const fetchAgents = useCallback(async () => {
    try {
      const agents = await platformAPI.agents.list();
      setAgents(agents);
    } catch (error) {
      console.error("Failed to fetch agents:", error);
      toast.error(t("agents.fetchError"));
    }
  }, [t, platformAPI]);

  // 初期データ読み込み & ワークスペース変更時の再読み込み
  useEffect(() => {
    fetchAgents();
  }, [fetchAgents, currentWorkspace?.id]);

  // 空のエージェントを作成してから編集ページへ遷移
  const handleCreateAgent = async () => {
    try {
      // 空のエージェントを作成
      const emptyAgent = {
        name: "Agent",
        autoExecuteTool: true,
      } as AgentConfig;

      // 新しいエージェントを作成
      const createdAgent = await platformAPI.agents.create(emptyAgent);

      // 作成したエージェントの編集ページへ遷移
      navigate(`/agents/build/edit/${createdAgent.id}`);
      toast.success(t("agents.createSuccess"));
    } catch (error) {
      console.error("Failed to create empty agent:", error);
      toast.error(t("agents.createError"));
    }
  };

  // 編集ページへ遷移
  const navigateToEdit = (agent: AgentConfig) => {
    navigate(`/agents/build/edit/${agent.id}`);
  };

  return (
    <div className="container">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold">{t("agents.buildTitle")}</h1>
          <p className="text-muted-foreground">
            {t("agents.buildDescription")}
          </p>
        </div>
        <div className="flex gap-2">
          <Button onClick={() => handleCreateAgent()}>
            <PlusCircle className="mr-2 h-4 w-4" />
            {t("agents.create")}
          </Button>
        </div>
      </div>

      {agents.length === 0 ? (
        <div className="flex flex-col items-center justify-center p-12 border rounded-lg">
          <p className="text-muted-foreground mb-4">{t("agents.noAgents")}</p>
          <Button onClick={() => handleCreateAgent()}>
            <PlusCircle className="mr-2 h-4 w-4" />
            {t("agents.create")}
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {agents.map((agent) => (
            <Card
              key={agent.id}
              className="overflow-hidden cursor-pointer hover:shadow-md transition-shadow"
              onClick={() => navigateToEdit(agent)}
            >
              <CardHeader>
                <div className="flex justify-between items-start">
                  <CardTitle>{agent.name}</CardTitle>
                </div>
                <CardDescription>{agent.purpose}</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="mb-4">
                  <div className="flex flex-wrap gap-1">
                    {agent.mcpServers.length > 0 &&
                      agent.mcpServers.map((server) => (
                        <Badge key={server.id} variant="secondary">
                          {server.name}
                        </Badge>
                      ))}
                  </div>
                </div>
              </CardContent>
              <CardFooter className="flex justify-between"></CardFooter>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};

export default AgentBuild;
