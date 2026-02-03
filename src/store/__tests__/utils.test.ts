/**
 * Tests for utility functions
 */

import { describe, expect, test } from "bun:test";
import type { Service } from "../../types";
import { hasServiceChanged, mergeServices } from "../utils";

describe("hasServiceChanged", () => {
	test("returns true when status changes", () => {
		const oldService: Service = {
			id: "test-1",
			label: "com.test",
			displayName: "Test",
			type: "LaunchDaemon",
			domain: "system",
			status: "stopped",
			protection: "normal",
			enabled: true,
			isAppleService: false,
			requiresRoot: false,
		};
		const newService: Service = {
			...oldService,
			status: "running",
		};

		expect(hasServiceChanged(oldService, newService)).toBe(true);
	});

	test("returns true when PID changes", () => {
		const oldService: Service = {
			id: "test-1",
			label: "com.test",
			displayName: "Test",
			type: "LaunchDaemon",
			domain: "system",
			status: "running",
			protection: "normal",
			pid: 1234,
			enabled: true,
			isAppleService: false,
			requiresRoot: false,
		};
		const newService: Service = {
			...oldService,
			pid: 5678,
		};

		expect(hasServiceChanged(oldService, newService)).toBe(true);
	});

	test("returns false when nothing changes", () => {
		const service: Service = {
			id: "test-1",
			label: "com.test",
			displayName: "Test",
			type: "LaunchDaemon",
			domain: "system",
			status: "running",
			protection: "normal",
			pid: 1234,
			enabled: true,
			isAppleService: false,
			requiresRoot: false,
		};

		expect(hasServiceChanged(service, service)).toBe(false);
	});
});

describe("mergeServices", () => {
	test("returns null when no services changed", () => {
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

		const result = mergeServices(services, services);
		expect(result).toBeNull();
	});

	test("returns new array when services added", () => {
		const oldServices: Service[] = [
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
		const newServices: Service[] = [
			...oldServices,
			{
				id: "test-2",
				label: "com.test2",
				displayName: "Test 2",
				type: "LaunchAgent",
				domain: "user",
				status: "stopped",
				protection: "normal",
				enabled: false,
				isAppleService: false,
				requiresRoot: false,
			},
		];

		const result = mergeServices(oldServices, newServices);
		expect(result).toEqual(newServices);
	});

	test("returns merged array when services changed", () => {
		const oldServices: Service[] = [
			{
				id: "test-1",
				label: "com.test",
				displayName: "Test",
				type: "LaunchDaemon",
				domain: "system",
				status: "stopped",
				protection: "normal",
				enabled: true,
				isAppleService: false,
				requiresRoot: false,
			},
		];
		const oldService = oldServices[0];
		if (!oldService) throw new Error("Test setup failed");
		const newServices: Service[] = [
			{
				id: oldService.id,
				label: oldService.label,
				displayName: oldService.displayName,
				type: oldService.type,
				domain: oldService.domain,
				status: "running",
				protection: oldService.protection,
				enabled: oldService.enabled,
				isAppleService: oldService.isAppleService,
				requiresRoot: oldService.requiresRoot,
				pid: 1234,
			},
		];

		const result = mergeServices(oldServices, newServices);
		expect(result).toEqual(newServices);
		expect(result).not.toBeNull();
	});
});
