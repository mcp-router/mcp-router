import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import { AgentConfig, MCPServerConfig } from '../../../types';
import { Button } from '../../ui/button';
import { Input } from '../../ui/input';
import { Label } from '../../ui/label';
import { Textarea } from '../../ui/textarea';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '../../ui/dialog';
import { toast } from 'sonner';
import { Save, Rocket, Trash2, RefreshCw, PlayCircle } from 'lucide-react';
import AgentChatPlayground from './AgentChatPlayground';
import AgentSettingsForm from './AgentSettingsForm';
import { Switch } from '../../ui/switch';
import { useTranslation } from 'react-i18next';
import { 
    Breadcrumb, 
    BreadcrumbItem, 
    BreadcrumbLink, 
    BreadcrumbList, 
    BreadcrumbPage, 
    BreadcrumbSeparator 
} from '../../ui/breadcrumb';
import { Tooltip, TooltipContent, TooltipTrigger } from '../../ui/tooltip';
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@/components/ui/resizable"

// エージェントの状態を取得するユーティリティ関数
const createAgentSnapshot = (agent: AgentConfig): AgentConfig => {
  return {
    id: agent.id,
    name: agent.name,
    mcpServers: [...agent.mcpServers],
    purpose: agent.purpose,
    description: agent.description,
    instructions: agent.instructions,
    createdAt: agent.createdAt,
    updatedAt: Date.now(),
    toolPermissions: agent.toolPermissions || {},
    autoExecuteTool: agent.autoExecuteTool || true,
  };
};

// 初期状態を生成するユーティリティ関数
const createInitialAgentState = (id?: string): AgentConfig => {
  return {
    id: id || '',
    name: '',
    mcpServers: [],
    purpose: '',
    description: '',
    instructions: '',
    createdAt: Date.now(),
    updatedAt: Date.now(),
    toolPermissions: {},
    autoExecuteTool: true,
  };
};

// AgentConfigの型から'id'を除いた型を定義
type AgentConfigWithoutId = Omit<AgentConfig, 'id'>;

