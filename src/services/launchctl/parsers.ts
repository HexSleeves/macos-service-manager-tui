/**
 * Parsers for launchctl output
 */

import type { ParsedListEntry } from "./types";

// ============================================================================
// Helper Functions
// ============================================================================

/** Check if a line is a header line */
function isHeaderLine(line: string): boolean {
	const lower = line.toLowerCase();
	return lower.includes("pid") && (lower.includes("status") || lower.includes("label"));
}

/** Check if a line is an error/warning message */
function isErrorOrWarningLine(line: string): boolean {
	const trimmed = line.trim();
	const lower = trimmed.toLowerCase();

	if (/^(-|\d+)\s/.test(trimmed)) return false;

	return (
		lower.startsWith("could not") ||
		lower.startsWith("error:") ||
		lower.startsWith("warning:") ||
		lower.startsWith("failed") ||
		lower.startsWith("unable to") ||
		lower.includes("permission denied") ||
		lower.includes("operation not permitted") ||
		lower.includes("contact daemon") ||
		lower.includes("no such service") ||
		lower.includes("service not found")
	);
}

/** Parse optional number value */
function parseOptionalNumber(value: string): number | undefined {
	const trimmed = value.trim();
	if (trimmed === "-" || trimmed === "") return undefined;
	if (trimmed.startsWith("0x")) return Number.parseInt(trimmed, 16);
	const num = Number.parseInt(trimmed, 10);
	return Number.isNaN(num) ? undefined : num;
}

// ============================================================================
// launchctl list parsing
// ============================================================================

/** Parse line with tab separators */
function parseLineWithTabs(line: string): ParsedListEntry | null {
	const parts = line.split("\t").map((p) => p.trim());
	if (parts.length < 3) return null;

	const [pidPart, statusPart, labelPart] = parts;
	if (!pidPart || !statusPart || !labelPart) return null;
	if (!labelPart.match(/^[a-zA-Z0-9._-]+$/)) return null;

	return {
		pid: parseOptionalNumber(pidPart),
		exitStatus: parseOptionalNumber(statusPart),
		label: labelPart,
	};
}

/** Parse line with space separators */
function parseLineWithSpaces(line: string): ParsedListEntry | null {
	const parts = line.split(/\s+/).filter((p) => p.length > 0);
	if (parts.length < 3) return null;

	const [pidPart, statusPart, labelPart] = parts;
	if (!pidPart || !statusPart || !labelPart) return null;
	if (!labelPart.match(/^[a-zA-Z0-9._-]+$/)) return null;

	return {
		pid: parseOptionalNumber(pidPart),
		exitStatus: parseOptionalNumber(statusPart),
		label: labelPart,
	};
}

/** Parse a single list line */
function parseListLine(line: string): ParsedListEntry | null {
	const trimmedLine = line.trim();
	if (!trimmedLine) return null;
	if (isHeaderLine(trimmedLine)) return null;
	if (isErrorOrWarningLine(trimmedLine)) return null;

	return parseLineWithTabs(trimmedLine) || parseLineWithSpaces(trimmedLine);
}

/**
 * Parse the output of `launchctl list` command
 */
export function parseLaunchctlList(output: string): ParsedListEntry[] {
	if (!output || output.trim() === "") return [];

	const lines = output.split("\n");
	const services: ParsedListEntry[] = [];

	for (const line of lines) {
		const parsed = parseListLine(line);
		if (parsed) services.push(parsed);
	}

	return services;
}

// ============================================================================
// launchctl print parsing
// ============================================================================

/** Key normalizations - maps various formats to normalized form */
const KEY_NORMALIZATIONS: Record<string, string> = {
	// PID variations
	pid: "pid",
	process_id: "pid",
	"process id": "pid",
	processid: "pid",

	// Exit status variations
	last_exit_code: "last_exit_code",
	"last exit code": "last_exit_code",
	lastexitcode: "last_exit_code",
	last_exit_status: "last_exit_status",
	"last exit status": "last_exit_status",
	lastexitstatus: "last_exit_status",
	exit_status: "exit_status",
	"exit status": "exit_status",
	exitstatus: "exit_status",

	// State variations
	status: "state",
	state: "state",
	run_state: "run_state",
	runstate: "run_state",

	// Other keys
	path: "path",
	program: "program",
	enabled: "enabled",
	disabled: "disabled",
	ondemand: "ondemand",
	on_demand: "ondemand",
	spawn_type: "spawn_type",
	spawntype: "spawn_type",
	label: "label",
};

