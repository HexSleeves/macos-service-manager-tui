/**
 * Application State Management
 * Main hook and context provider
 */

import type React from "react";
import { createContext, useCallback, useContext, useEffect, useMemo, useReducer, useRef } from "react";
import {
	fetchAllServices,
	filterServicesWithScores,
	performServiceAction,
	sortServices,
} from "../../services";
import type { ActionResult, AppContextType, Service, ServiceAction, ServiceMatchInfo } from "../../types";
import { useAppEffects, useDebouncedSearch } from "./effects";
import { initialState } from "./initialState";
import { appReducer } from "./reducer";

// Context
export const AppContext = createContext<AppContextType | null>(null);

// Hook to use app state
export function useAppState() {
	const context = useContext(AppContext);
	if (!context) {
		throw new Error("useAppState must be used within AppProvider");
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
	const autoRefreshIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
	const offlineReconnectRef = useRef<ReturnType<typeof setInterval> | null>(null);
	const lastInteractionRef = useRef<number>(Date.now());

	// Fetch services with offline mode support
	const refresh = useCallback(async () => {
		dispatch({ type: "REFRESH" });
		lastInteractionRef.current = Date.now(); // Track manual refresh
		try {
			const services = await fetchAllServices();
			dispatch({ type: "FETCH_SUCCESS", payload: services });
		} catch (error) {
			const errorMessage = error instanceof Error ? error.message : "Failed to fetch services";
			dispatch({ type: "FETCH_FAILURE", payload: errorMessage });
		}
	}, []);

	// Silent refresh for auto-refresh (doesn't show loading state initially)
	const silentRefresh = useCallback(async () => {
		try {
			const services = await fetchAllServices();
			// On success during silent refresh, also update offline state
			dispatch({ type: "FETCH_SUCCESS", payload: services });
		} catch (error) {
			// During auto-refresh, track failures but don't show error
			const errorMessage = error instanceof Error ? error.message : "Failed to fetch services";
			dispatch({ type: "FETCH_FAILURE", payload: errorMessage });
		}
	}, []);

	// Attempt to reconnect when offline
	const attemptReconnect = useCallback(async () => {
		dispatch({ type: "RECONNECT_ATTEMPT" });
		try {
			const services = await fetchAllServices();
			dispatch({ type: "FETCH_SUCCESS", payload: services });
		} catch (_error) {
			// Still offline, just update loading state
			dispatch({ type: "SET_LOADING", payload: false });
		}
	}, []);

	// Debounce search query
	const debouncedSearchQuery = useDebouncedSearch(state.searchQuery);

	// Filtered and sorted services with match info
	const { filteredServices, serviceMatchInfo } = useMemo(() => {
		const filtered = filterServicesWithScores(state.services, state.filter, debouncedSearchQuery);

		// Build match info map
		const matchInfo = new Map<string, ServiceMatchInfo>();
		for (const item of filtered) {
			matchInfo.set(item.service.id, {
				matchScore: item.matchScore,
				matchField: item.matchField,
				matchedIndices: item.matchedIndices,
			});
		}

		// Extract just the services
		let services = filtered.map((f) => f.service);

		// When searching, fuzzy match order takes priority
		// When not searching, apply normal sort
		if (!debouncedSearchQuery) {
			services = sortServices(services, state.sort);
		}

		return { filteredServices: services, serviceMatchInfo: matchInfo };
	}, [state.services, state.filter, debouncedSearchQuery, state.sort]);

	// Currently selected service (with metadata merged)
	const selectedService = useMemo(() => {
		if (filteredServices.length === 0) return null;
		const index = Math.min(state.selectedIndex, filteredServices.length - 1);
		const service = filteredServices[index];
		if (!service) return null;

		// Merge with cached metadata
		const metadata = state.serviceMetadata.get(service.id);
		if (metadata) {
			return { ...service, ...metadata };
		}
		return service;
	}, [filteredServices, state.selectedIndex, state.serviceMetadata]);

	// Re-run effects with actual selectedService
	useAppEffects({
		state,
		dispatch,
		selectedService,
		silentRefresh,
		attemptReconnect,
		lastInteractionRef,
		autoRefreshIntervalRef,
		offlineReconnectRef,
	});

	// Execute action on service
	const executeAction = useCallback(
		async (
			action: ServiceAction,
			service: Service,
			options: { dryRun?: boolean } = {},
		): Promise<ActionResult> => {
			const { dryRun = false } = options;

			dispatch({ type: "SET_EXECUTING", payload: true });
			lastInteractionRef.current = Date.now(); // Track user action
			try {
				const result = await performServiceAction(action, service, { dryRun });

				// In dry-run mode, store the command and show it
				if (dryRun && "command" in result) {
					dispatch({
						type: "SET_DRY_RUN_COMMAND",
						payload: result.command ?? null,
					});
				}

				dispatch({ type: "SET_ACTION_RESULT", payload: result });

				// Only refresh services after real action (not dry-run)
				if (result.success && !dryRun) {
					await refresh();
				}

				return result;
			} finally {
				dispatch({ type: "SET_EXECUTING", payload: false });
			}
		},
		[refresh],
	);

	// Initial fetch
	useEffect(() => {
		refresh();
	}, [refresh]);

	// Helper to get metadata loading state
	const getMetadataLoadingState = useCallback(
		(serviceId: string) => {
			return state.metadataLoading.get(serviceId);
		},
		[state.metadataLoading],
	);

	const contextValue: AppContextType = {
		state,
		dispatch,
		filteredServices,
		serviceMatchInfo,
		selectedService,
		getMetadataLoadingState,
		executeAction,
		refresh,
	};

	return contextValue;
}

// Export provider component creator
export function createAppProvider(contextValue: AppContextType) {
	return function AppProvider({ children }: AppProviderProps) {
		return <AppContext.Provider value={contextValue}>{children}</AppContext.Provider>;
	};
}
