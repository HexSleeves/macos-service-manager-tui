/**
 * Unit tests for launchctl parsing functions
 */

import { describe, expect, it } from "bun:test";
import {
	getMacOSVersion,
	normalizePrintKey,
	parseLaunchctlList,
	parseLaunchctlPrint,
} from "../launchctl/index";
import {
	EXPECTED_LIST_NO_HEADER,
	EXPECTED_LIST_STANDARD,
	LIST_EMPTY,
	LIST_EXTRA_WHITESPACE,
	LIST_HEADER_ONLY,
	LIST_LARGE_PIDS,
	LIST_MIXED_SEPARATORS,
	LIST_NO_HEADER,
	LIST_SEQUOIA,
	LIST_SPACE_SEPARATED,
	LIST_STANDARD,
	LIST_UNUSUAL_LABELS,
	LIST_WITH_ERROR,
	PRINT_BIG_SUR,
	PRINT_CATALINA,
	PRINT_DISABLED,
	PRINT_EMPTY,
	PRINT_ERROR,
	PRINT_HEX_VALUES,
	PRINT_LEGACY,
	PRINT_MODERN,
	PRINT_NESTED,
	PRINT_NOT_FOUND,
	PRINT_PARTIAL_ERROR,
	PRINT_SEQUOIA,
	PRINT_STOPPED,
	PRINT_VENTURA,
} from "./launchctl-fixtures";

describe("parseLaunchctlList", () => {
	it("parses standard tab-separated format", () => {
		const result = parseLaunchctlList(LIST_STANDARD);
		expect(result).toEqual(EXPECTED_LIST_STANDARD);
	});

	it("handles extra whitespace", () => {
		const result = parseLaunchctlList(LIST_EXTRA_WHITESPACE);
		expect(result.length).toBe(2);
		expect(result[0]).toEqual({
			pid: undefined,
			exitStatus: 0,
			label: "com.apple.syslogd",
		});
		expect(result[1]).toEqual({
			pid: 1234,
			exitStatus: 0,
			label: "com.example.running",
		});
	});

	it("handles space-separated format", () => {
		const result = parseLaunchctlList(LIST_SPACE_SEPARATED);
		expect(result.length).toBe(3);
		expect(result[0]?.label).toBe("com.apple.syslogd");
		expect(result[1]?.pid).toBe(1234);
		expect(result[2]?.exitStatus).toBe(78);
	});

	it("handles mixed separators", () => {
		const result = parseLaunchctlList(LIST_MIXED_SEPARATORS);
		expect(result.length).toBe(3);
		expect(result[0]?.label).toBe("com.apple.syslogd");
		expect(result[1]?.label).toBe("com.example.running");
		expect(result[2]?.label).toBe("com.example.error");
	});

	it("handles output without header", () => {
		const result = parseLaunchctlList(LIST_NO_HEADER);
		expect(result).toEqual(EXPECTED_LIST_NO_HEADER);
	});

	it("returns empty array for empty output", () => {
		const result = parseLaunchctlList(LIST_EMPTY);
		expect(result).toEqual([]);
	});

	it("returns empty array for header-only output", () => {
		const result = parseLaunchctlList(LIST_HEADER_ONLY);
		expect(result).toEqual([]);
	});

	it("filters out error messages in output", () => {
		const result = parseLaunchctlList(LIST_WITH_ERROR);
		expect(result.length).toBe(2);
		expect(result[0]?.label).toBe("com.apple.syslogd");
		expect(result[1]?.label).toBe("com.example.running");
	});

	it("handles large PIDs and negative exit codes", () => {
		const result = parseLaunchctlList(LIST_LARGE_PIDS);
		expect(result.length).toBe(3);
		expect(result[0]?.pid).toBe(99999);
		expect(result[1]?.pid).toBe(1234567);
		expect(result[2]?.exitStatus).toBe(-1);
	});

	it("handles unusual label characters", () => {
		const result = parseLaunchctlList(LIST_UNUSUAL_LABELS);
		expect(result.length).toBe(4);
		expect(result[0]?.label).toBe("com.example.with-dash");
		expect(result[1]?.label).toBe("com.example.with_underscore");
		expect(result[2]?.label).toBe("com.example.with.many.dots");
		expect(result[3]?.label).toBe("0com.starts.with.number");
	});

	it("handles format with extra columns (Sequoia)", () => {
		const result = parseLaunchctlList(LIST_SEQUOIA);
		expect(result.length).toBe(2);
		expect(result[0]?.label).toBe("com.apple.syslogd");
		expect(result[1]?.label).toBe("com.example.running");
	});
});

