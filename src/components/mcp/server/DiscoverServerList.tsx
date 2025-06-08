import React from 'react';
import { LocalMCPServer } from '../../../types';
import { RotateCw, Plus, CheckCircle } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

interface DiscoverServerListProps {
  remoteServers: LocalMCPServer[];
  onImportServer: (server: LocalMCPServer) => void;
  isLoading: boolean;
  importingServerIds: Set<string>;
  installedServerIds: Set<string>;
  tabType?: 'verified' | 'community';
}

const DiscoverServerList: React.FC<DiscoverServerListProps> = ({
  remoteServers,
  onImportServer,
  isLoading,
  importingServerIds,
  installedServerIds,
  tabType = 'verified'
}) => {
  const { t } = useTranslation();
  
  if (isLoading) {
    return (
      <div className="p-8 text-center flex flex-col items-center justify-center">
        <RotateCw className="h-8 w-8 animate-spin mb-4" />
        <p>{t('discoverServers.loading')}</p>
      </div>
    );
  }

  if (remoteServers.length === 0) {
    return (
      <Card className="mx-auto max-w-md">
        <CardContent className="pt-6 text-center">
          <div className="mb-4 text-muted-foreground">
            <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mx-auto opacity-50">
              <path d="M18 6 6 18" /><path d="m6 6 12 12" />
            </svg>
          </div>
          <CardTitle className="text-xl mb-2">{t('discoverServers.noServersFound')}</CardTitle>
          <CardDescription>{t('discoverServers.tryRefreshing')}</CardDescription>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="p-2">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {tabType === 'verified' && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle>{t('discoverServers.verifyYourServer.title')}</CardTitle>
              <CardDescription>{t('discoverServers.verifyYourServer.description')}</CardDescription>
            </CardHeader>
            <CardFooter>
              <Button 
                className="w-full"
                onClick={() => window.open('https://mcp-router.net?filter=mine', '_blank')}
              >
                {t('discoverServers.verifyYourServer.link')}
              </Button>
            </CardFooter>
          </Card>
        )}
        {tabType === 'community' && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle>{t('discoverServers.addServer.title')}</CardTitle>
              <CardDescription>{t('discoverServers.addServer.description')}</CardDescription>
            </CardHeader>
            <CardFooter>
              <Button 
                className="w-full"
                onClick={() => window.open('https://mcp-router.net/mcpservers/new', '_blank')}
              >
                {t('discoverServers.addServer.link')}
              </Button>
            </CardFooter>
          </Card>
        )}

        {remoteServers.map(server => (
          <Card key={server.id}>
            <div 
              className="cursor-pointer transition-colors hover:bg-muted/50"
              onClick={() => {
                const url = `https://mcp-router.net/mcpservers/${encodeURIComponent(server.displayId)}/`;
                window.open(url, '_blank');
              }}
            >
              <CardHeader className="pb-2">
                <div className="flex items-start">
                  <div className="flex items-center">
                    {server.iconUrl && (
                      <img 
                        src={server.iconUrl} 
                        alt={`${server.name} icon`} 
                        className="w-6 h-6 rounded-sm mr-2 object-cover"
                      />
                    )}
                    <div className="flex items-center">
                      <div className="flex items-center gap-2">
                        <CardTitle className="text-lg font-medium">
                          {server.name}
                        </CardTitle>
                        {server.latestVersion && (
                          <Badge variant="outline" className="bg-blue-500/10 text-blue-600 border-blue-200 text-xs">
                            v{server.latestVersion}
                          </Badge>
                        )}
                      </div>
                      {server.verificationStatus == "verified" && (
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <span className="ml-1">
                                <CheckCircle className="h-4 w-4 text-blue-500 inline" />
                              </span>
                            </TooltipTrigger>
                            <TooltipContent>
                              <p>{t('discoverServers.verified')}</p>
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      )}
                    </div>
                  </div>
                </div>
                <CardDescription className="line-clamp-2 mt-1">
                  {server.description}
                </CardDescription>
              </CardHeader>
              
              <CardContent className="pb-2">
                <div className="text-xs text-muted-foreground">
                  <p>{t('discoverServers.updated')}: {new Date(server.updatedAt).toLocaleDateString()}</p>
                  
                  {server.tags && server.tags.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1">
                      {server.tags.map((tag, index) => (
                        <Badge key={index} variant="secondary" className="text-xs">
                          {tag}
                        </Badge>
                      ))}
                    </div>
                  )}
                </div>
              </CardContent>
            </div>
            
            <CardFooter>
              <Button
                onClick={() => onImportServer(server)}
                disabled={importingServerIds.has(server.id) || installedServerIds.has(server.id)}
                className="w-full"
                variant={installedServerIds.has(server.id) ? "secondary" : "default"}
              >
                {installedServerIds.has(server.id) ? (
                  <>{t('discoverServers.alreadyInstalled')}</>
                ) : importingServerIds.has(server.id) ? (
                  <>
                    <RotateCw className="mr-2 h-4 w-4 animate-spin" />
                    {t('discoverServers.installing')}
                  </>
                ) : (
                  <>
                    <Plus className="mr-2 h-4 w-4" />
                    {t('discoverServers.install')}
                  </>
                )}
              </Button>
            </CardFooter>
          </Card>
        ))}
      </div>
    </div>
  );
};

export default DiscoverServerList;
