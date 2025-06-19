import React, { useEffect, useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { RequestLogEntry } from '../../../lib/types/log-types';
import { useFilterState } from './hooks/useFilterState';
import { useRequestLogs } from './hooks/useRequestLogs';
import LogTable from './components/LogTable';
import LogDetailModal from './components/LogDetailModal';
import ToolCallTimeline from './components/ToolCallTimeline';
import { Card } from '@/components/ui/card';

interface LogViewerProps {
  serverId?: string; // 特定のサーバのみ表示する場合は指定、なければすべてのサーバ
  initialLimit?: number;
}

const LogViewer: React.FC<LogViewerProps> = ({ serverId, initialLimit = 50 }) => {
  const { t } = useTranslation();
  // Filter state management
  const {
    filters,
    setShowFilters,
    setDateRange,
    setRequestType,
    setResponseStatus,
    setPagination,
    clearFilters,
    refresh
  } = useFilterState({
    limit: initialLimit,
  });

  // Request log data
  const {
    logs,
    total,
    loading,
    fetchLogs
  } = useRequestLogs({
    serverId: serverId,
    clientId: filters.selectedClientId,
    startDate: filters.startDate,
    endDate: filters.endDate,
    requestType: filters.requestType,
    responseStatus: filters.responseStatus,
    offset: filters.offset,
    limit: filters.limit,
    refreshTrigger: filters.refreshTrigger, // Add refreshTrigger to dependencies
  });

  // State for selected log, available request types, background refresh, and data tracking
  const [selectedLog, setSelectedLog] = useState<RequestLogEntry | null>(null);
  const [lastDataUpdate, setLastDataUpdate] = useState<Date>(new Date());

  // Button to manually refresh data
  const handleManualRefresh = useCallback(() => {
    // Update the last refresh time indicator
    setLastDataUpdate(new Date());
    // Trigger data refresh by incrementing the refreshTrigger counter
    refresh();
  }, [refresh]);
  
  // Update last refresh time whenever logs change
  useEffect(() => {
    if (logs && logs.length > 0) {
      setLastDataUpdate(new Date());
    }
  }, [logs]);


  return (
    <div className="p-4 flex flex-col h-full">

      {/* Status indicator showing last refresh time with refresh button */}
      <div className="flex justify-end items-center text-sm text-muted-foreground mb-2 gap-2">
        <button 
          onClick={handleManualRefresh}
          className="px-2 py-1 bg-primary/10 hover:bg-primary/20 rounded text-primary text-xs transition-colors"
          aria-label={t('logs.viewer.refresh')}
        >
          {t('logs.viewer.refresh')}
        </button>
        <span>{t('logs.viewer.lastUpdated')}: {lastDataUpdate.toLocaleTimeString()}</span>
      </div>

      {total === 0 ? (
        <div className="flex-1 flex items-center justify-center">
          <Card className="p-8 max-w-2xl w-full shadow-lg text-center">
            <Link to="/discover" className="px-6 py-3 rounded-md font-medium text-primary inline-block">
              <h2 className="text-2xl font-bold mb-4">{t('home.discovery.title')}</h2>
              <p className="mb-6">{t('home.discovery.description')}</p>
            </Link>
          </Card>
        </div>
      ) : (
        <div className="flex flex-col space-y-6">
          {/* Tool call timeline */}
          <ToolCallTimeline
            logs={logs}
            loading={loading}
            onSelectLog={setSelectedLog}
          />

          {/* Request log table */}
          <LogTable
            logs={logs}
            total={total}
            loading={loading}
            offset={filters.offset}
            limit={filters.limit}
            onSelectLog={setSelectedLog}
            onPageChange={(newOffset) => setPagination(newOffset)}
            onLimitChange={(newLimit) => setPagination(filters.offset, newLimit)}
          />
        </div>
      )}

      {/* Log detail modal */}
      {selectedLog && (
        <LogDetailModal
          log={selectedLog}
          onClose={() => setSelectedLog(null)}
        />
      )}
    </div>
  );
};

export default LogViewer;
