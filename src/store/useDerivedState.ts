/**
 * Derived state hooks for Zustand store
 * These hooks compute derived values from store state
 */

import { useEffect, useMemo, useRef, useState } from "react";
import { SEARCH_DEBOUNCE_MS } from "../hooks/useAppState/constants";
import { filterServicesWithScores, sortServices } from "../services";
import type { Service, ServiceMatchInfo } from "../types";
import { useAppStore } from "./useAppStore";

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
 * Hook to get filtered and sorted services with match info
 */
export function useFilteredServices(): {
	filteredServices: Service[];
	serviceMatchInfo: Map<string, ServiceMatchInfo>;
} {
	const services = useAppStore((state) => state.services);
	const filter = useAppStore((state) => state.filter);
	const sort = useAppStore((state) => state.sort);
	const searchQuery = useAppStore((state) => state.searchQuery);

	const debouncedSearchQuery = useDebouncedSearch(searchQuery);

	return useMemo(() => {
		const filtered = filterServicesWithScores(services, filter, debouncedSearchQuery);

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
		let filteredServices = filtered.map((f) => f.service);

		// When searching, fuzzy match order takes priority
		// When not searching, apply normal sort
		if (!debouncedSearchQuery) {
			filteredServices = sortServices(filteredServices, sort);
		}

		return { filteredServices, serviceMatchInfo: matchInfo };
	}, [services, filter, debouncedSearchQuery, sort]);
}

/**
 * Hook to get the currently selected service with metadata merged
 */
export function useSelectedService(filteredServices: Service[]): Service | null {
	const selectedIndex = useAppStore((state) => state.selectedIndex);
	const serviceMetadata = useAppStore((state) => state.serviceMetadata);

	return useMemo(() => {
		if (filteredServices.length === 0) return null;
		const index = Math.min(selectedIndex, filteredServices.length - 1);
		const service = filteredServices[index];
		if (!service) return null;

		// Merge with cached metadata
		const metadata = serviceMetadata.get(service.id);
		if (metadata) {
			return { ...service, ...metadata };
		}
		return service;
	}, [filteredServices, selectedIndex, serviceMetadata]);
}
