/**
 * Application state reducer
 */

import { getNextSortField } from "../../services";
import type { AppAction, AppState } from "../../types";
import { MAX_METADATA_CACHE_SIZE, OFFLINE_THRESHOLD } from "./constants";
import { mergeServices } from "./utils";

/**
 * Application state reducer
 */
export function appReducer(state: AppState, action: AppAction): AppState {
	switch (action.type) {
		case "SET_SERVICES":
			return {
				...state,
				services: action.payload,
				loading: false,
				selectedIndex: Math.min(state.selectedIndex, Math.max(0, action.payload.length - 1)),
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
				selectedIndex: Math.min(state.selectedIndex, Math.max(0, merged.length - 1)),
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
				selectedIndex: Math.min(state.selectedIndex, Math.max(0, action.payload.length - 1)),
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
				services: shouldGoOffline && hasCachedData ? state.offline.cachedServices : state.services,
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

			// If entry exists, remove it to move to end (LRU - most recently used)
			if (existing) {
				newMetadata.delete(action.payload.serviceId);
			}

			// Merge with existing metadata and add to end
			newMetadata.set(action.payload.serviceId, {
				...existing,
				...action.payload.metadata,
			});

			// Evict oldest entries if cache exceeds max size
			if (newMetadata.size > MAX_METADATA_CACHE_SIZE) {
				const entriesToRemove = newMetadata.size - MAX_METADATA_CACHE_SIZE;
				const keysToRemove = Array.from(newMetadata.keys()).slice(0, entriesToRemove);
				for (const key of keysToRemove) {
					newMetadata.delete(key);
				}
			}

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
