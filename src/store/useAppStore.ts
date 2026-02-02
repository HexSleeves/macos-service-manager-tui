/**
 * Zustand store for application state management
 * Replaces Context + useReducer pattern
 */

import { create } from "zustand";
import { MAX_METADATA_CACHE_SIZE, OFFLINE_THRESHOLD } from "../hooks/useAppState/constants";
import { initialState } from "../hooks/useAppState/initialState";
import { mergeServices } from "../hooks/useAppState/utils";
import { fetchAllServices, getNextSortField, performServiceAction } from "../services";
import type { ActionResult, AppState, Service, ServiceAction } from "../types";

/**
 * Store state interface (matches AppState)
 */
interface AppStoreState extends AppState {
	// Actions will be added via the store creator
}

/**
 * Store actions interface
 */
interface AppStoreActions {
	// Service management
	setServices: (services: Service[]) => void;
	setLoading: (loading: boolean) => void;
	setError: (error: string | null) => void;
	updateServices: (services: Service[]) => void;

	// Selection
	selectIndex: (index: number) => void;
	selectNext: () => void;
	selectPrev: () => void;

	// Search and filter
	setSearch: (query: string) => void;
	setFilter: (filter: Partial<AppState["filter"]>) => void;
	setSort: (sort: AppState["sort"]) => void;
	toggleSortDirection: () => void;
	cycleSortField: () => void;

	// UI state
	setFocus: (panel: AppState["focusedPanel"]) => void;
	toggleHelp: () => void;
	toggleFilters: () => void;

	// Actions
	requestAction: (action: ServiceAction) => void;
	confirmAction: () => void;
	cancelAction: () => void;
	setActionResult: (result: ActionResult | null) => void;
	setExecuting: (executing: boolean) => void;

	// Refresh
	refresh: () => Promise<void>;
	silentRefresh: () => Promise<void>;
	attemptReconnect: () => Promise<void>;

	// Service actions
	executeAction: (
		action: ServiceAction,
		service: Service,
		options?: { dryRun?: boolean },
	) => Promise<ActionResult>;

	// Auto-refresh
	toggleAutoRefresh: () => void;
	setAutoRefreshInterval: (intervalMs: number) => void;

	// Dry run
	toggleDryRun: () => void;
	setDryRunCommand: (command: string | null) => void;

	// Offline handling
	fetchSuccess: (services: Service[]) => void;
	fetchFailure: (error: string) => void;
	setOnline: () => void;
	reconnectAttempt: () => void;

	// Metadata cache
	setServiceMetadata: (serviceId: string, metadata: Partial<Service>) => void;
	setMetadataLoading: (serviceId: string, loading: boolean, error?: string | null) => void;
	clearMetadataCache: () => void;
}

/**
 * Helper to clone a Map (needed for Zustand to detect changes)
 */
function cloneMap<K, V>(map: Map<K, V>): Map<K, V> {
	return new Map(map);
}

/**
 * Create Zustand store
 */
