/**
 * Tests for utility functions
 */

import { describe, expect, test } from "bun:test";
import type { Service } from "../../types";
import { hasServiceChanged, mergeServices } from "../utils";

// ============================================================================
// Factory helper
// ============================================================================

function createMockService(overrides: Partial<Service> = {}): Service {
	return {
		id: "test-1",
		label: "com.test.service",
		displayName: "service",
		type: "LaunchDaemon",
		domain: "system",
		status: "running",
		protection: "normal",
		enabled: true,
		isAppleService: false,
		requiresRoot: false,
		...overrides,
	};
}

// ============================================================================
// hasServiceChanged
// ============================================================================

describe("hasServiceChanged", () => {
	test("returns true when status changes", () => {
		const old = createMockService({ status: "stopped" });
		const updated = createMockService({ status: "running" });
		expect(hasServiceChanged(old, updated)).toBe(true);
	});

	test("returns true when PID changes", () => {
		const old = createMockService({ pid: 1234 });
		const updated = createMockService({ pid: 5678 });
		expect(hasServiceChanged(old, updated)).toBe(true);
	});

	test("returns true when enabled changes", () => {
		const old = createMockService({ enabled: true });
		const updated = createMockService({ enabled: false });
		expect(hasServiceChanged(old, updated)).toBe(true);
	});

	test("returns true when exitStatus changes", () => {
		const old = createMockService({ exitStatus: 0 });
		const updated = createMockService({ exitStatus: 1 });
		expect(hasServiceChanged(old, updated)).toBe(true);
	});

	test("returns true when lastError changes", () => {
		const old = createMockService({ lastError: undefined });
		const updated = createMockService({ lastError: "crash" });
		expect(hasServiceChanged(old, updated)).toBe(true);
	});

	test("returns false when nothing changes", () => {
		const service = createMockService();
		expect(hasServiceChanged(service, service)).toBe(false);
	});

	test("returns false when non-volatile fields change", () => {
		const old = createMockService({ description: "old" });
		const updated = createMockService({ description: "new" });
		expect(hasServiceChanged(old, updated)).toBe(false);
	});
});

// ============================================================================
// mergeServices
// ============================================================================

describe("mergeServices", () => {
	test("returns null when no services changed", () => {
		const services = [createMockService()];
		expect(mergeServices(services, services)).toBeNull();
	});

	test("returns null for identical separate arrays", () => {
		const a = [createMockService({ id: "a" }), createMockService({ id: "b" })];
		const b = [createMockService({ id: "a" }), createMockService({ id: "b" })];
		expect(mergeServices(a, b)).toBeNull();
	});

	test("returns new array when services added", () => {
		const old = [createMockService({ id: "a" })];
		const updated = [createMockService({ id: "a" }), createMockService({ id: "b" })];
		const result = mergeServices(old, updated);
		expect(result).toEqual(updated);
	});

	test("returns new array when services removed", () => {
		const old = [createMockService({ id: "a" }), createMockService({ id: "b" })];
		const updated = [createMockService({ id: "a" })];
		const result = mergeServices(old, updated);
		expect(result).toEqual(updated);
	});

	test("returns merged array when services changed", () => {
		const old = [createMockService({ id: "a", status: "stopped" })];
		const updated = [createMockService({ id: "a", status: "running", pid: 1234 })];
		const result = mergeServices(old, updated);
		expect(result).not.toBeNull();
		expect(result?.[0]?.status).toBe("running");
		expect(result?.[0]?.pid).toBe(1234);
	});

	test("preserves old references for unchanged services", () => {
		const svcA = createMockService({ id: "a", status: "stopped" });
		const svcB = createMockService({ id: "b", status: "running", pid: 100 });
		const old = [svcA, svcB];
		const updated = [
			createMockService({ id: "a", status: "running", pid: 999 }),
			createMockService({ id: "b", status: "running", pid: 100 }),
		];
		const result = mergeServices(old, updated);
		expect(result).not.toBeNull();
		// svcA changed, so new reference
		expect(result?.[0]).not.toBe(svcA);
		// svcB unchanged, so same reference preserved
		expect(result?.[1]).toBe(svcB);
	});

	test("handles empty old array", () => {
		const updated = [createMockService({ id: "a" })];
		const result = mergeServices([], updated);
		expect(result).toEqual(updated);
	});

	test("handles empty new array", () => {
		const old = [createMockService({ id: "a" })];
		const result = mergeServices(old, []);
		expect(result).toEqual([]);
	});

	test("handles both arrays empty", () => {
		expect(mergeServices([], [])).toBeNull();
	});
});
