import React, { useState } from 'react';
import ServerDetailsRemoveDialog from '@/components/mcp/server/server-details/ServerDetailsRemoveDialog';
import { MCPServer } from '../types';
import { ScrollArea } from './ui/scroll-area';
import { Badge } from './ui/badge';
import { Switch } from './ui/switch';
import { IconSearch, IconServer, IconChevronDown, IconPlus } from '@tabler/icons-react';
import { useTranslation } from 'react-i18next';
import { cn } from '../lib/utils/tailwind-utils';
import { Trash } from 'lucide-react';
import { toast } from "sonner";
import { useServerStore } from '../lib/stores';

// Import components
import ServerDetails from '@/components/mcp/server/ServerDetails';
import { Link } from 'react-router-dom';
import { Button } from './ui/button';
import { 
  Breadcrumb,
  BreadcrumbList,
  BreadcrumbItem,
  BreadcrumbLink,
} from './ui/breadcrumb';

const Home: React.FC = () => {
  const { t } = useTranslation();
  
  // Zustand stores
  const {
    servers,
    searchQuery,
    setSearchQuery,
    expandedServerId,
    setExpandedServerId,
    setSelectedServerId,
    startServer,
    stopServer,
    updateServerConfig,
    deleteServer
  } = useServerStore();
  
  // Filter servers based on search query and sort them
  const filteredServers = servers
    .filter(server => 
      server.name.toLowerCase().includes(searchQuery.toLowerCase())
    )
    .sort((a, b) => a.name.localeCompare(b.name));
  
  // State for server removal dialog (keeping local for now)
  const [isRemoveDialogOpen, setIsRemoveDialogOpen] = useState(false);
  const [serverToRemove, setServerToRemove] = useState<MCPServer | null>(null);
  const [isRemoving, setIsRemoving] = useState(false);

  // Toggle expanded server details
  const toggleServerExpand = (serverId: string) => {
    if (expandedServerId === serverId) {
      setExpandedServerId(null);
      setSelectedServerId(null);
    } else {
      setExpandedServerId(serverId);
      setSelectedServerId(serverId);
    }
  };
  
  // Handle opening remove dialog
  const openRemoveDialog = (server: MCPServer, e: React.MouseEvent) => {
    e.stopPropagation();
    setServerToRemove(server);
    setIsRemoveDialogOpen(true);
  };
  
  // Handle server removal
  const handleRemoveServer = async () => {
    if (serverToRemove) {
      setIsRemoving(true);
      try {
        await deleteServer(serverToRemove.id);
        toast.success(t('serverDetails.removeSuccess'));
      } catch (error) {
        toast.error(t('serverDetails.removeFailed'));
      } finally {
        setIsRemoveDialogOpen(false);
        setIsRemoving(false);
      }
    }
  };

  return (
    <div className="flex flex-col h-full">
      <div className="flex justify-between items-center mb-4">
        <Breadcrumb>
          <BreadcrumbList>
            <BreadcrumbItem>
              <BreadcrumbLink asChild>
                <Link to="/servers">
                  {t('serverList.title')}
                </Link>
              </BreadcrumbLink>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>
        
        <Button asChild variant="outline" size="sm" className="gap-1">
          <Link to="/servers/add">
            <IconPlus className="h-4 w-4" />
            {t('serverList.addServer')}
          </Link>
        </Button>
      </div>
      
      <div className="mb-4">
        <div className="relative">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={t('common.search')}
            className="w-full bg-background border border-border rounded-md py-1.5 px-3 pl-8 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
          />
          <IconSearch className="absolute left-2.5 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        </div>
      </div>
      
      <div className="border rounded-md overflow-hidden flex-1 mb-8">
        {filteredServers.length === 0 && searchQuery === '' ? (
          <div className="p-4 flex items-center justify-center">
            <div className="text-center">
              <IconServer className="w-16 h-16 mx-auto mb-4 opacity-40" />
              <div className="text-base font-medium mb-2">{t('serverList.noServers')}</div>
              <div className="text-sm opacity-75"><Link to="/servers/add">{t('serverList.addServer')}</Link></div>
            </div>
          </div>
        ) : filteredServers.length === 0 && searchQuery !== '' ? (
          <div className="p-4 flex items-center justify-center">
            <div className="text-center">
              <IconSearch className="w-12 h-12 mx-auto mb-4 opacity-40" />
              <div className="text-base font-medium mb-2">{t('common.search')}</div>
              <div className="text-sm opacity-75">{t('serverList.noServers')}</div>
            </div>
          </div>
        ) : (
          <ScrollArea className="h-full">
            <div className="divide-y divide-border">
              {filteredServers.map(server => {
                // console.log("Server:", server);
                
                const isExpanded = expandedServerId === server.id;
                const statusConfig = {
                  running: {
                    color: 'bg-emerald-500',
                    pulseEffect: 'animate-pulse',
                  },
                  starting: {
                    color: 'bg-yellow-500',
                    pulseEffect: 'animate-pulse',
                  },
                  stopping: {
                    color: 'bg-orange-500',
                    pulseEffect: 'animate-pulse',
                  },
                  stopped: {
                    color: 'bg-muted-foreground',
                    pulseEffect: '',
                  },
                  error: {
                    color: 'bg-red-500',
                    pulseEffect: 'animate-pulse',
                  }
                };
                
                // Add safety check to use 'stopped' as default when status is invalid
                const status = statusConfig[server.status as keyof typeof statusConfig] || statusConfig.stopped;
                
                return (
                  <div key={server.id}>
                    <div 
                      className="p-4 hover:bg-sidebar-hover cursor-pointer"
                      onClick={() => toggleServerExpand(server.id)}
                    >
                      <div className="flex justify-between">
                        <div className="flex flex-col">
                          <div className="font-medium text-base mb-1 hover:text-primary flex items-center">
                            {server.name}
                            <IconChevronDown 
                              className={`w-4 h-4 ml-2 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
                            />
                          </div>

                          {/* Description - if available */}
                          {'description' in server && typeof (server as any).description === 'string' && (
                            <p className="text-xs text-muted-foreground mb-2 line-clamp-1">
                              {(server as any).description}
                            </p>
                          )}
                          <div className="flex flex-wrap gap-2 mb-1">
                            {/* Verification Badge - if available */}
                            {('verificationStatus' in server) && (
                              <Badge variant={server.verificationStatus === 'verified' ? 'default' : 'outline'} className="w-fit">
                                {server.verificationStatus === 'verified' ? 'Verified' : 'Unverified'}
                              </Badge>
                            )}

                            {/* Server Type Badge */}
                            <Badge variant="secondary" className="w-fit">
                              {server.serverType === 'local' ? 'Local' : 'Remote'}
                            </Badge>

                            {/* Version Badge - if available */}
                            {server.version && (
                              <Badge variant="outline" className="bg-blue-500/10 text-blue-600 border-blue-200 text-xs">
                                v{server.version}
                              </Badge>
                            )}

                            {/* Status Badge */}
                            <Badge variant="outline" className={cn("w-fit flex items-center gap-1", status.pulseEffect)}>
                              <div className={cn("h-2 w-2 rounded-full", status.color)}></div>
                              {t(`serverList.status.${server.status}`)}
                            </Badge>
                          </div>
                          
                          {/* Tags - if available */}
                          {'tags' in server && Array.isArray((server as any).tags) && (server as any).tags.length > 0 && (
                            <div className="flex flex-wrap gap-1 mt-1">
                              {((server as any).tags as string[]).map((tag: string, index: number) => (
                                <Badge key={index} variant="outline" className="text-xs px-1 py-0">
                                  {tag}
                                </Badge>
                              ))}
                            </div>
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-muted-foreground">
                            {server.status === 'running' ? t('serverList.status.running') : 
                             server.status === 'starting' ? t('serverList.status.starting') :
                             server.status === 'stopping' ? t('serverList.status.stopping') :
                             t('serverList.status.stopped')}
                          </span>
                          <div className='h-6 w-12'>
                          <Switch
                            checked={server.status === 'running'}
                            disabled={server.status === 'starting' || server.status === 'stopping'}
                            onCheckedChange={async (checked) => {
                              try {
                                if (checked) {
                                  await startServer(server.id);
                                  // サーバーが起動完了した場合のメッセージ
                                  toast.success(t('serverList.serverStarted'));
                                } else {
                                  await stopServer(server.id);
                                  // サーバーが停止完了した場合のメッセージ
                                  toast.success(t('serverList.serverStopped'));
                                }
                              } catch (error) {
                                console.error('Server operation failed:', error);
                                toast.error(t('serverList.status.error') + ': ' + (error instanceof Error ? error.message : 'Unknown error'));
                              }
                            }}
                            onClick={(e) => e.stopPropagation()}
                          />
                          </div>
                          <button
                            className="text-red-500 hover:text-red-400 p-1.5 rounded-full hover:bg-red-500/10 transition-colors"
                            onClick={(e) => openRemoveDialog(server, e)}
                            title={t('serverDetails.uninstall')}
                          >
                            <Trash className="h-4 w-4" />
                          </button>
                        </div>
                      </div>
                    </div>
                    
                    {/* Expanded Server Details Section */}
                    {isExpanded && (
                        <ServerDetails
                          server={server}
                          onUpdateServer={updateServerConfig}
                          onRemoveServer={(_id) => openRemoveDialog(server, {} as React.MouseEvent)}
                          onStartServer={startServer}
                          onStopServer={stopServer}
                        />
                    )}
                  </div>
                );
              })}
            </div>
          </ScrollArea>
        )}
      </div>
      
      {/* Server Remove Confirmation Dialog */}
      {serverToRemove && (
        <ServerDetailsRemoveDialog
          server={serverToRemove}
          isOpen={isRemoveDialogOpen}
          isLoading={isRemoving}
          setIsOpen={setIsRemoveDialogOpen}
          handleRemove={handleRemoveServer}
        />
      )}
    </div>
  );
};

export default Home;
