import React, { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { formatDateI18n } from '../../../../lib/utils/date-utils';
import { RequestLogEntry } from '../../../../lib/types/log-types';
import { Card } from '@/components/ui/card';

interface ToolCallTimelineProps {
  logs: RequestLogEntry[];
  loading: boolean;
  onSelectLog: (log: RequestLogEntry) => void;
}

interface ToolCallGroup {
  serverId: string;
  serverName: string;
  toolName: string;
  timestamp: number; // timestamp of the latest call in the group
  count: number;
  logs: RequestLogEntry[];
  successCount: number;
  errorCount: number;
}

// 30分間隔のキーを生成する（例："14:00", "14:30"）
const getHalfHourIntervalKey = (timestamp: number): string => {
  const date = new Date(timestamp);
  const hours = date.getHours();
  const minutes = date.getMinutes() < 30 ? 0 : 30;
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
};

const ToolCallTimeline: React.FC<ToolCallTimelineProps> = ({
  logs,
  loading,
  onSelectLog,
}) => {
  const { t } = useTranslation();

  // Filter logs to only include CallTool requests and group them
  const groupedToolCalls = useMemo(() => {
    if (!logs || logs.length === 0) return [];

    // Filter to only include CallTool requests
    const toolCalls = logs.filter(log => 
      log.requestType === 'CallTool' && 
      log.requestParams && 
      log.requestParams.toolName
    );

    // Group by date (YYYY-MM-DD), ensuring local date is used
    const byDate = toolCalls.reduce<Record<string, RequestLogEntry[]>>((acc, log) => {
      // Use local date to avoid timezone issues
      const logDate = new Date(log.timestamp);
      const year = logDate.getFullYear();
      const month = logDate.getMonth(); // 0-based
      const day = logDate.getDate();
      
      // Create a local date-only string as the key (YYYY-MM-DD format)
      const dateKey = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      
      if (!acc[dateKey]) {
        acc[dateKey] = [];
      }
      acc[dateKey].push(log);
      return acc;
    }, {});

    // For each date, group by 30-minute intervals and then by server and tool
    return Object.entries(byDate).map(([date, dateLogs]) => {
      // First group by 30-minute intervals
      const byInterval = dateLogs.reduce<Record<string, RequestLogEntry[]>>((acc, log) => {
        const intervalKey = getHalfHourIntervalKey(log.timestamp);
        
        if (!acc[intervalKey]) {
          acc[intervalKey] = [];
        }
        acc[intervalKey].push(log);
        return acc;
      }, {});
      
      // For each interval, group by server and tool
      const intervals = Object.entries(byInterval).map(([interval, intervalLogs]) => {
        // Group by server and tool
        const groups: Record<string, ToolCallGroup> = {};
        
        intervalLogs.forEach(log => {
          const toolName = log.requestParams.toolName;
          const key = `${log.serverId}_${toolName}`;
          
          if (!groups[key]) {
            groups[key] = {
              serverId: log.serverId,
              serverName: log.serverName,
              toolName,
              timestamp: log.timestamp,
              count: 0,
              logs: [],
              successCount: 0,
              errorCount: 0
            };
          }
          
          // Update group data
          groups[key].count += 1;
          groups[key].logs.push(log);
          
          // Track success/error counts
          if (log.responseStatus === 'success') {
            groups[key].successCount += 1;
          } else {
            groups[key].errorCount += 1;
          }
          
          // Update timestamp to the latest one
          if (log.timestamp > groups[key].timestamp) {
            groups[key].timestamp = log.timestamp;
          }
        });
        
        // Convert to array and sort by timestamp (latest first)
        const sortedGroups = Object.values(groups).sort((a, b) => b.timestamp - a.timestamp);
        
        return {
          interval,
          groups: sortedGroups
        };
      }).sort((a, b) => b.interval.localeCompare(a.interval)); // Sort intervals newest first
      
      return {
        date,
        intervals
      };
    }).sort((a, b) => b.date.localeCompare(a.date)); // Sort dates newest first
  }, [logs]);

  if (loading) {
    return (
      <Card className="flex justify-center items-center h-64 p-6">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary"></div>
      </Card>
    );
  }

  if (groupedToolCalls.length === 0) {
    return (
      <Card className="flex justify-center items-center h-64 text-muted-foreground p-6">
        <div className="flex flex-col items-center">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-16 w-16 mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
          </svg>
          <div className="text-lg font-medium">{t('logs.viewer.noToolCalls')}</div>
        </div>
      </Card>
    );
  }

  return (
    <Card className="p-4 overflow-auto">
      <div className="flex justify-between items-center mb-3">
        <div className="flex items-center gap-2">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="w-5 h-5 mr-1"
            viewBox="0 0 24 24"
            strokeWidth="2"
            stroke="currentColor"
            fill="none"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path stroke="none" d="M0 0h24v24H0z" fill="none"/>
            <path d="M10.325 4.317c.426 -1.756 2.924 -1.756 3.35 0a1.724 1.724 0 0 0 2.573 1.066c1.543 -.94 3.31 .826 2.37 2.37a1.724 1.724 0 0 0 1.065 2.572c1.756 .426 1.756 2.924 0 3.35a1.724 1.724 0 0 0 -1.066 2.573c.94 1.543 -.826 3.31 -2.37 2.37a1.724 1.724 0 0 0 -2.572 1.065c-.426 1.756 -2.924 1.756 -3.35 0a1.724 1.724 0 0 0 -2.573 -1.066c-1.543 .94 -3.31 -.826 -2.37 -2.37a1.724 1.724 0 0 0 -1.065 -2.572c-1.756 -.426 -1.756 -2.924 0 -3.35a1.724 1.724 0 0 0 1.066 -2.573c-.94 -1.543 .826 -3.31 2.37 -2.37c1 .608 2.296 .07 2.572 -1.065z" />
            <path d="M12 12m-3 0a3 3 0 1 0 6 0a3 3 0 1 0 -6 0" />
          </svg>
          <h3 className="text-lg font-medium">
            {t('logs.viewer.toolCallsTitle')}
          </h3>
        </div>
      </div>

      <div className="space-y-6">
        {groupedToolCalls.map(({ date, intervals }) => (
          <div key={date} className="mb-6">
            <h3 className="text-md font-medium py-2 px-3 bg-muted rounded-md mb-3">
              {new Date(date).toLocaleDateString(t('locale'), { 
                month: 'long', 
                day: 'numeric' 
              })}
            </h3>
            <div className="space-y-4">
              {intervals.map(({ interval, groups }) => (
                <div key={`${date}_${interval}`} className="mb-4">
                  <h4 className="text-sm font-medium py-1 px-3 bg-muted/50 rounded-md mb-2 ml-2">
                    {interval}
                  </h4>
                  <div className="space-y-3 pl-4">
                    {groups.map((group) => (
                      <div 
                        key={`${group.serverId}_${group.toolName}_${group.timestamp}`}
                        className="border rounded-md p-3 hover:bg-muted/30 cursor-pointer transition-colors"
                        onClick={() => onSelectLog(group.logs[0])}
                      >
                        <div className="flex justify-between items-start">
                          <div>
                            <div className="font-medium text-md flex items-center">
                              <span className="text-primary mr-2">🛠️</span>
                              <span className="text-primary">{group.toolName}</span>
                            </div>
                            <div className="text-sm text-muted-foreground mt-1">
                              {group.serverName}
                            </div>
                          </div>
                          <div className="text-sm text-muted-foreground">
                            {formatDateI18n(new Date(group.timestamp), t, 'shortDateTime')}
                          </div>
                        </div>
                        
                        <div className="mt-2 text-sm">
                          <span className="text-muted-foreground">
                            {t('logs.viewer.callCount', { 
                              count: group.count,
                              defaultValue: '{{count}}回の呼び出し'
                            })}
                          </span>
                          {group.successCount > 0 && (
                            <span className="ml-2 text-green-600 dark:text-green-500">
                              {t('logs.viewer.successCount', { 
                                count: group.successCount,
                                defaultValue: '成功: {{count}}'
                              })}
                            </span>
                          )}
                          {group.errorCount > 0 && (
                            <span className="ml-2 text-destructive">
                              {t('logs.viewer.errorCount', { 
                                count: group.errorCount,
                                defaultValue: '失敗: {{count}}'
                              })}
                            </span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
};

export default ToolCallTimeline;
