/**
 * Side effects for Zustand store
 * Handles auto-refresh, offline reconnect, and metadata prefetching
 */

import { useEffect, useRef } from "react";
import { fetchServiceMetadata } from "../services";
import {
	ACTIVE_AUTO_REFRESH_INTERVAL,
	IDLE_AUTO_REFRESH_INTERVAL,
	IDLE_THRESHOLD_MS,
	OFFLINE_RECONNECT_INTERVAL,
} from "./constants";
import { useAppStore } from "./useAppStore";
import { useFilteredServices, useSelectedService } from "./useDerivedState";

/**
 * Hook for managing side effects with Zustand store
 * Uses granular selectors to avoid unnecessary re-renders
 */
export function useAppEffects() {
	// Granular selectors — only subscribe to the specific state each effect needs
	const autoRefreshEnabled = useAppStore((s) => s.autoRefresh.enabled);
	const isOffline = useAppStore((s) => s.offline.isOffline);
	const loading = useAppStore((s) => s.loading);
	const executingAction = useAppStore((s) => s.executingAction);
	const lastActionResult = useAppStore((s) => s.lastActionResult);
	const selectedIndex = useAppStore((s) => s.selectedIndex);
	const searchQuery = useAppStore((s) => s.searchQuery);
	const filterType = useAppStore((s) => s.filter.type);
	const filterDomain = useAppStore((s) => s.filter.domain);
	const filterStatus = useAppStore((s) => s.filter.status);
	const serviceMetadata = useAppStore((s) => s.serviceMetadata);
	const metadataLoading = useAppStore((s) => s.metadataLoading);

	const { filteredServices } = useFilteredServices();
	const selectedService = useSelectedService(filteredServices);

	const autoRefreshIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
	const offlineReconnectRef = useRef<ReturnType<typeof setInterval> | null>(null);
	const lastInteractionRef = useRef<number>(Date.now());

	// Auto-refresh effect with adaptive intervals
	useEffect(() => {
		if (autoRefreshIntervalRef.current) {
			clearInterval(autoRefreshIntervalRef.current);
			autoRefreshIntervalRef.current = null;
		}

		if (autoRefreshEnabled && !isOffline) {
			const setupInterval = () => {
				const timeSinceInteraction = Date.now() - lastInteractionRef.current;
				const adaptiveInterval =
					timeSinceInteraction > IDLE_THRESHOLD_MS
						? IDLE_AUTO_REFRESH_INTERVAL
						: ACTIVE_AUTO_REFRESH_INTERVAL;

				if (autoRefreshIntervalRef.current) {
					clearInterval(autoRefreshIntervalRef.current);
				}

				autoRefreshIntervalRef.current = setInterval(() => {
					useAppStore.getState().silentRefresh();
					setupInterval();
				}, adaptiveInterval);
			};

			setupInterval();
		}

		return () => {
			if (autoRefreshIntervalRef.current) {
				clearInterval(autoRefreshIntervalRef.current);
				autoRefreshIntervalRef.current = null;
			}
		};
	}, [autoRefreshEnabled, isOffline]);

	// Track user interactions to adjust auto-refresh interval
	useEffect(() => {
		if (
			executingAction ||
			lastActionResult ||
			selectedIndex !== 0 ||
			searchQuery ||
			filterType !== "all" ||
			filterDomain !== "all" ||
			filterStatus !== "all"
		) {
			lastInteractionRef.current = Date.now();
		}
	}, [executingAction, lastActionResult, selectedIndex, searchQuery, filterType, filterDomain, filterStatus]);

	// Offline reconnect effect
	useEffect(() => {
		if (offlineReconnectRef.current) {
			clearInterval(offlineReconnectRef.current);
			offlineReconnectRef.current = null;
		}

		if (isOffline) {
			offlineReconnectRef.current = setInterval(() => {
				useAppStore.getState().attemptReconnect();
			}, OFFLINE_RECONNECT_INTERVAL);
		}

		return () => {
			if (offlineReconnectRef.current) {
				clearInterval(offlineReconnectRef.current);
				offlineReconnectRef.current = null;
			}
		};
	}, [isOffline]);

	// Load metadata for selected service
	useEffect(() => {
		if (!selectedService) return;
		const serviceId = selectedService.id;

		if (serviceId in serviceMetadata) return;
		const loadingState = metadataLoading[serviceId];
		if (loadingState?.loading) return;
		if (selectedService.type === "SystemExtension") return;

		// Use getState() to call actions — avoids subscribing to action references
		const { setMetadataLoading } = useAppStore.getState();
		setMetadataLoading(serviceId, true);

		fetchServiceMetadata(selectedService)
			.then((metadata) => {
				useAppStore.getState().setServiceMetadata(serviceId, metadata);
				useAppStore.getState().setMetadataLoading(serviceId, false);
			})
			.catch((error) => {
				useAppStore
					.getState()
					.setMetadataLoading(
						serviceId,
						false,
						error instanceof Error ? error.message : "Failed to load metadata",
					);
			});
	}, [selectedService, serviceMetadata, metadataLoading]);

	// Clear metadata cache on refresh
	useEffect(() => {
		if (loading) {
			useAppStore.getState().clearMetadataCache();
		}
	}, [loading]);
}
