/**
 * Application State Management
 */

import type React from "react";
import {
	createContext,
	useCallback,
	useContext,
	useEffect,
	useMemo,
	useReducer,
	useRef,
} from "react";
import {
	fetchAllServices,
	fetchServiceMetadata,
	filterServicesWithScores,
	getNextSortField,
	performServiceAction,
	sortServices,
} from "../services";
import type {
	ActionResult,
	AppAction,
	AppContextType,
	AppState,
	OfflineState,
	Service,
	ServiceAction,
	ServiceMatchInfo,
} from "../types";

// Default auto-refresh interval (10 seconds)
const DEFAULT_AUTO_REFRESH_INTERVAL = 10000;

// Number of consecutive failures before entering offline mode
const OFFLINE_THRESHOLD = 3;

// Reconnect interval when offline (30 seconds)
const OFFLINE_RECONNECT_INTERVAL = 30000;

/**
 * Check if a service has changed (for smart updates)
 */
function hasServiceChanged(oldService: Service, newService: Service): boolean {
	return (
		oldService.status !== newService.status ||
		oldService.pid !== newService.pid ||
		oldService.enabled !== newService.enabled ||
		oldService.exitStatus !== newService.exitStatus ||
		oldService.lastError !== newService.lastError
	);
}

/**
 * Merge services, only updating those that changed
 * Returns null if nothing changed, otherwise returns the updated array
 */
function mergeServices(
	oldServices: Service[],
	newServices: Service[],
): Service[] | null {
	// Build a map of new services by id
	const newServiceMap = new Map(newServices.map((s) => [s.id, s]));
	const _oldServiceMap = new Map(oldServices.map((s) => [s.id, s]));

	// Check if the service set has changed
	const oldIds = new Set(oldServices.map((s) => s.id));
	const newIds = new Set(newServices.map((s) => s.id));

	// Check for added or removed services
	const hasAddedOrRemoved =
		newServices.some((s) => !oldIds.has(s.id)) ||
		oldServices.some((s) => !newIds.has(s.id));

	if (hasAddedOrRemoved) {
		// Services were added or removed, return new array
		return newServices;
	}

	// Check if any services changed
	let hasChanges = false;
	const mergedServices = oldServices.map((oldService) => {
		const newService = newServiceMap.get(oldService.id);
		if (newService && hasServiceChanged(oldService, newService)) {
			hasChanges = true;
			return newService;
		}
		return oldService;
	});

	return hasChanges ? mergedServices : null;
}

// Initial offline state
const initialOfflineState: OfflineState = {
	isOffline: false,
	consecutiveFailures: 0,
	lastSuccessfulRefresh: null,
	cachedServices: [],
	lastError: null,
};

// Initial state
const initialState: AppState = {
	services: [],
	loading: true,
	error: null,
	selectedIndex: 0,
	searchQuery: "",
	filter: {
		type: "all",
		domain: "all",
		status: "all",
		showAppleServices: false,
		showProtected: true,
	},
	sort: {
		field: "label",
		direction: "asc",
	},
	focusedPanel: "list",
	showHelp: false,
	showConfirm: false,
	showFilters: false,
	pendingAction: null,
	lastActionResult: null,
	executingAction: false,
	autoRefresh: {
		enabled: false,
		intervalMs: DEFAULT_AUTO_REFRESH_INTERVAL,
	},
	dryRun: false,
	dryRunCommand: null,
	offline: initialOfflineState,
	serviceMetadata: new Map(),
	metadataLoading: new Map(),
};

