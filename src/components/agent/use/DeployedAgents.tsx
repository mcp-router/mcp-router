import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { DeployedAgent } from '../../../types';
import { Button } from '../../ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../ui/card';
import { Badge } from '../../ui/badge';
import { Label } from '../../ui/label';
import { Textarea } from '../../ui/textarea';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '../../ui/dialog';
import { Download } from 'lucide-react';
import { toast } from 'sonner';
import { useTranslation } from 'react-i18next';
import { useAgentStore } from '../../../lib/stores';

const DeployedAgents: React.FC = () => {
    const { t } = useTranslation();
    const navigate = useNavigate();
    
    // Zustand store
    const {
        deployedAgents,
        refreshAgents,
        addDeployedAgent
    } = useAgentStore();
    
    const [isImportDialogOpen, setIsImportDialogOpen] = useState(false);
    const [importCode, setImportCode] = useState('');
    const [isImporting, setIsImporting] = useState(false);
    
    // 初期データ読み込み
    useEffect(() => {
        refreshAgents();
    }, [refreshAgents]);

    // エージェントの有効化・使用
    const navigateToAgentPage = async (agent: DeployedAgent) => {
        try {
            navigate(`/agents/use/${agent.id}/chat`);
        } catch (error) {
            console.error('Failed to activate agent:', error);
            toast.error(t('agents.errors.fetchFailed'));
        }
    };
    
    // エージェントのインポート
    const handleImportAgent = async () => {
        try {
            setIsImporting(true);
            const agent = await window.electronAPI.importAgent(importCode);
            addDeployedAgent(agent);
            setIsImportDialogOpen(false);
            setImportCode('');
            toast.success(t('agents.success.imported', { name: agent.name }));
        } catch (error) {
            console.error('Failed to import agent:', error);
            toast.error(t('agents.errors.importFailed'));
        } finally {
            setIsImporting(false);
        }
    };
    
    // Handle import dialog opening
    const handleOpenImportDialog = () => {
        setIsImportDialogOpen(true);
    };
    
    return (
        <div className="container">
            <div className="flex justify-between items-center mb-6">
                <div>
                    <h1 className="text-2xl font-bold">{t('agents.useTitle')}</h1>
                    <p className="text-muted-foreground">{t('agents.useDescription')}</p>
                </div>
                <div className="flex gap-2">
                    <Button 
                        onClick={handleOpenImportDialog}
                    >
                        <Download className="mr-2 h-4 w-4" />
                        {t('agents.import')}
                    </Button>
                </div>
            </div>
            
            {deployedAgents.length === 0 ? (
                <div className="flex flex-col items-center justify-center p-12 border rounded-lg">
                    <p className="text-muted-foreground mb-4">{t('agents.noConfiguredAgents')}</p>
                    <div className="flex gap-2">
                        <Button onClick={() => navigate('/agents/build')}>
                            {t('agents.goToBuild')}
                        </Button>
                        <Button 
                            onClick={handleOpenImportDialog}
                        >
                            <Download className="mr-2 h-4 w-4" />
                            {t('agents.import')}
                        </Button>
                    </div>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {[...deployedAgents].reverse().map(agent => (
                        <Card 
                            key={agent.id} 
                            className="overflow-hidden cursor-pointer hover:shadow-md transition-shadow" 
                            onClick={() => navigateToAgentPage(agent)}
                        >
                            <CardHeader>
                                <div className="flex justify-between items-start">
                                    <CardTitle>{agent.name}</CardTitle>
                                </div>
                                <CardDescription>{agent.description}</CardDescription>
                            </CardHeader>
                            <CardContent>
                                <div className="mb-4">
                                    <div className="flex flex-wrap gap-1">
                                        {agent.mcpServers.length > 0 && agent.mcpServers.map(server => (
                                            <Badge key={server.id} variant="secondary">
                                                {server.name}
                                            </Badge>
                                        ))}
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    ))}
                </div>
            )}
            
            {/* インポートダイアログ */}
            <Dialog open={isImportDialogOpen} onOpenChange={setIsImportDialogOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>{t('agents.import')}</DialogTitle>
                        <DialogDescription>
                            {t('agents.importDescription')}
                        </DialogDescription>
                    </DialogHeader>
                    
                    <div className="grid gap-4 py-4">
                        <div className="space-y-2">
                            <Label htmlFor="import-code">URL</Label>
                            <Textarea
                                id="import-code"
                                value={importCode}
                                onChange={(e) => setImportCode(e.target.value)}
                                rows={4}
                                placeholder="https://..."
                            />
                        </div>
                    </div>
                    
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setIsImportDialogOpen(false)} disabled={isImporting}>
                            {t('common.cancel')}
                        </Button>
                        <Button onClick={handleImportAgent} disabled={isImporting}>
                            {isImporting ? t('agents.importing') : t('agents.import')}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
};

export default DeployedAgents;
