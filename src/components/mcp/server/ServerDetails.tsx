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
  onUpdateServer: (id: string, config: any) => void;
  onRemoveServer: (id: string) => void;
  onStartServer: (id: string) => void;
  onStopServer: (id: string) => void;
}

const ServerDetails: React.FC<ServerDetailsProps> = ({
  server,
  onUpdateServer,
  onRemoveServer,
  onStartServer,
  onStopServer
}) => {
  const { t } = useTranslation();
  const [isAdvancedEditing, setIsAdvancedEditing] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  
  const [editedCommand, setEditedCommand] = useState(server.command || '');
  const [editedArgs, setEditedArgs] = useState<string[]>(server.args || []);
  const [editedBearerToken, setEditedBearerToken] = useState(server.bearerToken || '');
  const [envPairs, setEnvPairs] = useState<{key: string, value: string}[]>([]);
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

  const handleAdvancedEdit = () => {
    // For advanced editing, prepare all the detailed configuration values
    setEditedCommand(server.command || '');
    setEditedArgs(server.args || []);
    setEnvPairs(
      Object.entries(server.env || {}).map(([key, value]) => ({ key, value: String(value) }))
    );
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

  const addEnvPair = () => {
    setEnvPairs([...envPairs, { key: '', value: '' }]);
  };

  const addArg = () => {
    setEditedArgs([...editedArgs, '']);
  };

  const removeArg = (index: number) => {
    setEditedArgs(editedArgs.filter((_, i) => i !== index));
  };

  const updateArg = (index: number, value: string) => {
    const newArgs = [...editedArgs];
    newArgs[index] = value;
    setEditedArgs(newArgs);
  };

  const removeEnvPair = (index: number) => {
    setEnvPairs(envPairs.filter((_, i) => i !== index));
  };

  const updateEnvPair = (index: number, field: 'key' | 'value', value: string) => {
    const newPairs = [...envPairs];
    newPairs[index][field] = value;
    setEnvPairs(newPairs);
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
      
      // Also update env variables to include all parameter values
      const updatedEnv = { ...(server.env || {}) };
      Object.entries(inputParamValues).forEach(([key, value]) => {
        updatedEnv[key] = value;
      });
      
      // Create base config with updated parameters
      const updatedConfig: any = {
        inputParams: updatedInputParams,
        env: updatedEnv,
        name: server.name,
        command: server.command,
        args: server.args
      };
      
      await onUpdateServer(server.id, updatedConfig);
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
      
      await onUpdateServer(server.id, updatedConfig);
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
        isOpen={isAdvancedEditing}
        isLoading={isLoading}
        setIsOpen={setIsAdvancedEditing}
        editedCommand={editedCommand}
        editedArgs={editedArgs}
        editedBearerToken={editedBearerToken}
        envPairs={envPairs}
        setEditedCommand={setEditedCommand}
        setEditedArgs={setEditedArgs}
        setEditedBearerToken={setEditedBearerToken}
        updateArg={updateArg}
        removeArg={removeArg}
        addArg={addArg}
        updateEnvPair={updateEnvPair}
        removeEnvPair={removeEnvPair}
        addEnvPair={addEnvPair}
        handleSave={handleSaveAdvanced}
      />
    </div>
  );
};

export default ServerDetails;
