/**
 * Side effects for state management
 */

import type React from "react";
import { useEffect, useRef, useState } from "react";
import { fetchServiceMetadata } from "../../services";
import type { AppAction, AppState, Service } from "../../types";
import {
	ACTIVE_AUTO_REFRESH_INTERVAL,
	IDLE_AUTO_REFRESH_INTERVAL,
	IDLE_THRESHOLD_MS,
	OFFLINE_RECONNECT_INTERVAL,
	SEARCH_DEBOUNCE_MS,
} from "./constants";

interface UseEffectsProps {
	state: AppState;
	dispatch: React.Dispatch<AppAction>;
	selectedService: Service | null;
	silentRefresh: () => Promise<void>;
	attemptReconnect: () => Promise<void>;
	lastInteractionRef: React.MutableRefObject<number>;
	autoRefreshIntervalRef: React.MutableRefObject<ReturnType<typeof setInterval> | null>;
	offlineReconnectRef: React.MutableRefObject<ReturnType<typeof setInterval> | null>;
}

/**
 * Hook for debouncing search query
 */
export function useDebouncedSearch(searchQuery: string): string {
	const [debouncedSearchQuery, setDebouncedSearchQuery] = useState(searchQuery);
	const searchDebounceTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

	useEffect(() => {
		if (searchDebounceTimeoutRef.current) {
			clearTimeout(searchDebounceTimeoutRef.current);
		}

		searchDebounceTimeoutRef.current = setTimeout(() => {
			setDebouncedSearchQuery(searchQuery);
		}, SEARCH_DEBOUNCE_MS);

		return () => {
			if (searchDebounceTimeoutRef.current) {
				clearTimeout(searchDebounceTimeoutRef.current);
			}
		};
	}, [searchQuery]);

	return debouncedSearchQuery;
}

/**
 * Hook for managing side effects
 */
export function useAppEffects({
	state,
	dispatch,
	selectedService,
	silentRefresh,
	attemptReconnect,
	lastInteractionRef,
	autoRefreshIntervalRef,
	offlineReconnectRef,
}: UseEffectsProps) {
	// Auto-refresh effect with adaptive intervals
	// biome-ignore lint/correctness/useExhaustiveDependencies: refs are stable and don't need to be in deps
	useEffect(() => {
		// Clear any existing interval
		if (autoRefreshIntervalRef.current) {
			clearInterval(autoRefreshIntervalRef.current);
			autoRefreshIntervalRef.current = null;
		}

		// Set up new interval if auto-refresh is enabled and we're online
		if (state.autoRefresh.enabled && !state.offline.isOffline) {
			const setupInterval = () => {
				// Calculate adaptive interval based on time since last interaction
				const timeSinceInteraction = Date.now() - lastInteractionRef.current;
				const adaptiveInterval =
					timeSinceInteraction > IDLE_THRESHOLD_MS
						? IDLE_AUTO_REFRESH_INTERVAL
						: ACTIVE_AUTO_REFRESH_INTERVAL;

				// Clear existing interval
				if (autoRefreshIntervalRef.current) {
					clearInterval(autoRefreshIntervalRef.current);
				}

				// Set up new interval with adaptive timing
				autoRefreshIntervalRef.current = setInterval(() => {
					silentRefresh();
					// Recalculate interval after each refresh
					setupInterval();
				}, adaptiveInterval);
			};

			setupInterval();
		}

		// Cleanup on unmount or when auto-refresh settings change
		return () => {
			if (autoRefreshIntervalRef.current) {
				clearInterval(autoRefreshIntervalRef.current);
				autoRefreshIntervalRef.current = null;
			}
		};
	}, [state.autoRefresh.enabled, state.offline.isOffline, silentRefresh]);

	// Track user interactions to adjust auto-refresh interval
	// biome-ignore lint/correctness/useExhaustiveDependencies: refs are stable and don't need to be in deps
	useEffect(() => {
		// Update last interaction time on user actions
		if (
			state.executingAction ||
			state.lastActionResult ||
			state.selectedIndex !== 0 ||
			state.searchQuery ||
			state.filter.type !== "all" ||
			state.filter.domain !== "all" ||
			state.filter.status !== "all"
		) {
			lastInteractionRef.current = Date.now();
		}
	}, [
		state.executingAction,
		state.lastActionResult,
		state.selectedIndex,
		state.searchQuery,
		state.filter.type,
		state.filter.domain,
		state.filter.status,
	]);

	// Offline reconnect effect - periodically try to reconnect when offline
	// biome-ignore lint/correctness/useExhaustiveDependencies: refs are stable and don't need to be in deps
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
						error: error instanceof Error ? error.message : "Failed to load metadata",
					},
				});
			});
	}, [selectedService, state.serviceMetadata, state.metadataLoading, dispatch]);

	// Clear metadata cache on refresh
	useEffect(() => {
		if (state.loading) {
			dispatch({ type: "CLEAR_METADATA_CACHE" });
		}
	}, [state.loading, dispatch]);
}