const AgentCreate: React.FC = () => {
    const { t } = useTranslation();
    const navigate = useNavigate();
    const { id } = useParams();

    // 現在のエージェントの状態（編集中の値）- ユーティリティ関数を使用して初期化
    const [currentAgent, setCurrentAgent] = useState<AgentConfig>(() => createInitialAgentState(id));
    
    // Auto-save related states and refs
    const autoSaveTimerRef = useRef<number | null>(null);
    const [autoSaveEnabled, setAutoSaveEnabled] = useState(true);
    const AUTO_SAVE_INTERVAL = 3000; // 3秒ごとに自動保存

    const [isSaving, setIsSaving] = useState(false);
    
    // Deploy dialog state
    const [isDeployDialogOpen, setIsDeployDialogOpen] = useState(false);
    const [deployLink, setDeployLink] = useState('');
    const [deployDescription, setDeployDescription] = useState('');
    const [isPublicDeploy, setIsPublicDeploy] = useState(true);
    const [isDeployingAgent, setIsDeployingAgent] = useState(false);
    
    // Delete dialog state
    const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
    const [isDeleting, setIsDeleting] = useState(false);
    
    // Test state - For displaying the AgentChatPlayground side panel
    const [showTestPanel, setShowTestPanel] = useState(false);

    // Saved state is the state of the agent at the last save point
    // Used to track changes made since last save
    const [savedAgent, setSavedAgent] = useState<AgentConfig | null>(null);

    // AgentSettingsFormに渡すためのsetAgent関数を作成
    const setAgentWithoutId = useCallback((value: React.SetStateAction<AgentConfigWithoutId>) => {
        setCurrentAgent(current => {
            const id = current.id;
            
            if (typeof value === 'function') {
                // current から id を除いたオブジェクトを作成
                const { id: _id, ...rest } = current;
                // 関数を適用して新しい状態を取得
                const newStateWithoutId = value(rest);
                // id を復元して返す
                return { ...newStateWithoutId, id };
            } else {
                // オブジェクトの場合は直接マージして id を保持
                return { ...value, id };
            }
        });
    }, []);
    
    // AgentChatPlaygroundからの部分更新用
    const updateAgentFromPlayground = useCallback((updates: Partial<AgentConfig>) => {
        setCurrentAgent(current => ({
            ...current,
            ...updates,
        }));
    }, []);

    // Check if there are changes to save
    const hasChanges = useCallback(() => {
        if (!savedAgent) return false;
        
        return (
            currentAgent.name !== savedAgent.name ||
            currentAgent.purpose !== savedAgent.purpose ||
            currentAgent.description !== savedAgent.description ||
            currentAgent.instructions !== savedAgent.instructions ||
            !arraysEqual(currentAgent.mcpServers, savedAgent.mcpServers) ||
            JSON.stringify(currentAgent.toolPermissions) !== JSON.stringify(savedAgent.toolPermissions)
        );
    }, [currentAgent, savedAgent]);
    
    // Helper function to compare arrays
    const arraysEqual = (a: any[], b: any[]) => {
        if (a.length !== b.length) return false;
        const sortedA = [...a].sort();
        const sortedB = [...b].sort();
        return sortedA.every((val, idx) => val === sortedB[idx]);
    };
    
    // 保存処理を共通化するユーティリティ関数
    const saveAgentData = useCallback(async (agentData: AgentConfig): Promise<boolean> => {
        if (!id) return false;
        
        try {
            const updatedAgent = await window.electronAPI.updateAgent(id, agentData);
            // 更新されたエージェントデータを使用して状態を更新
            setCurrentAgent(updatedAgent);
            // 保存した状態を記録
            const snapshot = createAgentSnapshot(updatedAgent);
            setSavedAgent(snapshot);
            
            return true;
        } catch (error) {
            console.error('Failed to save agent:', error);
            return false;
        }
    }, [id]);
    
    // 自動保存の処理
    const handleAutoSave = useCallback(async () => {
        if (!hasChanges() || !id || !currentAgent.name || !autoSaveEnabled) return;
        
        setIsSaving(true);
        
        try {
            // 現在の状態を保存用のオブジェクトにまとめる
            const agentToSave = {
                ...currentAgent
            };
            
            await saveAgentData(agentToSave);
        } catch (error) {
            console.error('Failed to auto-save agent:', error);
            // 自動保存エラーは静かに処理する（UI通知なし）
        } finally {
            setIsSaving(false);
        }
    }, [currentAgent, hasChanges, id, autoSaveEnabled, saveAgentData]);
    
    // 自動保存タイマーの設定
    useEffect(() => {
        // 変更がある場合のみ自動保存タイマーを設定
        if (hasChanges() && autoSaveEnabled && id) {
            // 既存のタイマーをクリア
            if (autoSaveTimerRef.current !== null) {
                clearInterval(autoSaveTimerRef.current);
            }
            
            // 新しいタイマーを設定
            autoSaveTimerRef.current = window.setInterval(handleAutoSave, AUTO_SAVE_INTERVAL);
            
            // クリーンアップ関数
            return () => {
                if (autoSaveTimerRef.current !== null) {
                    clearInterval(autoSaveTimerRef.current);
                    autoSaveTimerRef.current = null;
                }
            };
        } else if (autoSaveTimerRef.current !== null) {
            // 変更がない場合は既存のタイマーをクリア
            clearInterval(autoSaveTimerRef.current);
            autoSaveTimerRef.current = null;
        }
    }, [hasChanges, autoSaveEnabled, handleAutoSave, id]);
    
    // コンポーネントがアンマウントされる際にタイマーをクリーンアップ
    useEffect(() => {
        return () => {
            if (autoSaveTimerRef.current !== null) {
                clearInterval(autoSaveTimerRef.current);
                autoSaveTimerRef.current = null;
            }
        };
    }, []);

    // エージェントのデプロイ
    const handleDeployAgentDialog = () => {
        if (!id) return;

        // デプロイ前のバリデーション
        if (!currentAgent.name.trim()) {
            toast.error(t('agents.errors.nameRequired'));
            return;
        }
        
        if (!currentAgent.purpose.trim()) {
            toast.error(t('agents.errors.purposeRequired'));
            return;
        }
        
        if (!currentAgent.instructions.trim()) {
            toast.error(t('agents.errors.instructionsRequired'));
            return;
        }

        setDeployDescription(currentAgent.description || currentAgent.purpose);
        setDeployLink('');
        setIsPublicDeploy(true);
        setIsDeployDialogOpen(true);
    };

    const confirmDeployAgent = async () => {
        if (!id) return;

        // デプロイ前の最終バリデーション
        if (!currentAgent.name.trim()) {
            toast.error(t('agents.errors.nameRequired'));
            return;
        }
        
        if (!currentAgent.purpose.trim()) {
            toast.error(t('agents.errors.purposeRequired'));
            return;
        }
        
        if (!currentAgent.instructions.trim()) {
            toast.error(t('agents.errors.instructionsRequired'));
            return;
        }
        
        if (!deployDescription.trim()) {
            toast.error(t('agents.errors.descriptionRequired'));
            return;
        }

        setIsDeployingAgent(true);
        try {
            // 説明文を更新
            const updatedConfig = {
                ...currentAgent,
                description: deployDescription
            };
            
            // エージェントを更新
            const updated = await window.electronAPI.updateAgent(id, updatedConfig);
            if (updated) {
                setCurrentAgent(updated);
                const snapshot = createAgentSnapshot(updated);
                setSavedAgent(snapshot);
                
                // デプロイ処理
                if (isPublicDeploy) {
                    // 公開デプロイの場合
                    // 1. まず共有リンクを生成
                    const link = await window.electronAPI.shareAgent(id);
                    setDeployLink(link);
                    
                    // 2. 共有されたエージェントを自分のローカルにインポート
                    try {
                        await window.electronAPI.importAgent(link);
                        toast.success(t('agents.success.deployedAndImported', { name: currentAgent.name }));
                    } catch (importError) {
                        console.error('Failed to import shared agent:', importError);
                        // インポートに失敗してもデプロイ自体は成功とする
                        toast.success(t('agents.success.deployed', { name: currentAgent.name }));
                    }
                } else {
                    // 非公開デプロイの場合はデプロイのみ実行
                    await window.electronAPI.deployAgent(id);
                    toast.success(t('agents.success.deployed', { name: currentAgent.name }));
                    setIsDeployDialogOpen(false);
                }
            } else {
                throw new Error('エージェントの更新に失敗しました');
            }
        } catch (error) {
            console.error('Failed to deploy agent:', error);
            toast.error(t('agents.errors.deployFailed'));
        } finally {
            setIsDeployingAgent(false);
        }
    };
    

    // テスト機能：AgentChatPlaygroundを並べて表示
    const handleTestAgent = () => {
        // まず未保存の変更があれば保存してからテスト
        if (hasChanges()) {
            handleSaveAgent().then(() => {
                setShowTestPanel(true);
            });
        } else {
            setShowTestPanel(true);
        }
    };

    // テストパネルを閉じる
    const handleCloseTestPanel = () => {
        setShowTestPanel(false);
    };
    
    // デプロイコードのコピー
    const handleCopyDeployCode = () => {
        navigator.clipboard.writeText(deployLink);
        toast.success(t('agents.success.codeCopied'));
    };
    
    // エージェントの削除
    const handleDeleteAgent = async () => {
        if (!id) return;
        
        setIsDeleting(true);
        try {
            await window.electronAPI.deleteAgent(id);
            toast.success(t('agents.success.deleted'));
            navigate('/agents/build');
        } catch (error) {
            console.error('Failed to delete agent:', error);
            toast.error(t('agents.errors.deleteFailed'));
        } finally {
            setIsDeleting(false);
            setIsDeleteDialogOpen(false);
        }
    };

    // エージェントデータの取得
    const fetchAgentData = useCallback(async () => {
        try {
            const fetchedAgent = await window.electronAPI.getAgent(id);            
            if (fetchedAgent) {
                // 取得したエージェントデータで状態を更新
                setCurrentAgent(fetchedAgent);
                setSavedAgent({...fetchedAgent});
            } else {
                toast.error(t('agents.errors.agentNotFound'));
                navigate('/agents/build');
            }
        } catch (error) {
            console.error('Failed to fetch agent data:', error);
            toast.error(t('agents.errors.fetchFailed'));
            navigate('/agents/build');
        }
    }, [id, navigate, t]);
    
    // 初期データ読み込み
    useEffect(() => {
        fetchAgentData();
    }, [fetchAgentData]);
    
    // エージェントの保存
    const handleSaveAgent = async () => {
        if (!currentAgent.name) {
            toast.error(t('agents.errors.nameRequired'));
            return false;
        }
        
        setIsSaving(true);
        
        try {
            // 現在の状態を保存用のオブジェクトにまとめる
            const agentToSave = {
                ...currentAgent
            };
            
            const success = await saveAgentData(agentToSave);
            
            if (success) {
                toast.success(t('agents.success.updated', { name: currentAgent.name }));
                return true;
            } else {
                toast.error(t('agents.errors.updateFailed'));
                return false;
            }
        } catch (error) {
            console.error('Failed to save agent:', error);
            toast.error(t('agents.errors.updateFailed'));
            return false;
        } finally {
            setIsSaving(false);
        }
    };
    
    // 自動保存の切り替え
    const toggleAutoSave = () => {
        setAutoSaveEnabled(prev => !prev);
    };
    
    return (
        <div className="container">
            {/* ブレッドクラムナビゲーション */}
            <Breadcrumb className="mb-6">
                <BreadcrumbList>
                    <BreadcrumbItem>
                        <BreadcrumbLink asChild>
                            <Link to="/agents/build">{t('agents.build')}</Link>
                        </BreadcrumbLink>
                    </BreadcrumbItem>
                    <BreadcrumbSeparator />
                    <BreadcrumbItem>
                        <BreadcrumbPage>{t('agents.editAgent')}</BreadcrumbPage>
                    </BreadcrumbItem>
                </BreadcrumbList>
            </Breadcrumb>

            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-2xl font-bold">{t('agents.editAgent')}</h1>
                </div>
                <div className="flex gap-2 items-center">
                    {/* 自動保存の状態表示 */}
                    <div className="text-sm text-muted-foreground flex items-center mr-2">
                        {t('agents.autoSave')}
                        <Switch 
                            checked={autoSaveEnabled} 
                            onCheckedChange={toggleAutoSave} 
                            className="ml-2"
                        />
                    </div>
                    
                    {/* テストボタンを追加 */}
                    {id && (
                        <Tooltip>
                            <TooltipTrigger asChild>
                                <Button
                                    variant="outline"
                                    onClick={handleTestAgent}
                                    disabled={showTestPanel}
                                >
                                    <PlayCircle className="h-4 w-4" />
                                </Button>
                            </TooltipTrigger>
                            <TooltipContent>
                                {t('common.test')}
                            </TooltipContent>
                        </Tooltip>
                    )}

                    {id && (
                        <>
                            <Tooltip>
                                <TooltipTrigger asChild>
                                    <Button 
                                        variant="outline" 
                                        onClick={handleDeployAgentDialog}
                                    >
                                        <Rocket className="h-4 w-4" />
                                    </Button>
                                </TooltipTrigger>
                                <TooltipContent>
                                    {t('agents.deploy')}
                                </TooltipContent>
                            </Tooltip>
                            <Tooltip>
                                <TooltipTrigger asChild>
                                    <Button 
                                        variant="destructive" 
                                        onClick={() => setIsDeleteDialogOpen(true)}
                                    >
                                        <Trash2 className="h-4 w-4" />
                                    </Button>
                                </TooltipTrigger>
                                <TooltipContent>
                                    {t('common.delete')}
                                </TooltipContent>
                            </Tooltip>
                        </>
                    )}
                    <Tooltip>
                        <TooltipTrigger asChild>
                            <Button 
                                onClick={handleSaveAgent} 
                                disabled={isSaving || !hasChanges()}
                            >
                                <Save className="h-4 w-4" />
                            </Button>
                        </TooltipTrigger>
                        <TooltipContent>
                            {t('common.save')}
                        </TooltipContent>
                    </Tooltip>
                </div>
            </div>
            
            {/* テストパネルが表示されているときは分割表示、そうでなければ設定のみ表示 */}
            {showTestPanel ? (
                <ResizablePanelGroup 
                    direction="horizontal" 
                    className="h-[calc(100vh)]"
                >
                    {/* 左側: チャットエリア (プレイグラウンド) */}
                    <ResizablePanel defaultSize={50} minSize={30}>
                        <AgentChatPlayground 
                            agent={currentAgent}
                            onCloseTest={handleCloseTestPanel}
                            onUpdateAgent={(updatedAgent) => {
                                // 部分的な更新を処理
                                updateAgentFromPlayground(updatedAgent);
                            }}
                        />
                    </ResizablePanel>
                    
                    {/* ハンドル */}
                    <ResizableHandle withHandle />
                    
                    {/* 右側: 設定エリア */}
                    <ResizablePanel defaultSize={50} minSize={30}>
                        <AgentSettingsForm 
                            agent={currentAgent}
                            setAgent={setAgentWithoutId}
                        />
                    </ResizablePanel>
                </ResizablePanelGroup>
            ) : (
                /* 設定エリアのみ（全幅で表示） */
                <AgentSettingsForm 
                    agent={currentAgent}
                    setAgent={setAgentWithoutId}
                />
            )}

            {/* デプロイダイアログ */}
            <Dialog open={isDeployDialogOpen} onOpenChange={setIsDeployDialogOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>{t('agents.deploy')}</DialogTitle>
                        <DialogDescription>
                            {t('agents.deployConfirmDescription')}
                        </DialogDescription>
                    </DialogHeader>

                    {deployLink === '' ? (
                        <div className="grid gap-4 py-4">
                            <div className="space-y-2">
                                <Label>{t('agents.fields.name')}</Label>
                                <div className="p-2 rounded-md bg-muted">{currentAgent.name}</div>
                            </div>
                            <div className="space-y-2">
                                <Label>{t('agents.fields.purpose')}</Label>
                                <div className="p-2 rounded-md bg-muted whitespace-pre-wrap min-h-[5rem]">{currentAgent.purpose}</div>
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="deploy-desc">{t('agents.fields.description')}</Label>
                                <Textarea
                                    id="deploy-desc"
                                    value={deployDescription}
                                    onChange={(e) => setDeployDescription(e.target.value)}
                                    rows={3}
                                />
                            </div>
                            <div className="flex items-center justify-between">
                                <div className="space-y-1">
                                    <Label htmlFor="public-deploy" className="text-sm font-medium">
                                        {t('agents.publicDeploy')}
                                    </Label>
                                </div>
                                <Switch
                                    id="public-deploy"
                                    checked={isPublicDeploy}
                                    onCheckedChange={setIsPublicDeploy}
                                />
                            </div>
                        </div>
                    ) : (
                        <div className="grid gap-4 py-4">
                            <div className="space-y-2">
                                <Label htmlFor="deploy-link">{t('agents.deployLink')}</Label>
                                <div className="flex">
                                    <Input id="deploy-link" value={deployLink} readOnly className="flex-1" />
                                    <Button variant="outline" className="ml-2" onClick={handleCopyDeployCode}>
                                        {t('agents.copy')}
                                    </Button>
                                </div>
                            </div>
                        </div>
                    )}

                    <DialogFooter>
                        {deployLink === '' ? (
                            <>
                                <Button variant="outline" onClick={() => setIsDeployDialogOpen(false)} disabled={isDeployingAgent}>
                                    {t('common.cancel')}
                                </Button>
                                <Button onClick={confirmDeployAgent} disabled={isDeployingAgent} className="gap-2">
                                    {isDeployingAgent && <RefreshCw className="h-4 w-4 animate-spin" />}
                                    {t('agents.deploy')}
                                </Button>
                            </>
                        ) : (
                            <Button onClick={() => setIsDeployDialogOpen(false)}>{t('common.close')}</Button>
                        )}
                    </DialogFooter>
                </DialogContent>
            </Dialog>
            
            {/* 削除確認ダイアログ */}
            <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle className="text-center text-xl font-bold text-destructive">
                            {t('agents.confirmDelete', { name: currentAgent.name })}
                        </DialogTitle>
                        <DialogDescription className="text-center">
                            {t('agents.deleteWarning')}
                        </DialogDescription>
                    </DialogHeader>
                    
                    <DialogFooter className="sm:justify-between gap-3">
                        <Button 
                            variant="outline" 
                            onClick={() => setIsDeleteDialogOpen(false)}
                            disabled={isDeleting}
                            className="sm:w-32"
                        >
                            {t('common.cancel')}
                        </Button>
                        <Button 
                            variant="destructive"
                            onClick={handleDeleteAgent}
                            disabled={isDeleting}
                            className="gap-2 sm:w-32"
                        >
                            {isDeleting ? (
                                <>
                                    <RefreshCw className="h-4 w-4 animate-spin" />
                                    {t('agents.deleting')}
                                </>
                            ) : (
                                <>
                                    <Trash2 className="h-4 w-4" />
                                    {t('common.delete')}
                                </>
                            )}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
};

export default AgentCreate;
