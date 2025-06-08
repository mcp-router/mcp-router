import React from 'react';
import { MCPServer } from '../../../../types';
import { useTranslation } from 'react-i18next';
import { Settings2, Check, RefreshCw } from 'lucide-react';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetFooter, SheetDescription } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import ServerDetailsLocal from './ServerDetailsLocal';
import ServerDetailsRemote from './ServerDetailsRemote';
import ServerDetailsEnvironment from './ServerDetailsEnvironment';

interface ServerDetailsAdvancedSheetProps {
  server: MCPServer;
  isOpen: boolean;
  isLoading: boolean;
  setIsOpen: (isOpen: boolean) => void;
  editedCommand: string;
  editedArgs: string[];
  editedBearerToken: string;
  envPairs: {key: string, value: string}[];
  setEditedCommand: (command: string) => void;
  setEditedArgs: (args: string[]) => void;
  setEditedBearerToken: (token: string) => void;
  updateArg: (index: number, value: string) => void;
  removeArg: (index: number) => void;
  addArg: () => void;
  updateEnvPair: (index: number, field: 'key' | 'value', value: string) => void;
  removeEnvPair: (index: number) => void;
  addEnvPair: () => void;
  handleSave: () => void;
}

const ServerDetailsAdvancedSheet: React.FC<ServerDetailsAdvancedSheetProps> = ({
  server,
  isOpen,
  isLoading,
  setIsOpen,
  editedCommand,
  editedArgs,
  editedBearerToken,
  envPairs,
  setEditedCommand,
  setEditedArgs,
  setEditedBearerToken,
  updateArg,
  removeArg,
  addArg,
  updateEnvPair,
  removeEnvPair,
  addEnvPair,
  handleSave
}) => {
  const { t } = useTranslation();

  return (
    <Sheet open={isOpen} onOpenChange={setIsOpen}>
      <SheetContent className="w-full sm:max-w-xl overflow-y-auto">
        <SheetHeader className="pb-4 border-b">
          <SheetTitle className="text-xl font-bold flex items-center gap-2">
            <Settings2 className="h-5 w-5 text-primary" />
            {t('serverDetails.advancedConfiguration')}
          </SheetTitle>
          <SheetDescription>
            {t('serverDetails.advancedConfigurationDescription')}
          </SheetDescription>
        </SheetHeader>
        
        <div className="py-6 space-y-6">
          {/* Use appropriate component based on server type */}
          {server.serverType === 'local' ? (
            <ServerDetailsLocal 
              server={server}
              isEditing={true}
              editedCommand={editedCommand}
              editedArgs={editedArgs}
              setEditedCommand={setEditedCommand}
              setEditedArgs={setEditedArgs}
              updateArg={updateArg}
              removeArg={removeArg}
              addArg={addArg}
            />
          ) : (
            <ServerDetailsRemote 
              server={server}
              isEditing={true}
              editedBearerToken={editedBearerToken}
              setEditedBearerToken={setEditedBearerToken}
            />
          )}
          
          {/* Environment Variables (common for both server types) */}
          <ServerDetailsEnvironment 
            server={server}
            isEditing={true}
            envPairs={envPairs}
            updateEnvPair={updateEnvPair}
            removeEnvPair={removeEnvPair}
            addEnvPair={addEnvPair}
          />
        </div>
        
        <SheetFooter className="flex justify-between sm:justify-between border-t pt-4">
          <Button variant="ghost" onClick={() => setIsOpen(false)} disabled={isLoading} className="gap-2">
            {t('common.cancel')}
          </Button>
          <Button onClick={handleSave} disabled={isLoading} className="gap-2">
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
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
};

export default ServerDetailsAdvancedSheet;