export const useAppStore = create<AppStoreState & AppStoreActions>((set, get) => ({
	// Initial state
	...initialState,

	// Service management
	setServices: (services) =>
		set((state) => ({
			services,
			loading: false,
			selectedIndex: Math.min(state.selectedIndex, Math.max(0, services.length - 1)),
		})),

	setLoading: (loading) => set({ loading }),

	setError: (error) => set({ error, loading: false }),

	updateServices: (services) => {
		const state = get();
		const merged = mergeServices(state.services, services);
		if (merged === null) {
			// No changes, don't update to avoid re-renders
			return;
		}
		set({
			services: merged,
			selectedIndex: Math.min(state.selectedIndex, Math.max(0, merged.length - 1)),
		});
	},

	// Selection
	selectIndex: (index) => set({ selectedIndex: Math.max(0, index) }),

	selectNext: () => set((state) => ({ selectedIndex: state.selectedIndex + 1 })),

	selectPrev: () => set((state) => ({ selectedIndex: Math.max(0, state.selectedIndex - 1) })),

	// Search and filter
	setSearch: (query) => set({ searchQuery: query, selectedIndex: 0 }),

	setFilter: (filter) =>
		set((state) => ({
			filter: { ...state.filter, ...filter },
			selectedIndex: 0,
		})),

	setSort: (sort) => set({ sort, selectedIndex: 0 }),

	toggleSortDirection: () =>
		set((state) => ({
			sort: {
				...state.sort,
				direction: state.sort.direction === "asc" ? "desc" : "asc",
			},
		})),

	cycleSortField: () =>
		set((state) => ({
			sort: {
				...state.sort,
				field: getNextSortField(state.sort.field),
			},
		})),

	// UI state
	setFocus: (panel) => set({ focusedPanel: panel }),

	toggleHelp: () => set((state) => ({ showHelp: !state.showHelp })),

	toggleFilters: () => set((state) => ({ showFilters: !state.showFilters })),

	// Actions
	requestAction: (action) => set({ showConfirm: true, pendingAction: action }),

	confirmAction: () => set({ showConfirm: false }),

	cancelAction: () => set({ showConfirm: false, pendingAction: null }),

	setActionResult: (result) => set({ lastActionResult: result, pendingAction: null }),

	setExecuting: (executing) => set({ executingAction: executing }),

	// Refresh
	refresh: async () => {
		set({ loading: true, error: null });
		try {
			const services = await fetchAllServices();
			get().fetchSuccess(services);
		} catch (error) {
			const errorMessage = error instanceof Error ? error.message : "Failed to fetch services";
			get().fetchFailure(errorMessage);
		}
	},

	silentRefresh: async () => {
		try {
			const services = await fetchAllServices();
			get().fetchSuccess(services);
		} catch (error) {
			const errorMessage = error instanceof Error ? error.message : "Failed to fetch services";
			get().fetchFailure(errorMessage);
		}
	},

	attemptReconnect: async () => {
		get().reconnectAttempt();
		try {
			const services = await fetchAllServices();
			get().fetchSuccess(services);
		} catch (_error) {
			// Still offline, just update loading state
			get().setLoading(false);
		}
	},

	// Service actions
	executeAction: async (action, service, options = {}) => {
		const { dryRun = false } = options;
		get().setExecuting(true);
		try {
			const result = await performServiceAction(action, service, { dryRun });

			// In dry-run mode, store the command and show it
			if (dryRun && "command" in result) {
				get().setDryRunCommand(result.command ?? null);
			}

			get().setActionResult(result);

			// Only refresh services after real action (not dry-run)
			if (result.success && !dryRun) {
				await get().refresh();
			}

			return result;
		} finally {
			get().setExecuting(false);
		}
	},

	// Auto-refresh
	toggleAutoRefresh: () =>
		set((state) => ({
			autoRefresh: {
				...state.autoRefresh,
				enabled: !state.autoRefresh.enabled,
			},
		})),

	setAutoRefreshInterval: (intervalMs) =>
		set((state) => ({
			autoRefresh: {
				...state.autoRefresh,
				intervalMs,
			},
		})),

	// Dry run
	toggleDryRun: () =>
		set((state) => ({
			dryRun: !state.dryRun,
			dryRunCommand: null,
		})),

	setDryRunCommand: (command) => set({ dryRunCommand: command }),

	// Offline handling
	fetchSuccess: (services) =>
		set((state) => ({
			services,
			loading: false,
			error: null,
			selectedIndex: Math.min(state.selectedIndex, Math.max(0, services.length - 1)),
			offline: {
				isOffline: false,
				consecutiveFailures: 0,
				lastSuccessfulRefresh: new Date(),
				cachedServices: services,
				lastError: null,
			},
		})),

	fetchFailure: (error) =>
		set((state) => {
			const newFailureCount = state.offline.consecutiveFailures + 1;
			const shouldGoOffline = newFailureCount >= OFFLINE_THRESHOLD;
			const hasCachedData = state.offline.cachedServices.length > 0;

			return {
				loading: false,
				// Only show error if we have no cached data to fall back on
				error: hasCachedData ? null : error,
				// If offline with cached data, use cached services
				services: shouldGoOffline && hasCachedData ? state.offline.cachedServices : state.services,
				offline: {
					...state.offline,
					isOffline: shouldGoOffline,
					consecutiveFailures: newFailureCount,
					lastError: error,
				},
			};
		}),

	setOnline: () =>
		set((state) => ({
			offline: {
				...state.offline,
				isOffline: false,
				consecutiveFailures: 0,
				lastError: null,
			},
		})),

	reconnectAttempt: () => set({ loading: true }),

	// Metadata cache
	setServiceMetadata: (serviceId, metadata) =>
		set((state) => {
			const newMetadata = cloneMap(state.serviceMetadata);
			const existing = newMetadata.get(serviceId);

			// If entry exists, remove it to move to end (LRU - most recently used)
			if (existing) {
				newMetadata.delete(serviceId);
			}

			// Merge with existing metadata and add to end
			newMetadata.set(serviceId, {
				...existing,
				...metadata,
			});

			// Evict oldest entries if cache exceeds max size
			if (newMetadata.size > MAX_METADATA_CACHE_SIZE) {
				const entriesToRemove = newMetadata.size - MAX_METADATA_CACHE_SIZE;
				const keysToRemove = Array.from(newMetadata.keys()).slice(0, entriesToRemove);
				for (const key of keysToRemove) {
					newMetadata.delete(key);
				}
			}

			return { serviceMetadata: newMetadata };
		}),

	setMetadataLoading: (serviceId, loading, error = null) =>
		set((state) => {
			const newLoading = cloneMap(state.metadataLoading);
			newLoading.set(serviceId, {
				loading,
				error,
			});
			return { metadataLoading: newLoading };
		}),

	clearMetadataCache: () =>
		set({
			serviceMetadata: new Map(),
			metadataLoading: new Map(),
		}),
}));