/** Normalize a key name */
export function normalizePrintKey(key: string): string {
	// First, try direct lookup with lowercase
	const lowerKey = key.toLowerCase().trim();
	if (KEY_NORMALIZATIONS[lowerKey]) {
		return KEY_NORMALIZATIONS[lowerKey];
	}

	// Handle camelCase by inserting underscores
	let normalized = lowerKey.replace(/([a-z])([A-Z])/g, "$1_$2").toLowerCase();
	normalized = normalized.replace(/-/g, "_");
	normalized = normalized.replace(/[\s]+/g, "_");

	// Try lookup after normalization
	const normalizedLookup = KEY_NORMALIZATIONS[normalized];
	if (normalizedLookup) {
		return normalizedLookup;
	}

	// Try without underscores (for variations like "lastExitStatus" -> "lastexitstatus")
	const noUnderscores = normalized.replace(/_/g, "");
	const noUnderscoresLookup = KEY_NORMALIZATIONS[noUnderscores];
	if (noUnderscoresLookup) {
		return noUnderscoresLookup;
	}

	return normalized;
}

/** Get indentation level */
function _getIndentLevel(line: string): number {
	const match = line.match(/^(\s*)/);
	if (!match?.[1]) return 0;
	let level = 0;
	for (const char of match[1]) {
		if (char === "\t") level += 1;
		else level += 0.25;
	}
	return Math.floor(level);
}

/** Parse "key = value" format */
function parseEqualsFormat(line: string): { key: string; value: string } | null {
	const match = line.match(/^\s*([\w\s-]+)\s*=\s*(.+)$/);
	if (match?.[1] && match[2]) {
		return { key: match[1].trim(), value: match[2].trim() };
	}
	return null;
}

/** Parse "key: value" format */
function parseColonFormat(line: string): { key: string; value: string } | null {
	const match = line.match(/^([a-zA-Z][\w\s-]*):\s+(.+)$/);
	if (match?.[1] && match[2]) {
		return { key: match[1].trim(), value: match[2].trim() };
	}
	return null;
}

/** Parse plist-style format */
function parsePlistFormat(line: string): { key: string; value: string } | null {
	const match = line.match(/^\s*"([^"]+)"\s*=\s*(.+);\s*$/);
	if (match?.[1] && match[2]) {
		let value = match[2].trim();
		if (value.startsWith('"') && value.endsWith('"')) {
			value = value.slice(1, -1);
		}
		return { key: match[1].trim(), value };
	}
	return null;
}

/**
 * Parse `launchctl print` output
 */
export function parseLaunchctlPrint(output: string): Record<string, string> {
	const info: Record<string, string> = {};
	if (!output || output.trim() === "") return info;

	const lines = output.split("\n");
	let inNestedBlock = false;
	let nestedBlockDepth = 0;

	for (const line of lines) {
		if (!line.trim()) continue;
		if (isErrorOrWarningLine(line)) continue;

		const trimmed = line.trim();
		if (trimmed === "{" || trimmed === "}") {
			if (trimmed === "}") {
				if (nestedBlockDepth > 0) nestedBlockDepth--;
				if (nestedBlockDepth === 0) inNestedBlock = false;
			}
			continue;
		}

		if (trimmed.endsWith("= {") || trimmed.endsWith("={")) continue;

		if (trimmed.endsWith("{")) {
			nestedBlockDepth++;
			inNestedBlock = true;
			continue;
		}

		if (inNestedBlock && nestedBlockDepth > 0) {
			if (trimmed === "}") {
				nestedBlockDepth--;
				if (nestedBlockDepth === 0) inNestedBlock = false;
			}
			continue;
		}

		const parsed = parseEqualsFormat(line) || parseColonFormat(line) || parsePlistFormat(line);

		if (parsed) {
			const normalizedKey = normalizePrintKey(parsed.key);
			if (!(normalizedKey in info)) {
				info[normalizedKey] = parsed.value;
			}
		}
	}

	return info;
}
