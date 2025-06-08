import { useState, useCallback } from 'react';

// Interface for filter state
export interface FilterState {
  showFilters: boolean;
  startDate?: Date;
  endDate?: Date;
  requestType: string;
  responseStatus: string;
  offset: number;
  limit: number;
  selectedClientId?: string;
  selectedClientName?: string;
  refreshTrigger: number;
}

// Default filter values
const defaultFilters: FilterState = {
  showFilters: false,
  startDate: new Date(Date.now() - 24 * 60 * 60 * 1000 * 7), // 7 days ago
  endDate: new Date(),
  requestType: '',
  responseStatus: '',
  offset: 0,
  limit: 50,
  selectedClientId: undefined,
  selectedClientName: undefined,
  refreshTrigger: 0,
};

/**
 * Custom hook for managing filter state
 */
export const useFilterState = (initialFilters?: Partial<FilterState>) => {
  const [state, setState] = useState<FilterState>({
    ...defaultFilters,
    ...initialFilters,
  });

  // Show/hide filters
  const setShowFilters = useCallback((show: boolean) => {
    setState(prev => ({ ...prev, showFilters: show }));
  }, []);

  // Set date range
  const setDateRange = useCallback((startDate?: Date, endDate?: Date) => {
    setState(prev => ({ ...prev, startDate, endDate }));
  }, []);

  // Set request type
  const setRequestType = useCallback((requestType: string) => {
    setState(prev => ({ ...prev, requestType, offset: 0 }));
  }, []);

  // Set response status
  const setResponseStatus = useCallback((responseStatus: string) => {
    setState(prev => ({ ...prev, responseStatus, offset: 0 }));
  }, []);

  // Set pagination
  const setPagination = useCallback((offset: number, limit?: number) => {
    setState(prev => ({ 
      ...prev, 
      offset,
      limit: limit !== undefined ? limit : prev.limit
    }));
  }, []);

  // Set client selection
  const setSelectedClient = useCallback((clientId?: string, clientName?: string) => {
    setState(prev => ({ 
      ...prev, 
      selectedClientId: clientId,
      selectedClientName: clientName,
      offset: 0
    }));
  }, []);

  // Clear all filters
  const clearFilters = useCallback(() => {
    setState(prev => ({
      ...prev,
      requestType: '',
      responseStatus: '',
      startDate: new Date(Date.now() - 24 * 60 * 60 * 1000),
      endDate: new Date(),
      offset: 0,
    }));
  }, []);

  // Trigger a refresh
  const refresh = useCallback(() => {
    setState(prev => ({ ...prev, refreshTrigger: prev.refreshTrigger + 1 }));
  }, []);

  return {
    filters: state,
    setShowFilters,
    setDateRange,
    setRequestType,
    setResponseStatus,
    setPagination,
    setSelectedClient,
    clearFilters,
    refresh,
  };
};
