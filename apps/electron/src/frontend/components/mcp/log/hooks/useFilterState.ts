import { useState, useCallback } from "react";

// Interface for filter state
interface FilterState {
  showFilters: boolean;
  startDate?: Date;
  endDate?: Date;
  requestType: string;
  responseStatus: string;
  cursor?: string;
  limit: number;
  selectedClientId?: string;
  selectedClientName?: string;
  refreshTrigger: number;
  currentPage: number; // Track current page for UI
}

// Default filter values
const defaultFilters: FilterState = {
  showFilters: false,
  startDate: new Date(Date.now() - 24 * 60 * 60 * 1000 * 7), // 7 days ago
  endDate: new Date(),
  requestType: "",
  responseStatus: "",
  cursor: undefined,
  limit: 50,
  selectedClientId: undefined,
  selectedClientName: undefined,
  refreshTrigger: 0,
  currentPage: 1,
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
    setState((prev) => ({ ...prev, showFilters: show }));
  }, []);

  // Set date range
  const setDateRange = useCallback((startDate?: Date, endDate?: Date) => {
    setState((prev) => ({ ...prev, startDate, endDate }));
  }, []);

  // Set request type
  const setRequestType = useCallback((requestType: string) => {
    setState((prev) => ({
      ...prev,
      requestType,
      cursor: undefined,
      currentPage: 1,
    }));
  }, []);

  // Set response status
  const setResponseStatus = useCallback((responseStatus: string) => {
    setState((prev) => ({
      ...prev,
      responseStatus,
      cursor: undefined,
      currentPage: 1,
    }));
  }, []);

  // Set pagination
  const setPagination = useCallback(
    (cursor?: string, limit?: number, page?: number) => {
      setState((prev) => ({
        ...prev,
        cursor,
        limit: limit !== undefined ? limit : prev.limit,
        currentPage: page !== undefined ? page : prev.currentPage,
      }));
    },
    [],
  );

  // Set client selection
  const setSelectedClient = useCallback(
    (clientId?: string, clientName?: string) => {
      setState((prev) => ({
        ...prev,
        selectedClientId: clientId,
        selectedClientName: clientName,
        cursor: undefined,
        currentPage: 1,
      }));
    },
    [],
  );

  // Clear all filters
  const clearFilters = useCallback(() => {
    setState((prev) => ({
      ...prev,
      requestType: "",
      responseStatus: "",
      startDate: new Date(Date.now() - 24 * 60 * 60 * 1000),
      endDate: new Date(),
      cursor: undefined,
      currentPage: 1,
    }));
  }, []);

  // Trigger a refresh
  const refresh = useCallback(() => {
    setState((prev) => ({ ...prev, refreshTrigger: prev.refreshTrigger + 1 }));
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
