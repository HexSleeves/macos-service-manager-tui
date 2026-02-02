/**
 * Edge case tests for app reducer
 */

import { describe, expect, test } from "bun:test";
import type { AppAction, Service } from "../../../types";
import { MAX_METADATA_CACHE_SIZE } from "../constants";
import { initialState } from "../initialState";
import { appReducer } from "../reducer";

describe("appReducer edge cases", () => {
	test("SET_SERVICE_METADATA evicts oldest entries when cache exceeds max size", () => {
		// Fill cache to max size + 1
		const stateWithFullCache = {
			...initialState,
			serviceMetadata: new Map(
				Array.from({ length: MAX_METADATA_CACHE_SIZE }, (_, i) => [
					`service-${i}`,
					{ description: `Service ${i}` },
				]),
			),
		};

		const action: AppAction = {
			type: "SET_SERVICE_METADATA",
			payload: {
				serviceId: "new-service",
				metadata: { description: "New service" },
			},
		};

		const newState = appReducer(stateWithFullCache, action);

		// Should have max size entries
		expect(newState.serviceMetadata.size).toBe(MAX_METADATA_CACHE_SIZE);
		// New service should be in cache
		expect(newState.serviceMetadata.has("new-service")).toBe(true);
		// Oldest entry should be evicted
		expect(newState.serviceMetadata.has("service-0")).toBe(false);
	});

	test("SET_SERVICE_METADATA moves existing entry to end (LRU)", () => {
		const stateWithCache = {
			...initialState,
			serviceMetadata: new Map([
				["service-1", { description: "Service 1" }],
				["service-2", { description: "Service 2" }],
			]),
		};

		const action: AppAction = {
			type: "SET_SERVICE_METADATA",
			payload: {
				serviceId: "service-1",
				metadata: { description: "Updated Service 1" },
			},
		};

		const newState = appReducer(stateWithCache, action);

		// Should still have 2 entries
		expect(newState.serviceMetadata.size).toBe(2);
		// service-1 should be updated
		expect(newState.serviceMetadata.get("service-1")?.description).toBe("Updated Service 1");
	});

	test("FETCH_FAILURE goes offline after threshold failures", () => {
		const stateWithFailures = {
			...initialState,
			offline: {
				isOffline: false,
				consecutiveFailures: 2,
				lastSuccessfulRefresh: null,
				cachedServices: [],
				lastError: null,
			},
		};

		const action: AppAction = {
			type: "FETCH_FAILURE",
			payload: "Connection failed",
		};

		const newState = appReducer(stateWithFailures, action);

		expect(newState.offline.isOffline).toBe(true);
		expect(newState.offline.consecutiveFailures).toBe(3);
		expect(newState.offline.lastError).toBe("Connection failed");
	});

	test("FETCH_FAILURE uses cached services when offline", () => {
		const cachedServices: Service[] = [
			{
				id: "cached-1",
				label: "com.cached",
				displayName: "Cached Service",
				type: "LaunchDaemon",
				domain: "system",
				status: "running",
				protection: "normal",
				enabled: true,
				isAppleService: false,
				requiresRoot: false,
			},
		];

		const stateWithCache = {
			...initialState,
			offline: {
				isOffline: false,
				consecutiveFailures: 2,
				lastSuccessfulRefresh: null,
				cachedServices,
				lastError: null,
			},
		};

		const action: AppAction = {
			type: "FETCH_FAILURE",
			payload: "Connection failed",
		};

		const newState = appReducer(stateWithCache, action);

		expect(newState.offline.isOffline).toBe(true);
		expect(newState.services).toEqual(cachedServices);
		expect(newState.error).toBeNull(); // Should not show error when using cache
	});

	test("UPDATE_SERVICES returns same state when nothing changed", () => {
		const services: Service[] = [
			{
				id: "test-1",
				label: "com.test",
				displayName: "Test",
				type: "LaunchDaemon",
				domain: "system",
				status: "running",
				protection: "normal",
				enabled: true,
				isAppleService: false,
				requiresRoot: false,
			},
		];

		const stateWithServices = {
			...initialState,
			services,
		};

		const action: AppAction = {
			type: "UPDATE_SERVICES",
			payload: services,
		};

		const newState = appReducer(stateWithServices, action);

		// Should return same state object (no changes)
		expect(newState).toBe(stateWithServices);
	});

	test("SELECT_INDEX clamps to 0 minimum", () => {
		const action: AppAction = { type: "SELECT_INDEX", payload: -5 };
		const newState = appReducer(initialState, action);

		expect(newState.selectedIndex).toBe(0);
	});
});
