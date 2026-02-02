/**
 * Tests for app reducer
 */

import { describe, expect, test } from "bun:test";
import type { AppAction, Service } from "../../../types";
import { initialState } from "../initialState";
import { appReducer } from "../reducer";

describe("appReducer", () => {
	test("SET_SERVICES updates services and resets loading", () => {
		const services: Service[] = [
			{
				id: "test-1",
				label: "com.test.service",
				displayName: "Test Service",
				type: "LaunchDaemon",
				domain: "system",
				status: "running",
				protection: "normal",
				pid: 1234,
				enabled: true,
				isAppleService: false,
				requiresRoot: false,
			},
		];

		const action: AppAction = { type: "SET_SERVICES", payload: services };
		const newState = appReducer(initialState, action);

		expect(newState.services).toEqual(services);
		expect(newState.loading).toBe(false);
	});

	test("SET_SEARCH updates search query and resets selected index", () => {
		const action: AppAction = { type: "SET_SEARCH", payload: "test" };
		const stateWithSelection = {
			...initialState,
			selectedIndex: 5,
		};
		const newState = appReducer(stateWithSelection, action);

		expect(newState.searchQuery).toBe("test");
		expect(newState.selectedIndex).toBe(0);
	});

	test("SELECT_NEXT increments selected index", () => {
		const stateWithSelection = {
			...initialState,
			selectedIndex: 2,
		};
		const action: AppAction = { type: "SELECT_NEXT" };
		const newState = appReducer(stateWithSelection, action);

		expect(newState.selectedIndex).toBe(3);
	});

	test("SELECT_PREV decrements selected index but not below 0", () => {
		const stateWithSelection = {
			...initialState,
			selectedIndex: 1,
		};
		const action: AppAction = { type: "SELECT_PREV" };
		const newState = appReducer(stateWithSelection, action);

		expect(newState.selectedIndex).toBe(0);

		// Should not go below 0
		const newState2 = appReducer(newState, action);
		expect(newState2.selectedIndex).toBe(0);
	});

	test("SET_FILTER updates filter and resets selected index", () => {
		const action: AppAction = {
			type: "SET_FILTER",
			payload: { type: "LaunchDaemon" },
		};
		const stateWithSelection = {
			...initialState,
			selectedIndex: 3,
		};
		const newState = appReducer(stateWithSelection, action);

		expect(newState.filter.type).toBe("LaunchDaemon");
		expect(newState.selectedIndex).toBe(0);
	});

	test("TOGGLE_SORT_DIRECTION toggles sort direction", () => {
		const stateWithSort = {
			...initialState,
			sort: { field: "label" as const, direction: "asc" as const },
		};
		const action: AppAction = { type: "TOGGLE_SORT_DIRECTION" };
		const newState = appReducer(stateWithSort, action);

		expect(newState.sort.direction).toBe("desc");

		const newState2 = appReducer(newState, action);
		expect(newState2.sort.direction).toBe("asc");
	});

	test("TOGGLE_AUTO_REFRESH toggles auto-refresh enabled state", () => {
		const stateWithAutoRefresh = {
			...initialState,
			autoRefresh: { enabled: false, intervalMs: 10000 },
		};
		const action: AppAction = { type: "TOGGLE_AUTO_REFRESH" };
		const newState = appReducer(stateWithAutoRefresh, action);

		expect(newState.autoRefresh.enabled).toBe(true);

		const newState2 = appReducer(newState, action);
		expect(newState2.autoRefresh.enabled).toBe(false);
	});

	test("SET_SERVICE_METADATA adds metadata to cache", () => {
		const action: AppAction = {
			type: "SET_SERVICE_METADATA",
			payload: {
				serviceId: "test-1",
				metadata: { description: "Test description" },
			},
		};
		const newState = appReducer(initialState, action);

		expect(newState.serviceMetadata.has("test-1")).toBe(true);
		expect(newState.serviceMetadata.get("test-1")?.description).toBe("Test description");
	});

	test("CLEAR_METADATA_CACHE clears metadata cache", () => {
		const stateWithMetadata = {
			...initialState,
			serviceMetadata: new Map([
				["test-1", { description: "Test" }],
				["test-2", { description: "Test 2" }],
			]),
			metadataLoading: new Map([["test-1", { loading: false, error: null }]]),
		};
		const action: AppAction = { type: "CLEAR_METADATA_CACHE" };
		const newState = appReducer(stateWithMetadata, action);

		expect(newState.serviceMetadata.size).toBe(0);
		expect(newState.metadataLoading.size).toBe(0);
	});

	test("FETCH_SUCCESS updates services and resets offline state", () => {
		const services: Service[] = [
			{
				id: "test-1",
				label: "com.test.service",
				displayName: "Test Service",
				type: "LaunchDaemon",
				domain: "system",
				status: "running",
				protection: "normal",
				pid: 1234,
				enabled: true,
				isAppleService: false,
				requiresRoot: false,
			},
		];
		const stateWithOffline = {
			...initialState,
			offline: {
				isOffline: true,
				consecutiveFailures: 3,
				lastSuccessfulRefresh: null,
				cachedServices: [],
				lastError: "Connection failed",
			},
		};
		const action: AppAction = { type: "FETCH_SUCCESS", payload: services };
		const newState = appReducer(stateWithOffline, action);

		expect(newState.services).toEqual(services);
		expect(newState.loading).toBe(false);
		expect(newState.error).toBeNull();
		expect(newState.offline.isOffline).toBe(false);
		expect(newState.offline.consecutiveFailures).toBe(0);
		expect(newState.offline.lastError).toBeNull();
	});
});