describe("parseLaunchctlPrint", () => {
	it("parses modern format with braces", () => {
		const result = parseLaunchctlPrint(PRINT_MODERN);
		expect(result.path).toBe("/Library/LaunchDaemons/com.example.myservice.plist");
		expect(result.state).toBe("running");
		expect(result.program).toBe("/usr/local/bin/myservice");
		expect(result.pid).toBe("1234");
		expect(result.last_exit_code).toBe("0");
	});

	it("parses stopped service", () => {
		const result = parseLaunchctlPrint(PRINT_STOPPED);
		expect(result.state).toBe("not running");
		expect(result.pid).toBeUndefined();
	});

	it("parses service with error", () => {
		const result = parseLaunchctlPrint(PRINT_ERROR);
		expect(result.last_exit_code).toBe("78");
		expect(result.last_spawn_error).toBe("EPERM");
	});

	it("parses disabled service", () => {
		const result = parseLaunchctlPrint(PRINT_DISABLED);
		expect(result.state).toBe("disabled");
	});

	it("parses Ventura format with additional fields", () => {
		const result = parseLaunchctlPrint(PRINT_VENTURA);
		expect(result.path).toBe("/System/Library/LaunchAgents/com.apple.sharingd.plist");
		expect(result.pid).toBe("456");
		expect(result.enabled).toBe("true");
		expect(result.run_state).toBe("running");
		expect(result.processtype).toBe("Background");
	});

	it("parses Catalina format with different key names", () => {
		const result = parseLaunchctlPrint(PRINT_CATALINA);
		// Should normalize PID -> pid
		expect(result.pid).toBe("789");
		// Should have exit status normalized
		expect(result.last_exit_status || result.lastexitstatus).toBeDefined();
	});

	it("parses Big Sur format", () => {
		const result = parseLaunchctlPrint(PRINT_BIG_SUR);
		expect(result.state).toBe("running");
		expect(result.pid).toBe("321");
		expect(result.last_exit_status).toBe("0");
	});

	it("parses legacy plist-style format", () => {
		const result = parseLaunchctlPrint(PRINT_LEGACY);
		expect(result.label).toBe("com.example.legacy");
		expect(result.program).toBe("/usr/bin/legacy");
		expect(result.pid).toBe("555");
	});

	it("parses nested structures (extracts top-level only)", () => {
		const result = parseLaunchctlPrint(PRINT_NESTED);
		expect(result.path).toBe("/System/Library/LaunchDaemons/com.apple.complex.plist");
		expect(result.state).toBe("running");
		expect(result.pid).toBe("111");
	});

	it("returns empty object for empty output", () => {
		const result = parseLaunchctlPrint(PRINT_EMPTY);
		expect(Object.keys(result).length).toBe(0);
	});

	it("returns empty object for not-found error", () => {
		const result = parseLaunchctlPrint(PRINT_NOT_FOUND);
		expect(Object.keys(result).length).toBe(0);
	});

	it("filters out warning messages", () => {
		const result = parseLaunchctlPrint(PRINT_PARTIAL_ERROR);
		expect(result.path).toBe("/Library/LaunchDaemons/com.example.partial.plist");
		expect(result.state).toBe("running");
	});

	it("parses Sequoia colon-separated format", () => {
		const result = parseLaunchctlPrint(PRINT_SEQUOIA);
		expect(result.path).toBe("/Library/LaunchDaemons/com.example.sequoia.plist");
		expect(result.state).toBe("running");
		expect(result.pid).toBe("9999");
	});

	it("handles hex values", () => {
		const result = parseLaunchctlPrint(PRINT_HEX_VALUES);
		expect(result.pid).toBe("0x1a2b");
		expect(result.state).toBe("running");
	});
});

describe("normalizePrintKey", () => {
	it("normalizes various PID key names", () => {
		expect(normalizePrintKey("PID")).toBe("pid");
		expect(normalizePrintKey("pid")).toBe("pid");
		expect(normalizePrintKey("process id")).toBe("pid");
		expect(normalizePrintKey("process-id")).toBe("pid");
	});

	it("normalizes exit status key names", () => {
		expect(normalizePrintKey("last exit code")).toBe("last_exit_code");
		expect(normalizePrintKey("last exit status")).toBe("last_exit_status");
		expect(normalizePrintKey("lastExitStatus")).toBe("last_exit_status");
		expect(normalizePrintKey("LastExitStatus")).toBe("last_exit_status");
		expect(normalizePrintKey("last-exit-code")).toBe("last_exit_code");
	});

	it("normalizes state/status keys", () => {
		expect(normalizePrintKey("state")).toBe("state");
		expect(normalizePrintKey("status")).toBe("state");
		expect(normalizePrintKey("run state")).toBe("run_state");
	});

	it("handles spaces and special characters", () => {
		expect(normalizePrintKey("spawn type")).toBe("spawn_type");
		expect(normalizePrintKey("active count")).toBe("active_count");
	});
});

describe("getMacOSVersion", () => {
	// This test is mostly for coverage - actual version detection happens at runtime
	it("returns a MacOSVersion object", async () => {
		const version = await getMacOSVersion();
		expect(version).toBeDefined();
		expect(typeof version.major).toBe("number");
		expect(typeof version.minor).toBe("number");
		expect(typeof version.name).toBe("string");
	});
});
