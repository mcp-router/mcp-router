import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '../ui/button';
import { Skeleton } from '../ui/skeleton';
import { Clipboard, CheckCircle2, Users, TrendingUp, Sparkles, Share2, Lock } from 'lucide-react';
import { Label } from '../ui/label';
import { cn } from '@/lib/utils/tailwind-utils';
import { Badge } from '../ui/badge';
import { Alert, AlertDescription } from '../ui/alert';

interface InvitationResponse {
  success: boolean;
  code: string;
  maxUses: number;
  usedCount: number;
  remainingUses: number;
  isValid: boolean;
  createdAt: string;
}

interface InvitationCodeProps {
  className?: string;
  isLoggedIn?: boolean;
}

export const InvitationCode: React.FC<InvitationCodeProps> = ({ className, isLoggedIn = false }) => {
  const { t } = useTranslation();
  const [invitation, setInvitation] = useState<InvitationResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const fetchInvitation = async () => {
    if (!isLoggedIn) {
      setError("loginRequired");
      return;
    }
    
    setLoading(true);
    setError(null);
    
    try {
      // Use the Electron API to get an invitation
      const data = await window.electronAPI.fetchInvitation();
      
      if (data.success) {
        setInvitation(data);
      } else {
        setInvitation(null);
        if (data.error) {
          setError(data.error);
        } else {
          setError(t('invitation.fetchError'));
        }
      }
    } catch (err) {
      setError(t('invitation.fetchError'));
      setInvitation(null);
    } finally {
      setLoading(false);
    }
  };

  const copyInvitationCode = () => {
    if (invitation?.code) {
      navigator.clipboard.writeText(`https://mcp-router.net/invite?code=${invitation.code}`);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  // Helper function to get the background color class based on usage ratio
  const getProgressBgColor = (ratio: number) => {
    if (ratio <= 0.25) return "bg-muted";
    if (ratio <= 0.5) return "bg-blue-100 dark:bg-blue-950/20"; 
    if (ratio <= 0.75) return "bg-indigo-100 dark:bg-indigo-950/20";
    return "bg-purple-100 dark:bg-purple-950/20";
  };

  // Helper function to get the indicator color class based on usage ratio
  const getProgressIndicatorColor = (ratio: number) => {
    if (ratio <= 0.25) return "bg-muted-foreground";
    if (ratio <= 0.5) return "bg-blue-500";
    if (ratio <= 0.75) return "bg-indigo-500";
    return "bg-purple-500";
  };

  // Get icon based on usage
  const getUsageIcon = (usedCount: number, maxUses: number) => {
    const ratio = usedCount / maxUses;
    
    if (ratio === 0) return <TrendingUp size={16} className="text-muted-foreground" />;
    if (ratio <= 0.25) return <TrendingUp size={16} className="text-blue-500" />;
    if (ratio <= 0.5) return <Share2 size={16} className="text-indigo-500" />;
    if (ratio <= 0.75) return <TrendingUp size={16} className="text-purple-500" />;
    if (ratio < 1) return <Sparkles size={16} className="text-amber-500" />;
    return <Sparkles size={16} className="text-amber-500 animate-pulse" />;
  };

  useEffect(() => {
    if (isLoggedIn) {
      fetchInvitation();
    }
  }, [isLoggedIn]);

  return (
    <div className={className}>
      <div className="space-y-4">
        <Label className="mb-1 block">{t('invitation.title')}</Label>
        
        {!isLoggedIn ? (
          <Alert className="bg-slate-50 dark:bg-slate-900">
            <Lock className="h-4 w-4" />
            <AlertDescription>
              {t('invitation.pleaseLogin')}
            </AlertDescription>
          </Alert>
        ) : loading ? (
          <div className="space-y-2">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-6 w-32" />
          </div>
        ) : error ? (
          <div className="text-red-500">{error}</div>
        ) : invitation ? (
          <div className="space-y-2">
            <div className="flex items-center space-x-2">
              <div className="flex-1 bg-secondary p-2 rounded-md font-mono text-sm break-all">
                https://mcp-router.net/invite?code={invitation.code}
              </div>
              <Button 
                size="icon" 
                variant="outline" 
                onClick={copyInvitationCode} 
                title="Copy code"
              >
                {copied ? <CheckCircle2 size={18} /> : <Clipboard size={18} />}
              </Button>
            </div>
            <div className="mt-4 space-y-2">
              <div className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-1.5">
                  {getUsageIcon(invitation.usedCount, invitation.maxUses)}
                </div>
                <Badge 
                  variant={invitation.usedCount / invitation.maxUses >= 1 ? "default" : "outline"}
                  className={cn("transition-all", {
                    "border-border text-muted-foreground": invitation.usedCount / invitation.maxUses <= 0.25,
                    "border-blue-200 text-blue-700 dark:border-blue-800 dark:text-blue-300": invitation.usedCount / invitation.maxUses > 0.25 && invitation.usedCount / invitation.maxUses <= 0.5,
                    "border-indigo-200 text-indigo-700 dark:border-indigo-800 dark:text-indigo-300": invitation.usedCount / invitation.maxUses > 0.5 && invitation.usedCount / invitation.maxUses <= 0.75,
                    "border-purple-200 text-purple-700 dark:border-purple-800 dark:text-purple-300": invitation.usedCount / invitation.maxUses > 0.75 && invitation.usedCount / invitation.maxUses < 1,
                    "bg-amber-500 border-amber-500 text-white": invitation.usedCount / invitation.maxUses >= 1,
                  })}
                >
                  {invitation.usedCount} / {invitation.maxUses}
                </Badge>
              </div>
              <div className={cn(
                "relative h-3 w-full overflow-hidden rounded-full", 
                getProgressBgColor(invitation.usedCount / invitation.maxUses)
              )}>
                <div 
                  className={cn(
                    "h-full absolute top-0 left-0 transition-all", 
                    getProgressIndicatorColor(invitation.usedCount / invitation.maxUses),
                    { "animate-pulse": invitation.usedCount / invitation.maxUses >= 1 }
                  )}
                  style={{ width: `${(invitation.usedCount / invitation.maxUses) * 100}%` }}
                />
                {[...Array(5)].map((_, i) => (
                  invitation.usedCount / invitation.maxUses > (i+1)/5 && 
                  <div 
                    key={i} 
                    className={cn(
                      "absolute top-0 h-full w-0.5 bg-background/40 transform transition-opacity",
                      { "animate-pulse": invitation.usedCount / invitation.maxUses >= 1 }
                    )} 
                    style={{left: `${(i+1)*20}%`}}
                  />
                ))}
              </div>
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>0</span>
                <div className="flex items-center gap-1">
                  <Users size={14} className={cn(
                    "transition-colors",
                    invitation.usedCount / invitation.maxUses >= 1 ? "text-amber-500" : "text-muted-foreground"
                  )} />
                  <span className={cn(
                    invitation.usedCount / invitation.maxUses >= 1 ? "text-amber-500 font-medium" : ""
                  )}>{invitation.maxUses}</span>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="space-y-4"></div>
        )}
      </div>
    </div>
  );
};
