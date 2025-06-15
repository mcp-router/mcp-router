import React, { useState, useEffect } from 'react';
import { MCPServer } from '../../../types';
import {
  Settings,
  Edit,
  FileText,
  Terminal,
  Settings2,
  RefreshCw,
  Check
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Button } from "@/components/ui/button";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { toast } from "sonner";
import { useServerStore } from '@/lib/stores/server-store';
import { useServerEditingStore } from '@/lib/stores/server-editing-store';

// Import sub-components
import ServerDetailsLocal from '@/components/mcp/server/server-details/ServerDetailsLocal';
import ServerDetailsRemote from '@/components/mcp/server/server-details/ServerDetailsRemote';
// import ServerDetailsLogs from './server-details/ServerDetailsLogs';
// import ServerDetailsEditForm from './server-details/ServerDetailsEditSheet';
import ServerDetailsAdvancedSheet from '@/components/mcp/server/server-details/ServerDetailsAdvancedSheet';
// import ServerDetailsRemoveDialog from './server-details/ServerDetailsRemoveDialog';
import ServerDetailsInputParams from '@/components/mcp/server/server-details/ServerDetailsInputParams';

interface ServerDetailsProps {
  server: MCPServer;
}

const ServerDetails: React.FC<ServerDetailsProps> = ({
  server,
}) => {
  const { t } = useTranslation();
  const { updateServerConfig } = useServerStore();
  const {
    isAdvancedEditing,
    isLoading,
    editedCommand,
    editedArgs,
    editedBearerToken,
    envPairs,
    setIsAdvancedEditing,
    setIsLoading,
    setEditedCommand,
    setEditedArgs,
    setEditedBearerToken,
    setEnvPairs,
    updateArg,
    removeArg,
    addArg,
    updateEnvPair,
    removeEnvPair,
    addEnvPair,
    initializeFromServer,
    reset
  } = useServerEditingStore();
  const [inputParamValues, setInputParamValues] = useState<Record<string, string>>({});
  const [initialInputParamValues, setInitialInputParamValues] = useState<Record<string, string>>({});
  const [isDirty, setIsDirty] = useState(false);

  // Initialize inputParamValues from server inputParams defaults
  useEffect(() => {
    if (server.inputParams) {
      const initialValues: Record<string, string> = {};
      Object.entries(server.inputParams).forEach(([key, param]) => {
        initialValues[key] = param.default || '';
      });
      setInputParamValues(initialValues);
      setInitialInputParamValues(initialValues);
      setIsDirty(false);
    }
  }, [server.id]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      reset();
    };
  }, [reset]);

  const handleAdvancedEdit = () => {
    // For advanced editing, prepare all the detailed configuration values
    initializeFromServer(server);
    setIsAdvancedEditing(true);
  };
  
  const updateInputParam = (key: string, value: string) => {
    setInputParamValues(prev => {
      const updated = { ...prev, [key]: value };
      // 変更検知
      const dirty = Object.keys(updated).some(
        k => updated[k] !== initialInputParamValues[k]
      );
      setIsDirty(dirty);
      return updated;
    });
  };


  const handleSaveParams = async () => {
    setIsLoading(true);
    try {
      // Create a copy of the server's current inputParams structure
      const updatedInputParams = { ...(server.inputParams || {}) };
      
      // Update the default values in inputParams with the current values
      if (server.inputParams) {
        Object.entries(inputParamValues).forEach(([key, value]) => {
          if (updatedInputParams[key]) {
            updatedInputParams[key] = {
              ...updatedInputParams[key],
              default: value
            };
          }
        });
      }
      
      // Create base config with updated parameters
      const updatedConfig: any = {
        inputParams: updatedInputParams,
        env: server.env,
        name: server.name,
        command: server.command,
        args: server.args
      };
      
      await updateServerConfig(server.id, updatedConfig);
      setInitialInputParamValues(inputParamValues); // 保存後に初期値を更新
      setIsDirty(false);
      toast.success(t('serverDetails.updateSuccess'));
    } catch (error) {
      console.error('Failed to update server:', error);
      toast.error(t('serverDetails.updateFailed'));
    } finally {
      setIsLoading(false);
    }
  };
  
  const handleSaveAdvanced = async () => {
    setIsLoading(true);
    try {
      const envObj: Record<string, string> = {};
      envPairs.forEach(pair => {
        if (pair.key.trim()) {
          envObj[pair.key.trim()] = pair.value;
        }
      });
      
      // Create base config
      const updatedConfig: any = {
        name: server.name,
        command: editedCommand,
        args: editedArgs,
        env: envObj,
        inputParams: server.inputParams
      };
      
      // Add bearer token for remote servers
      if (server.serverType !== 'local') {
        updatedConfig.bearerToken = editedBearerToken;
      }
      
      await updateServerConfig(server.id, updatedConfig);
      setIsAdvancedEditing(false);
      toast.success(t('serverDetails.updateSuccess'));
    } catch (error) {
      console.error('Failed to update server:', error);
      toast.error(t('serverDetails.updateFailed'));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="space-y-5 bg-muted/50 p-4 mb-2">
        {/* Final Command Display */}
        {server.serverType === 'local' ? (
            <ServerDetailsLocal 
              server={server} 
              inputParamValues={inputParamValues}
            />
          ) : (
            <ServerDetailsRemote server={server} />
          )}
        {/* Input Parameters - always editable */}
        {server.inputParams && Object.keys(server.inputParams).length > 0 && (
          <ServerDetailsInputParams 
            server={server}
            inputParamValues={inputParamValues}
            updateInputParam={updateInputParam}
          />
        )}
        <div className="flex justify-between pt-2">
          {/* Only show the advanced settings button */}
          <Button
            variant="outline"
            size="sm"
            onClick={(e) => {
              e.stopPropagation();
              handleAdvancedEdit();
            }}
            className="flex items-center gap-1.5 hover:bg-primary/10 hover:text-primary transition-colors border-primary/20"
          >
            <Settings2 className="h-4 w-4" />
            {t('serverDetails.advancedSettings')}
          </Button>
          {/* If in edit mode, show save button */}
          {isDirty && (
            <Button
              variant="outline"
              size="sm"
              onClick={(e) => {
                e.stopPropagation();
                handleSaveParams();
              }}
              className="flex items-center gap-1.5 hover:bg-primary/10 hover:text-primary transition-colors border-primary/20"
              disabled={isLoading}
            >
              {isLoading ? (
                <>
                  <RefreshCw className="h-4 w-4 animate-spin" />
                  {t('common.saving')}
                </>
              ) : (
                <>
                  <Check className="h-4 w-4" />
                  {t('common.save')}
                </>
              )}
            </Button>
          )}
        </div>
      </div>
      {/* Advanced Edit Sheet */}
      <ServerDetailsAdvancedSheet 
        server={server}
        handleSave={handleSaveAdvanced}
      />
    </div>
  );
};

export default ServerDetails;