// Reducer
function appReducer(state: AppState, action: AppAction): AppState {
	switch (action.type) {
		case "SET_SERVICES":
			return {
				...state,
				services: action.payload,
				loading: false,
				selectedIndex: Math.min(
					state.selectedIndex,
					Math.max(0, action.payload.length - 1),
				),
			};

		case "SET_LOADING":
			return { ...state, loading: action.payload };

		case "SET_ERROR":
			return { ...state, error: action.payload, loading: false };

		case "SELECT_INDEX":
			// Bounds checking is done when using filteredServices in the provider
			return { ...state, selectedIndex: Math.max(0, action.payload) };

		case "SELECT_NEXT":
			// Upper bound checked when using filteredServices
			return { ...state, selectedIndex: state.selectedIndex + 1 };

		case "SELECT_PREV":
			return { ...state, selectedIndex: Math.max(0, state.selectedIndex - 1) };

		case "SET_SEARCH":
			return { ...state, searchQuery: action.payload, selectedIndex: 0 };

		case "SET_FILTER":
			return {
				...state,
				filter: { ...state.filter, ...action.payload },
				selectedIndex: 0,
			};

		case "SET_SORT":
			return { ...state, sort: action.payload, selectedIndex: 0 };

		case "TOGGLE_SORT_DIRECTION":
			return {
				...state,
				sort: {
					...state.sort,
					direction: state.sort.direction === "asc" ? "desc" : "asc",
				},
			};

		case "CYCLE_SORT_FIELD":
			return {
				...state,
				sort: {
					...state.sort,
					field: getNextSortField(state.sort.field),
				},
			};

		case "SET_FOCUS":
			return { ...state, focusedPanel: action.payload };

		case "TOGGLE_HELP":
			return { ...state, showHelp: !state.showHelp };

		case "REQUEST_ACTION":
			return { ...state, showConfirm: true, pendingAction: action.payload };

		case "CONFIRM_ACTION":
			return { ...state, showConfirm: false };

		case "CANCEL_ACTION":
			return { ...state, showConfirm: false, pendingAction: null };

		case "SET_ACTION_RESULT":
			return {
				...state,
				lastActionResult: action.payload,
				pendingAction: null,
			};

		case "REFRESH":
			return { ...state, loading: true, error: null };

		case "SET_EXECUTING":
			return { ...state, executingAction: action.payload };

		case "TOGGLE_FILTERS":
			return { ...state, showFilters: !state.showFilters };

		case "TOGGLE_AUTO_REFRESH":
			return {
				...state,
				autoRefresh: {
					...state.autoRefresh,
					enabled: !state.autoRefresh.enabled,
				},
			};

		case "SET_AUTO_REFRESH_INTERVAL":
			return {
				...state,
				autoRefresh: {
					...state.autoRefresh,
					intervalMs: action.payload,
				},
			};

		case "UPDATE_SERVICES": {
			// Smart update: only update if services actually changed
			const merged = mergeServices(state.services, action.payload);
			if (merged === null) {
				// No changes, return current state to avoid re-renders
				return state;
			}
			return {
				...state,
				services: merged,
				selectedIndex: Math.min(
					state.selectedIndex,
					Math.max(0, merged.length - 1),
				),
			};
		}

		case "TOGGLE_DRY_RUN":
			return { ...state, dryRun: !state.dryRun, dryRunCommand: null };

		case "SET_DRY_RUN_COMMAND":
			return { ...state, dryRunCommand: action.payload };

		case "FETCH_SUCCESS":
			return {
				...state,
				services: action.payload,
				loading: false,
				error: null,
				selectedIndex: Math.min(
					state.selectedIndex,
					Math.max(0, action.payload.length - 1),
				),
				offline: {
					isOffline: false,
					consecutiveFailures: 0,
					lastSuccessfulRefresh: new Date(),
					cachedServices: action.payload,
					lastError: null,
				},
			};

		case "FETCH_FAILURE": {
			const newFailureCount = state.offline.consecutiveFailures + 1;
			const shouldGoOffline = newFailureCount >= OFFLINE_THRESHOLD;
			const hasCachedData = state.offline.cachedServices.length > 0;

			return {
				...state,
				loading: false,
				// Only show error if we have no cached data to fall back on
				error: hasCachedData ? null : action.payload,
				// If offline with cached data, use cached services
				services:
					shouldGoOffline && hasCachedData
						? state.offline.cachedServices
						: state.services,
				offline: {
					...state.offline,
					isOffline: shouldGoOffline,
					consecutiveFailures: newFailureCount,
					lastError: action.payload,
				},
			};
		}

		case "SET_ONLINE":
			return {
				...state,
				offline: {
					...state.offline,
					isOffline: false,
					consecutiveFailures: 0,
					lastError: null,
				},
			};

		case "RECONNECT_ATTEMPT":
			// Mark that we're attempting to reconnect (shows loading indicator)
			return {
				...state,
				loading: true,
			};

		case "SET_SERVICE_METADATA": {
			const newMetadata = new Map(state.serviceMetadata);
			const existing = newMetadata.get(action.payload.serviceId);
			// Merge with existing metadata
			newMetadata.set(action.payload.serviceId, {
				...existing,
				...action.payload.metadata,
			});
			return {
				...state,
				serviceMetadata: newMetadata,
			};
		}

		case "SET_METADATA_LOADING": {
			const newLoading = new Map(state.metadataLoading);
			newLoading.set(action.payload.serviceId, {
				loading: action.payload.loading,
				error: action.payload.error ?? null,
			});
			return {
				...state,
				metadataLoading: newLoading,
			};
		}

		case "CLEAR_METADATA_CACHE":
			return {
				...state,
				serviceMetadata: new Map(),
				metadataLoading: new Map(),
			};

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
	const autoRefreshIntervalRef = useRef<ReturnType<typeof setInterval> | null>(
		null,
	);
	const offlineReconnectRef = useRef<ReturnType<typeof setInterval> | null>(
		null,
	);

	// Filtered and sorted services with match info
	const { filteredServices, serviceMatchInfo } = useMemo(() => {
		const filtered = filterServicesWithScores(
			state.services,
			state.filter,
			state.searchQuery,
		);

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
		if (!state.searchQuery) {
			services = sortServices(services, state.sort);
		}

		return { filteredServices: services, serviceMatchInfo: matchInfo };
	}, [state.services, state.filter, state.searchQuery, state.sort]);

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

	// Fetch services with offline mode support
	const refresh = useCallback(async () => {
		dispatch({ type: "REFRESH" });
		try {
			const services = await fetchAllServices();
			dispatch({ type: "FETCH_SUCCESS", payload: services });
		} catch (error) {
			const errorMessage =
				error instanceof Error ? error.message : "Failed to fetch services";
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
			const errorMessage =
				error instanceof Error ? error.message : "Failed to fetch services";
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

	// Execute action on service
	const executeAction = useCallback(
		async (
			action: ServiceAction,
			service: Service,
			options: { dryRun?: boolean } = {},
		): Promise<ActionResult> => {
			const { dryRun = false } = options;

			dispatch({ type: "SET_EXECUTING", payload: true });
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

	// Auto-refresh effect
	useEffect(() => {
		// Clear any existing interval
		if (autoRefreshIntervalRef.current) {
			clearInterval(autoRefreshIntervalRef.current);
			autoRefreshIntervalRef.current = null;
		}

		// Set up new interval if auto-refresh is enabled and we're online
		if (state.autoRefresh.enabled && !state.offline.isOffline) {
			autoRefreshIntervalRef.current = setInterval(() => {
				silentRefresh();
			}, state.autoRefresh.intervalMs);
		}

		// Cleanup on unmount or when auto-refresh settings change
		return () => {
			if (autoRefreshIntervalRef.current) {
				clearInterval(autoRefreshIntervalRef.current);
				autoRefreshIntervalRef.current = null;
			}
		};
	}, [
		state.autoRefresh.enabled,
		state.autoRefresh.intervalMs,
		state.offline.isOffline,
		silentRefresh,
	]);

	// Offline reconnect effect - periodically try to reconnect when offline
	useEffect(() => {
		// Clear any existing reconnect interval
		if (offlineReconnectRef.current) {
			clearInterval(offlineReconnectRef.current);
			offlineReconnectRef.current = null;
		}

		// Set up reconnect interval when offline
		if (state.offline.isOffline) {
			offlineReconnectRef.current = setInterval(() => {
				attemptReconnect();
			}, OFFLINE_RECONNECT_INTERVAL);
		}

		// Cleanup on unmount or when offline state changes
		return () => {
			if (offlineReconnectRef.current) {
				clearInterval(offlineReconnectRef.current);
				offlineReconnectRef.current = null;
			}
		};
	}, [state.offline.isOffline, attemptReconnect]);

	// Load metadata for selected service
	useEffect(() => {
		if (!selectedService) return;
		const serviceId = selectedService.id;

		// Skip if metadata already loaded
		if (state.serviceMetadata.has(serviceId)) return;
		// Skip if already loading
		const loadingState = state.metadataLoading.get(serviceId);
		if (loadingState?.loading) return;
		// Skip system extensions (they don't have plists)
		if (selectedService.type === "SystemExtension") return;

		// Start loading
		dispatch({
			type: "SET_METADATA_LOADING",
			payload: { serviceId, loading: true },
		});

		// Fetch metadata
		fetchServiceMetadata(selectedService)
			.then((metadata) => {
				dispatch({
					type: "SET_SERVICE_METADATA",
					payload: { serviceId, metadata },
				});
				dispatch({
					type: "SET_METADATA_LOADING",
					payload: { serviceId, loading: false },
				});
			})
			.catch((error) => {
				dispatch({
					type: "SET_METADATA_LOADING",
					payload: {
						serviceId,
						loading: false,
						error:
							error instanceof Error
								? error.message
								: "Failed to load metadata",
					},
				});
			});
	}, [selectedService, state.serviceMetadata, state.metadataLoading]);

	// Clear metadata cache on refresh
	useEffect(() => {
		if (state.loading) {
			dispatch({ type: "CLEAR_METADATA_CACHE" });
		}
	}, [state.loading]);

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
		return (
			<AppContext.Provider value={contextValue}>{children}</AppContext.Provider>
		);
	};
}
