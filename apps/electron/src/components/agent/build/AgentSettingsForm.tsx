import React from 'react';
import { AgentConfig } from '../../../types';
import { McpSettings } from './McpSettings';
import { UsageSettings } from './UsageSettings';
import { Separator } from '../../ui/separator';
import { ScrollArea } from "@/components/ui/scroll-area";

interface AgentSettingsFormProps {
  agent: AgentConfig;
  setAgent: React.Dispatch<React.SetStateAction<Omit<AgentConfig, 'id'>>>;
}

const AgentSettingsForm: React.FC<AgentSettingsFormProps> = ({
  agent,
  setAgent,
}) => {
  return (
      <ScrollArea className="h-[calc(100vh-10rem)]">
          <div className="p-4">
              {/* 基本設定 */}
              <div className="my-6">
                <UsageSettings
                  agent={agent}
                  setAgent={setAgent}
                />
              </div>

              <Separator className="my-6" />

              {/* セットアップの設定セクション */}
              <div className="mb-6">
                  <McpSettings
                      agent={agent}
                      setAgent={setAgent}
                      isDev={true}
                  />
              </div>
          </div>
      </ScrollArea>
  );
};

export default AgentSettingsForm;
