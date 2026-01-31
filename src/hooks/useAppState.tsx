/**
 * Application State Management
 */

import React, { createContext, useContext, useReducer, useCallback, useMemo, useEffect } from 'react';
import type { 
  AppState, 
  AppAction, 
  AppContextType, 
  Service, 
  ServiceAction,
  ActionResult 
} from '../types';
import { 
  fetchAllServices, 
  filterServices, 
  sortServices, 
  performServiceAction,
  getNextSortField 
} from '../services';

// Initial state
const initialState: AppState = {
  services: [],
  loading: true,
  error: null,
  selectedIndex: 0,
  searchQuery: '',
  filter: {
    type: 'all',
    domain: 'all',
    status: 'all',
    showAppleServices: true,
    showProtected: true,
  },
  sort: {
    field: 'label',
    direction: 'asc',
  },
  focusedPanel: 'list',
  showHelp: false,
  showConfirm: false,
  pendingAction: null,
  lastActionResult: null,
};

// Reducer
function appReducer(state: AppState, action: AppAction): AppState {
  switch (action.type) {
    case 'SET_SERVICES':
      return { 
        ...state, 
        services: action.payload, 
        loading: false,
        selectedIndex: Math.min(state.selectedIndex, Math.max(0, action.payload.length - 1)),
      };
    
    case 'SET_LOADING':
      return { ...state, loading: action.payload };
    
    case 'SET_ERROR':
      return { ...state, error: action.payload, loading: false };
    
    case 'SELECT_INDEX':
      return { ...state, selectedIndex: action.payload };
    
    case 'SELECT_NEXT':
      return { ...state, selectedIndex: state.selectedIndex + 1 };
    
    case 'SELECT_PREV':
      return { ...state, selectedIndex: Math.max(0, state.selectedIndex - 1) };
    
    case 'SET_SEARCH':
      return { ...state, searchQuery: action.payload, selectedIndex: 0 };
    
    case 'SET_FILTER':
      return { 
        ...state, 
        filter: { ...state.filter, ...action.payload },
        selectedIndex: 0,
      };
    
    case 'SET_SORT':
      return { ...state, sort: action.payload, selectedIndex: 0 };
    
    case 'TOGGLE_SORT_DIRECTION':
      return {
        ...state,
        sort: {
          ...state.sort,
          direction: state.sort.direction === 'asc' ? 'desc' : 'asc',
        },
      };
    
    case 'CYCLE_SORT_FIELD':
      return {
        ...state,
        sort: {
          ...state.sort,
          field: getNextSortField(state.sort.field),
        },
      };
    
    case 'SET_FOCUS':
      return { ...state, focusedPanel: action.payload };
    
    case 'TOGGLE_HELP':
      return { ...state, showHelp: !state.showHelp };
    
    case 'REQUEST_ACTION':
      return { ...state, showConfirm: true, pendingAction: action.payload };
    
    case 'CONFIRM_ACTION':
      return { ...state, showConfirm: false };
    
    case 'CANCEL_ACTION':
      return { ...state, showConfirm: false, pendingAction: null };
    
    case 'SET_ACTION_RESULT':
      return { ...state, lastActionResult: action.payload, pendingAction: null };
    
    case 'REFRESH':
      return { ...state, loading: true, error: null };
    
    default:
      return state;
  }
}

// Context
export const AppContext = createContext<AppContextType | null>(null);

// Hook to use app state
export function useAppState() {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useAppState must be used within AppProvider');
  }
  return context;
}

// Provider props
interface AppProviderProps {
  children: React.ReactNode;
}

// Hook for provider logic (to be used in App component)
export function useAppProvider() {
  const [state, dispatch] = useReducer(appReducer, initialState);
  
  // Filtered and sorted services
  const filteredServices = useMemo(() => {
    const filtered = filterServices(state.services, state.filter, state.searchQuery);
    return sortServices(filtered, state.sort);
  }, [state.services, state.filter, state.searchQuery, state.sort]);
  
  // Currently selected service
  const selectedService = useMemo(() => {
    if (filteredServices.length === 0) return null;
    const index = Math.min(state.selectedIndex, filteredServices.length - 1);
    return filteredServices[index] ?? null;
  }, [filteredServices, state.selectedIndex]);
  
  // Fetch services
  const refresh = useCallback(async () => {
    dispatch({ type: 'REFRESH' });
    try {
      const services = await fetchAllServices();
      dispatch({ type: 'SET_SERVICES', payload: services });
    } catch (error) {
      dispatch({ 
        type: 'SET_ERROR', 
        payload: error instanceof Error ? error.message : 'Failed to fetch services' 
      });
    }
  }, []);
  
  // Execute action on service
  const executeAction = useCallback(async (
    action: ServiceAction, 
    service: Service
  ): Promise<ActionResult> => {
    const result = await performServiceAction(action, service);
    dispatch({ type: 'SET_ACTION_RESULT', payload: result });
    
    // Refresh services after action
    if (result.success) {
      await refresh();
    }
    
    return result;
  }, [refresh]);
  
  // Initial fetch
  useEffect(() => {
    refresh();
  }, [refresh]);
  
  const contextValue: AppContextType = {
    state,
    dispatch,
    filteredServices,
    selectedService,
    executeAction,
    refresh,
  };
  
  return contextValue;
}

// Export provider component creator
export function createAppProvider(contextValue: AppContextType) {
  return function AppProvider({ children }: AppProviderProps) {
    return (
      <AppContext.Provider value={contextValue}>
        {children}
      </AppContext.Provider>
    );
  };
}
