/**
 * Side effects for Zustand store
 * Handles auto-refresh, offline reconnect, and metadata prefetching
 */

import { useEffect, useRef } from "react";
import {
	ACTIVE_AUTO_REFRESH_INTERVAL,
	IDLE_AUTO_REFRESH_INTERVAL,
	IDLE_THRESHOLD_MS,
	OFFLINE_RECONNECT_INTERVAL,
} from "../hooks/useAppState/constants";
import { fetchServiceMetadata } from "../services";
import { useAppStore } from "./useAppStore";
import { useFilteredServices, useSelectedService } from "./useDerivedState";

/**
 * Hook for managing side effects with Zustand store
 */
export function useAppEffects() {
	const store = useAppStore();
	const { filteredServices } = useFilteredServices();
	const selectedService = useSelectedService(filteredServices);

	const autoRefreshIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
	const offlineReconnectRef = useRef<ReturnType<typeof setInterval> | null>(null);
	const lastInteractionRef = useRef<number>(Date.now());

	// Auto-refresh effect with adaptive intervals
	useEffect(() => {
		// Clear any existing interval
		if (autoRefreshIntervalRef.current) {
			clearInterval(autoRefreshIntervalRef.current);
			autoRefreshIntervalRef.current = null;
		}

		// Set up new interval if auto-refresh is enabled and we're online
		if (store.autoRefresh.enabled && !store.offline.isOffline) {
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
					store.silentRefresh();
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
	}, [store.autoRefresh.enabled, store.offline.isOffline, store.silentRefresh]);

	// Track user interactions to adjust auto-refresh interval
	useEffect(() => {
		// Update last interaction time on user actions
		if (
			store.executingAction ||
			store.lastActionResult ||
			store.selectedIndex !== 0 ||
			store.searchQuery ||
			store.filter.type !== "all" ||
			store.filter.domain !== "all" ||
			store.filter.status !== "all"
		) {
			lastInteractionRef.current = Date.now();
		}
	}, [
		store.executingAction,
		store.lastActionResult,
		store.selectedIndex,
		store.searchQuery,
		store.filter.type,
		store.filter.domain,
		store.filter.status,
	]);

	// Offline reconnect effect - periodically try to reconnect when offline
	useEffect(() => {
		// Clear any existing reconnect interval
		if (offlineReconnectRef.current) {
			clearInterval(offlineReconnectRef.current);
			offlineReconnectRef.current = null;
		}

		// Set up reconnect interval when offline
		if (store.offline.isOffline) {
			offlineReconnectRef.current = setInterval(() => {
				store.attemptReconnect();
			}, OFFLINE_RECONNECT_INTERVAL);
		}

		// Cleanup on unmount or when offline state changes
		return () => {
			if (offlineReconnectRef.current) {
				clearInterval(offlineReconnectRef.current);
				offlineReconnectRef.current = null;
			}
		};
	}, [store.offline.isOffline, store.attemptReconnect]);

	// Load metadata for selected service
	useEffect(() => {
		if (!selectedService) return;
		const serviceId = selectedService.id;

		// Skip if metadata already loaded
		if (store.serviceMetadata.has(serviceId)) return;
		// Skip if already loading
		const loadingState = store.metadataLoading.get(serviceId);
		if (loadingState?.loading) return;
		// Skip system extensions (they don't have plists)
		if (selectedService.type === "SystemExtension") return;

		// Start loading
		store.setMetadataLoading(serviceId, true);

		// Fetch metadata
		fetchServiceMetadata(selectedService)
			.then((metadata) => {
				store.setServiceMetadata(serviceId, metadata);
				store.setMetadataLoading(serviceId, false);
			})
			.catch((error) => {
				store.setMetadataLoading(
					serviceId,
					false,
					error instanceof Error ? error.message : "Failed to load metadata",
				);
			});
	}, [
		selectedService,
		store.serviceMetadata,
		store.metadataLoading,
		store.setServiceMetadata,
		store.setMetadataLoading,
	]);

	// Clear metadata cache on refresh
	useEffect(() => {
		if (store.loading) {
			store.clearMetadataCache();
		}
	}, [store.loading, store.clearMetadataCache]);
}
