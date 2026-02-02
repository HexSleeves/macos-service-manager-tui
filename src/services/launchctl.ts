/**
 * macOS launchctl command parsing and execution
 * Based on: https://rakhesh.com/mac/macos-launchctl-commands/
 *
 * Supports output format variations across macOS versions:
 * - macOS 10.14 Mojave through macOS 15 Sequoia
 * - Handles tab-separated, space-separated, and mixed formats
 * - Normalizes key names across different launchctl versions
 */

import { spawn, spawnSync } from "bun";
import type {
	ActionResult,
	PlistMetadata,
	ProtectionStatus,
	RetryInfo,
	Service,
	ServiceAction,
	ServiceDomain,
	ServiceStatus,
} from "../types";
import { isTransientError, type RetryOptions, withRetry } from "../utils/retry";
import { describePlistConfig, readPlist } from "./plist";

/**
 * Validate a service label to prevent command injection
 * Labels should only contain alphanumeric, dots, hyphens, and underscores
 */
export function isValidServiceLabel(label: string): boolean {
	if (!label || label.length === 0 || label.length > 256) return false;
	// Only allow safe characters in service labels
	const safePattern = /^[a-zA-Z0-9._-]+$/;
	return safePattern.test(label);
}

/**
 * Sanitize a service label (validate and return or throw)
 */
function validateLabel(label: string): string {
	if (!isValidServiceLabel(label)) {
		throw new Error(`Invalid service label: ${label}`);
	}
	return label;
}

// Standard plist directories
export const PLIST_DIRECTORIES = {
	systemDaemons: "/Library/LaunchDaemons",
	systemAgents: "/Library/LaunchAgents",
	userAgents: "~/Library/LaunchAgents",
	appleDaemons: "/System/Library/LaunchDaemons",
	appleAgents: "/System/Library/LaunchAgents",
} as const;

/** Default command timeout in milliseconds */
const DEFAULT_TIMEOUT_MS = 30000;

/** Command result type */
interface CommandResult {
	stdout: string;
	stderr: string;
	exitCode: number;
}

/** Command result with retry info */
interface CommandResultWithRetry extends CommandResult {
	retryInfo?: RetryInfo;
}

/** Retry callback for logging */
let retryLogger:
	| ((attempt: number, error: Error, delayMs: number) => void)
	| null = null;

/**
 * Set a callback to be called when retries occur
 * Useful for logging or UI updates
 */
export function setRetryLogger(
	logger: ((attempt: number, error: Error, delayMs: number) => void) | null,
): void {
	retryLogger = logger;
}

/**
 * Execute a shell command and return stdout/stderr with timeout (single attempt)
 */
async function execCommandOnce(
	command: string,
	args: string[],
	timeoutMs: number = DEFAULT_TIMEOUT_MS,
): Promise<CommandResult> {
	const proc = spawn([command, ...args], {
		stdout: "pipe",
		stderr: "pipe",
	});

	// Create a timeout promise
	const timeoutPromise = new Promise<never>((_, reject) => {
		setTimeout(() => {
			proc.kill();
			reject(new Error(`Command timed out after ${timeoutMs}ms`));
		}, timeoutMs);
	});

	// Race between command completion and timeout
	const [stdout, stderr, exitCode] = await Promise.race([
		Promise.all([
			new Response(proc.stdout).text(),
			new Response(proc.stderr).text(),
			proc.exited,
		]),
		timeoutPromise,
	]);

	return { stdout, stderr, exitCode };
}

/**
 * Execute a shell command and return stdout/stderr with timeout
 * Does not use retry logic - use execCommandWithRetry for service operations
 */
async function execCommand(
	command: string,
	args: string[],
	timeoutMs: number = DEFAULT_TIMEOUT_MS,
): Promise<CommandResult> {
	try {
		return await execCommandOnce(command, args, timeoutMs);
	} catch (error) {
		return {
			stdout: "",
			stderr: error instanceof Error ? error.message : "Unknown error",
			exitCode: 1,
		};
	}
}

/**
 * Execute a shell command with automatic retry for transient failures
 */
async function execCommandWithRetry(
	command: string,
	args: string[],
	timeoutMs: number = DEFAULT_TIMEOUT_MS,
	retryOptions?: RetryOptions,
): Promise<CommandResultWithRetry> {
	const options: RetryOptions = {
		maxRetries: 3,
		initialDelayMs: 1000,
		exponentialBackoff: true,
		maxDelayMs: 10000,
		onRetry: retryLogger ?? undefined,
		...retryOptions,
	};

	try {
		const result = await withRetry(async () => {
			const cmdResult = await execCommandOnce(command, args, timeoutMs);

			// Check if the error in stderr is transient and should trigger a retry
			if (cmdResult.exitCode !== 0 && isTransientError(cmdResult.stderr)) {
				throw new Error(
					cmdResult.stderr ||
						`Command failed with exit code ${cmdResult.exitCode}`,
				);
			}

			return cmdResult;
		}, options);

		return {
			...result.value,
			retryInfo: result.retried
				? {
						attempts: result.attempts,
						retried: result.retried,
						retryErrors: result.retryErrors,
					}
				: undefined,
		};
	} catch (error) {
		// All retries exhausted or permanent error
		return {
			stdout: "",
			stderr: error instanceof Error ? error.message : "Unknown error",
			exitCode: 1,
			retryInfo: {
				attempts: (options.maxRetries ?? 3) + 1,
				retried: true,
				retryErrors: [error instanceof Error ? error.message : "Unknown error"],
			},
		};
	}
}

// ============================================================================
// macOS Version Detection
// ============================================================================

/** macOS version information */
export interface MacOSVersion {
	/** Major version number (e.g., 14 for Sonoma) */
	major: number;
	/** Minor version number */
	minor: number;
	/** Patch version number */
	patch: number;
	/** Full version string (e.g., "14.2.1") */
	full: string;
	/** Marketing name (e.g., "Sonoma") */
	name: string;
}

/** Cached macOS version to avoid repeated sw_vers calls */
let cachedMacOSVersion: MacOSVersion | null = null;

/**
 * Get the macOS version information
 * Uses sw_vers command and caches the result
 */
export function getMacOSVersion(): MacOSVersion {
	if (cachedMacOSVersion) {
		return cachedMacOSVersion;
	}

	let versionString = "10.15.0"; // Default fallback

	try {
		const result = spawnSync(["sw_vers", "-productVersion"], {
			stdout: "pipe",
			stderr: "pipe",
		});
		if (result.exitCode === 0) {
			versionString = new TextDecoder().decode(result.stdout).trim();
		}
	} catch {
		// Ignore errors, use fallback
	}

	const parts = versionString.split(".").map(Number);
	const major = parts[0] ?? 10;
	const minor = parts[1] ?? 15;
	const patch = parts[2] ?? 0;

	// Map major version to marketing name
	const versionNames: Record<number, string> = {
		10: minor <= 14 ? "Mojave or earlier" : "Catalina",
		11: "Big Sur",
		12: "Monterey",
		13: "Ventura",
		14: "Sonoma",
		15: "Sequoia",
	};

	cachedMacOSVersion = {
		major,
		minor,
		patch,
		full: versionString,
		name: versionNames[major] ?? "Unknown",
	};

	return cachedMacOSVersion;
}

// ============================================================================
// launchctl list parsing
// ============================================================================

/** Parsed service entry from launchctl list */
export interface ParsedListEntry {
	pid: number | undefined;
	exitStatus: number | undefined;
	label: string;
}

/**
 * Check if a line looks like a header line
 */
function isHeaderLine(line: string): boolean {
	const lower = line.toLowerCase();
	return (
		lower.includes("pid") &&
		(lower.includes("status") || lower.includes("label"))
	);
}

/**
 * Check if a line looks like an error or warning message (not a valid data line)
 * Must be careful not to match service labels that contain words like "error"
 */
function isErrorOrWarningLine(line: string): boolean {
	const trimmed = line.trim();
	const lower = trimmed.toLowerCase();

	// If line looks like a launchctl list data line (starts with PID or "-"), it's not an error
	if (/^(-|\d+)\s/.test(trimmed)) {
		return false;
	}

	// Common error message patterns that wouldn't appear in data lines
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

/**
 * Parse a value that might be "-" or a number
 */
function parseOptionalNumber(value: string): number | undefined {
	const trimmed = value.trim();
	if (trimmed === "-" || trimmed === "") {
		return undefined;
	}
	// Handle hex numbers (e.g., 0x1a2b)
	if (trimmed.startsWith("0x")) {
		return Number.parseInt(trimmed, 16);
	}
	const num = Number.parseInt(trimmed, 10);
	return Number.isNaN(num) ? undefined : num;
}

/**
 * Try to parse a line using tab separators
 */
function parseLineWithTabs(line: string): ParsedListEntry | null {
	const parts = line.split("\t").map((p) => p.trim());
	if (parts.length < 3) return null;

	const [pidPart, statusPart, labelPart] = parts;
	if (!pidPart || !statusPart || !labelPart) return null;

	// Validate that label looks like a service label
	if (!labelPart.match(/^[a-zA-Z0-9._-]+$/)) return null;

	return {
		pid: parseOptionalNumber(pidPart),
		exitStatus: parseOptionalNumber(statusPart),
		label: labelPart,
	};
}

/**
 * Try to parse a line using space separators (multiple spaces)
 */
function parseLineWithSpaces(line: string): ParsedListEntry | null {
	// Split on multiple whitespace
	const parts = line.split(/\s+/).filter((p) => p.length > 0);
	if (parts.length < 3) return null;

	const [pidPart, statusPart, labelPart] = parts;
	if (!pidPart || !statusPart || !labelPart) return null;

	// Validate that label looks like a service label
	if (!labelPart.match(/^[a-zA-Z0-9._-]+$/)) return null;

	return {
		pid: parseOptionalNumber(pidPart),
		exitStatus: parseOptionalNumber(statusPart),
		label: labelPart,
	};
}

/**
 * Parse a single line trying multiple strategies
 */
function parseListLine(line: string): ParsedListEntry | null {
	const trimmedLine = line.trim();
	if (!trimmedLine) return null;

	// Skip header and error lines
	if (isHeaderLine(trimmedLine)) return null;
	if (isErrorOrWarningLine(trimmedLine)) return null;

	// Try tab-separated first (most common)
	const tabResult = parseLineWithTabs(trimmedLine);
	if (tabResult) return tabResult;

	// Fall back to space-separated
	const spaceResult = parseLineWithSpaces(trimmedLine);
	if (spaceResult) return spaceResult;

	return null;
}

/**
 * Parse the output of `launchctl list` command
 *
 * Handles multiple output format variations:
 * - Tab-separated (standard): PID\tStatus\tLabel
 * - Space-separated (legacy/terminal): PID  Status  Label
 * - Mixed separators
 * - With or without header line
 * - With error messages mixed in
 *
 * @param output - Raw stdout from launchctl list command
 * @returns Array of parsed service entries
 */
export function parseLaunchctlList(output: string): ParsedListEntry[] {
	if (!output || output.trim() === "") {
		return [];
	}

	const lines = output.split("\n");
	const services: ParsedListEntry[] = [];

	for (const line of lines) {
		const parsed = parseListLine(line);
		if (parsed) {
			services.push(parsed);
		}
	}

	return services;
}

// ============================================================================
// launchctl print parsing
// ============================================================================

/**
 * Key name normalization map for consistent access across macOS versions
 * Maps various key formats to a normalized form
 */
const KEY_NORMALIZATIONS: Record<string, string> = {
	// PID variations
	pid: "pid",
	"process id": "pid",
	"process-id": "pid",
	processid: "pid",

	// Exit status variations
	"last exit code": "last_exit_code",
	"last-exit-code": "last_exit_code",
	lastexitcode: "last_exit_code",
	"last exit status": "last_exit_status",
	"last-exit-status": "last_exit_status",
	lastexitstatus: "last_exit_status",
	exitstatus: "exit_status",
	"exit status": "exit_status",
	"exit-status": "exit_status",

	// State/status variations (normalize 'status' to 'state' for consistency)
	status: "state",
	state: "state",
	"run state": "run_state",
	"run-state": "run_state",
	runstate: "run_state",

	// Path variations
	path: "path",
	program: "program",
	executable: "program",

	// Enable variations
	enabled: "enabled",
	disabled: "disabled",

	// On-demand variations
	ondemand: "ondemand",
	"on demand": "ondemand",
	"on-demand": "ondemand",

	// Spawn variations
	"spawn type": "spawn_type",
	"spawn-type": "spawn_type",
	spawntype: "spawn_type",
	"last spawn error": "last_spawn_error",
	"last-spawn-error": "last_spawn_error",
	lastspawnerror: "last_spawn_error",
	last_spawn_error: "last_spawn_error",

	// Other common keys
	"active count": "active_count",
	"active-count": "active_count",
	activecount: "active_count",
	runs: "runs",
	label: "label",
	priority: "priority",
	processtype: "processtype",
	"process type": "processtype",
	"process-type": "processtype",
};

/**
 * Normalize a key name to a consistent format
 * Handles camelCase, PascalCase, kebab-case, and space-separated keys
 *
 * @param key - Raw key name from launchctl output
 * @returns Normalized key name (lowercase with underscores)
 */
export function normalizePrintKey(key: string): string {
	// First, convert to lowercase and standardize
	let normalized = key.toLowerCase().trim();

	// Handle camelCase and PascalCase by inserting underscores
	normalized = normalized.replace(/([a-z])([A-Z])/g, "$1_$2").toLowerCase();

	// Replace hyphens with underscores
	normalized = normalized.replace(/-/g, "_");

	// Replace multiple spaces/underscores with single underscore
	normalized = normalized.replace(/[\s_]+/g, "_");

	// Check if we have a known normalization
	const lookup = KEY_NORMALIZATIONS[normalized];
	if (lookup) {
		return lookup;
	}

	// Also try the original lowercase key (for keys like "lastExitStatus")
	const lowerKey = key.toLowerCase().replace(/[\s-]+/g, "");
	const lowerLookup = KEY_NORMALIZATIONS[lowerKey];
	if (lowerLookup) {
		return lowerLookup;
	}

	return normalized;
}

/**
 * Check if a line is inside a nested block (has deeper indentation)
 * @param line - The line to check
 * @param baseIndent - The base indentation level of top-level keys
 */
function getIndentLevel(line: string): number {
	const match = line.match(/^(\s*)/);
	if (!match?.[1]) return 0;
	// Count tabs as 1 indent level, spaces as 1/4 (approximate)
	const indent = match[1];
	let level = 0;
	for (const char of indent) {
		if (char === "\t") level += 1;
		else level += 0.25;
	}
	return Math.floor(level);
}

/**
 * Parse a line with "key = value" format (modern launchctl print)
 */
function parseEqualsFormat(
	line: string,
): { key: string; value: string } | null {
	const match = line.match(/^\s*([\w\s-]+)\s*=\s*(.+)$/);
	if (match?.[1] && match[2]) {
		return {
			key: match[1].trim(),
			value: match[2].trim(),
		};
	}
	return null;
}

/**
 * Parse a line with "key: value" format (potential newer format)
 */
function parseColonFormat(line: string): { key: string; value: string } | null {
	// Avoid matching paths like /usr/bin
	const match = line.match(/^([a-zA-Z][\w\s-]*):\s+(.+)$/);
	if (match?.[1] && match[2]) {
		return {
			key: match[1].trim(),
			value: match[2].trim(),
		};
	}
	return null;
}

/**
 * Parse legacy plist-style format: "Key" = "Value";
 */
function parsePlistFormat(line: string): { key: string; value: string } | null {
	const match = line.match(/^\s*"([^"]+)"\s*=\s*(.+);\s*$/);
	if (match?.[1] && match[2]) {
		let value = match[2].trim();
		// Remove surrounding quotes if present
		if (value.startsWith('"') && value.endsWith('"')) {
			value = value.slice(1, -1);
		}
		return {
			key: match[1].trim(),
			value,
		};
	}
	return null;
}

/**
 * Parse `launchctl print` output for detailed service info
 *
 * Handles multiple output format variations:
 * - Modern format: key = value (with braces for nested structures)
 * - Colon format: key: value (potential newer versions)
 * - Legacy plist format: "Key" = "Value";
 * - Various key name conventions across macOS versions
 *
 * @param output - Raw stdout from launchctl print command
 * @returns Object mapping normalized keys to string values
 */
export function parseLaunchctlPrint(output: string): Record<string, string> {
	const info: Record<string, string> = {};

	if (!output || output.trim() === "") {
		return info;
	}

	const lines = output.split("\n");

	// Track nesting depth to skip nested structures
	let inNestedBlock = false;
	let nestedBlockDepth = 0;
	let baseIndent = -1;

	for (const line of lines) {
		// Skip empty lines
		if (!line.trim()) continue;

		// Skip error/warning lines
		if (isErrorOrWarningLine(line)) continue;

		// Skip lines that are just opening/closing braces or service names
		const trimmed = line.trim();
		if (trimmed === "{" || trimmed === "}") {
			if (trimmed === "}") {
				if (nestedBlockDepth > 0) nestedBlockDepth--;
				if (nestedBlockDepth === 0) inNestedBlock = false;
			}
			continue;
		}

		// Skip service header lines (e.g., "com.example.service = {")
		if (trimmed.endsWith("= {") || trimmed.endsWith("={")) {
			continue;
		}

		// Detect and skip nested blocks (e.g., environment = { ... })
		if (trimmed.endsWith("{")) {
			nestedBlockDepth++;
			inNestedBlock = true;
			continue;
		}

		// Skip lines inside nested blocks
		if (inNestedBlock && nestedBlockDepth > 0) {
			if (trimmed === "}") {
				nestedBlockDepth--;
				if (nestedBlockDepth === 0) inNestedBlock = false;
			}
			continue;
		}

		// Determine base indent from first valid key-value line
		const currentIndent = getIndentLevel(line);
		if (baseIndent < 0) {
			baseIndent = currentIndent;
		}

		// Try different parsing formats
		let parsed = parseEqualsFormat(line);

		if (!parsed) {
			parsed = parseColonFormat(line);
		}

		if (!parsed) {
			parsed = parsePlistFormat(line);
		}

		if (parsed) {
			const normalizedKey = normalizePrintKey(parsed.key);
			// Don't overwrite existing values (first occurrence wins)
			if (!(normalizedKey in info)) {
				info[normalizedKey] = parsed.value;
			}
		}
	}

	return info;
}

/**
 * Determine if a service is Apple/system owned
 */
export function isAppleService(label: string, plistPath?: string): boolean {
	if (label.startsWith("com.apple.")) return true;
	if (plistPath?.includes("/System/Library/")) return true;
	return false;
}

/**
 * Determine protection status
 */
export function getProtectionStatus(
	label: string,
	plistPath?: string,
): ProtectionStatus {
	// SIP protected paths
	if (plistPath?.startsWith("/System/")) return "sip-protected";
	if (label.startsWith("com.apple.")) return "system-owned";

	// Known immutable services
	const immutableServices = [
		"com.apple.SystemConfiguration",
		"com.apple.launchd",
		"com.apple.kextd",
	];
	if (immutableServices.some((s) => label.startsWith(s))) return "immutable";

	return "normal";
}

/**
 * Check if the current process is running as root (uid 0)
 * Used to skip sudo when already running with elevated privileges
 */
export function isRunningAsRoot(): boolean {
	return process.getuid?.() === 0;
}

/**
 * Get the current user's UID
 * Returns 501 as fallback (typical first user on macOS)
 */
export function getCurrentUid(): number {
	return process.getuid?.() ?? 501;
}

/**
 * Sudo Decision Matrix for macOS launchctl operations:
 *
 * Location                           | Domain  | Sudo Required?
 * -----------------------------------|---------|---------------
 * ~/Library/LaunchAgents             | user    | NO - user owns these
 * /Library/LaunchAgents              | system  | YES - system-wide, admin required
 * /Library/LaunchDaemons             | system  | YES - system daemons need root
 * /System/Library/LaunchAgents       | system  | SIP - usually can't modify anyway
 * /System/Library/LaunchDaemons      | system  | SIP - usually can't modify anyway
 *
 * Action-specific considerations:
 * - start/stop (kickstart/kill): Needs elevated privileges for system services
 * - enable/disable: Modifies persistent boot state, same privilege requirements
 * - unload (bootout): Same as stop
 * - reload (kickstart -kp): Same as start
 *
 * Note: If already running as root, sudo is never needed.
 */

/**
 * Determine if root/sudo is required for service operations
 *
 * @param domain - The service domain (user/system/gui)
 * @param plistPath - Optional path to the plist file
 * @returns true if sudo would be needed (assuming not already root)
 */
export function requiresRoot(
	domain: ServiceDomain,
	plistPath?: string,
): boolean {
	// User agents in ~/Library/LaunchAgents never need sudo
	// These are owned by the user and operate in user context
	if (plistPath) {
		const homePath = process.env.HOME;
		if (homePath && plistPath.startsWith(`${homePath}/Library/LaunchAgents`)) {
			return false;
		}
		// Also handle ~ shorthand just in case
		if (plistPath.startsWith("~/Library/LaunchAgents")) {
			return false;
		}
	}

	// System domain always requires elevated privileges
	// This includes /Library/LaunchDaemons and /Library/LaunchAgents
	if (domain === "system") {
		return true;
	}

	// System-wide locations require root
	// /Library/* contains system-wide services (not SIP-protected but admin-only)
	if (plistPath?.startsWith("/Library/")) {
		return true;
	}

	// Apple system paths are SIP-protected
	// Sudo won't help, but we still flag it for informational purposes
	if (plistPath?.startsWith("/System/")) {
		return true;
	}

	// User domain services don't require root
	return false;
}

/**
 * Determine if sudo should actually be used for a command
 * Takes into account whether we're already running as root
 *
 * @param needsRoot - Whether the operation conceptually requires root
 * @returns true if sudo should be prefixed to the command
 */
export function shouldUseSudo(needsRoot: boolean): boolean {
	// If already running as root, never need sudo
	if (isRunningAsRoot()) {
		return false;
	}
	// Otherwise, use sudo if the operation requires root
	return needsRoot;
}

/**
 * Get service status from pid and exit status
 */
export function getServiceStatus(
	pid?: number,
	exitStatus?: number,
	enabled: boolean = true,
): ServiceStatus {
	if (!enabled) return "disabled";
	if (pid !== undefined && pid > 0) return "running";
	if (exitStatus !== undefined && exitStatus !== 0) return "error";
	return "stopped";
}

/**
 * List all services using launchctl
 * Uses `launchctl list` which shows services in the current user's domain
 */
export async function listServices(): Promise<Service[]> {
	const services: Service[] = [];
	const seenLabels = new Set<string>();

	// Get user services via launchctl list (works without root)
	const listResult = await execCommand("launchctl", ["list"]);
	if (listResult.exitCode === 0) {
		const parsed = parseLaunchctlList(listResult.stdout);
		for (const { pid, exitStatus, label } of parsed) {
			if (seenLabels.has(label)) continue;
			seenLabels.add(label);

			const plistPath = await findPlistPath(label);
			const protection = getProtectionStatus(label, plistPath);
			const apple = isAppleService(label, plistPath);

			// Read plist metadata
			const { metadata: plistMetadata, description } =
				await getPlistMetadata(plistPath);

			// Determine type and domain based on plist path or label
			const isDaemon =
				plistPath?.includes("LaunchDaemons") ||
				label.includes("daemon") ||
				!plistPath?.includes("LaunchAgents");
			const isSystemLevel =
				plistPath?.startsWith("/Library/") || plistPath?.startsWith("/System/");

			const type: "LaunchDaemon" | "LaunchAgent" =
				isDaemon && isSystemLevel ? "LaunchDaemon" : "LaunchAgent";
			const domain: ServiceDomain = isSystemLevel ? "system" : "user";
			const needsRoot = requiresRoot(domain, plistPath);

			services.push({
				id: `${domain}-${label}`,
				label,
				displayName: label.split(".").pop() || label,
				type,
				domain,
				status: getServiceStatus(pid, exitStatus),
				pid,
				exitStatus,
				protection,
				plistPath,
				description,
				enabled: true,
				isAppleService: apple,
				requiresRoot: needsRoot,
				plistMetadata,
			});
		}
	}

	return services;
}

/**
 * Get detailed info for a specific service
 */
export async function getServiceInfo(
	label: string,
	domain: ServiceDomain,
	type: "LaunchDaemon" | "LaunchAgent",
): Promise<Service | null> {
	const target =
		domain === "system" ? "system" : `user/${process.getuid?.() || 501}`;
	const result = await execCommand("launchctl", [
		"print",
		`${target}/${label}`,
	]);

	if (result.exitCode !== 0) {
		return null;
	}

	const info = parseLaunchctlPrint(result.stdout);
	const plistPath = info.path || (await findPlistPath(label));
	const protection = getProtectionStatus(label, plistPath);
	const apple = isAppleService(label, plistPath);
	const needsRoot = requiresRoot(domain, plistPath);

	// Read plist metadata
	const { metadata: plistMetadata, description } =
		await getPlistMetadata(plistPath);

	const pid = info.pid ? parseInt(info.pid, 10) : undefined;
	const exitStatus = info.last_exit_status
		? parseInt(info.last_exit_status, 10)
		: undefined;
	const enabled = info.state !== "disabled";

	return {
		id: `${domain}-${label}`,
		label,
		displayName: label.split(".").pop() || label,
		type,
		domain,
		status: getServiceStatus(pid, exitStatus, enabled),
		pid,
		exitStatus,
		protection,
		plistPath,
		description,
		enabled,
		isAppleService: apple,
		requiresRoot: needsRoot,
		plistMetadata,
	};
}

/**
 * Find plist path for a service
 */
async function findPlistPath(label: string): Promise<string | undefined> {
	const searchDirs = [
		"/System/Library/LaunchDaemons",
		"/System/Library/LaunchAgents",
		"/Library/LaunchDaemons",
		"/Library/LaunchAgents",
		`${process.env.HOME}/Library/LaunchAgents`,
	];

	for (const dir of searchDirs) {
		const path = `${dir}/${label}.plist`;
		try {
			const file = Bun.file(path);
			if (await file.exists()) {
				return path;
			}
		} catch {}
	}

	return undefined;
}

/**
 * Read plist file and extract metadata for a service
 */
export async function getPlistMetadata(plistPath: string | undefined): Promise<{
	metadata: PlistMetadata | undefined;
	description: string | undefined;
}> {
	if (!plistPath) {
		return { metadata: undefined, description: undefined };
	}

	try {
		const plistData = await readPlist(plistPath);
		if (!plistData) {
			return { metadata: undefined, description: undefined };
		}

		const metadata: PlistMetadata = {
			program: plistData.program,
			programArguments: plistData.programArguments,
			runAtLoad: plistData.runAtLoad,
			keepAlive:
				typeof plistData.keepAlive === "boolean"
					? plistData.keepAlive
					: plistData.keepAlive
						? (plistData.keepAlive as Record<string, unknown>)
						: undefined,
			workingDirectory: plistData.workingDirectory,
			environmentVariables: plistData.environmentVariables,
			standardOutPath: plistData.standardOutPath,
			standardErrorPath: plistData.standardErrorPath,
			startInterval: plistData.startInterval,
			startCalendarInterval: plistData.startCalendarInterval as
				| Record<string, number>
				| Record<string, number>[]
				| undefined,
			processType: plistData.processType,
			watchPaths: plistData.watchPaths,
			queueDirectories: plistData.queueDirectories,
			hasSockets: plistData.sockets
				? Object.keys(plistData.sockets).length > 0
				: false,
			hasMachServices: plistData.machServices
				? Object.keys(plistData.machServices).length > 0
				: false,
		};

		// Generate a description from the plist config
		const description = describePlistConfig(plistData);

		return { metadata, description: description || undefined };
	} catch {
		return { metadata: undefined, description: undefined };
	}
}

/**
 * Execute a service action
 */
export interface ExecuteServiceActionOptions {
	dryRun?: boolean;
}

export interface DryRunResult extends ActionResult {
	command?: string; // The command that would be executed
}

export async function executeServiceAction(
	action: ServiceAction,
	service: Service,
	options: ExecuteServiceActionOptions = {},
): Promise<DryRunResult> {
	const { dryRun = false } = options;
	// Validate service label to prevent command injection
	try {
		validateLabel(service.label);
	} catch (error) {
		return {
			success: false,
			message: `Cannot ${action} service`,
			error: error instanceof Error ? error.message : "Invalid service label",
		};
	}

	// Check protection
	if (
		service.protection === "sip-protected" ||
		service.protection === "immutable"
	) {
		return {
			success: false,
			message: `Cannot ${action} service`,
			error: `Service is protected by System Integrity Protection`,
			sipProtected: true,
		};
	}

	const target =
		service.domain === "system"
			? `system/${service.label}`
			: `gui/${process.getuid?.() || 501}/${service.label}`;

	let command: string[];

	switch (action) {
		case "start":
			// kickstart with -k to force start
			command = ["launchctl", "kickstart", "-k", target];
			break;
		case "stop":
			// kill to stop
			command = ["launchctl", "kill", "SIGTERM", target];
			break;
		case "enable":
			// enable service
			command = ["launchctl", "enable", target];
			break;
		case "disable":
			// disable service
			command = ["launchctl", "disable", target];
			break;
		case "unload":
			// bootout to unload
			command = ["launchctl", "bootout", target];
			break;
		case "reload":
			// kickstart with -k for reload behavior
			command = ["launchctl", "kickstart", "-kp", target];
			break;
		default:
			return {
				success: false,
				message: `Unknown action: ${action}`,
				error: "Invalid action specified",
			};
	}

	// Check if we need sudo
	// Uses shouldUseSudo() which checks:
	// 1. service.requiresRoot - based on domain and plist location
	// 2. isRunningAsRoot() - skips sudo if already root
	if (shouldUseSudo(service.requiresRoot)) {
		command = ["sudo", ...command];
	}

	// Format command for display
	const commandString = command.join(" ");

	// In dry-run mode, return the command without executing
	if (dryRun) {
		return {
			success: true,
			message: `[DRY RUN] Would execute: ${commandString}`,
			command: commandString,
		};
	}

	const [cmd, ...args] = command;
	const result = await execCommandWithRetry(cmd as string, args);

	if (result.exitCode === 0) {
		const successMessage = result.retryInfo?.retried
			? `Successfully ${action}ed service: ${service.label} (after ${result.retryInfo.attempts} attempts)`
			: `Successfully ${action}ed service: ${service.label}`;
		return {
			success: true,
			message: successMessage,
			retryInfo: result.retryInfo,
		};
	}

	// Parse and categorize error
	const errorInfo = parseErrorMessage(result.stderr, result.exitCode);

	const failureMessage = result.retryInfo?.retried
		? `Failed to ${action} service (after ${result.retryInfo.attempts} attempts)`
		: `Failed to ${action} service`;

	return {
		success: false,
		message: failureMessage,
		error: errorInfo.message,
		requiresRoot: errorInfo.requiresRoot && !service.requiresRoot,
		sipProtected: errorInfo.sipProtected,
		retryInfo: result.retryInfo,
	};
}

/**
 * Parse launchctl error messages into user-friendly format
 */
function parseErrorMessage(
	stderr: string,
	exitCode: number,
): { message: string; requiresRoot: boolean; sipProtected: boolean } {
	const lower = stderr.toLowerCase();

	// Permission errors
	if (
		lower.includes("operation not permitted") ||
		lower.includes("permission denied")
	) {
		return {
			message: "Permission denied - may require administrator privileges",
			requiresRoot: true,
			sipProtected: false,
		};
	}

	// SIP protection
	if (lower.includes("system integrity protection") || lower.includes("sip")) {
		return {
			message: "Protected by System Integrity Protection",
			requiresRoot: false,
			sipProtected: true,
		};
	}

	// Service not found
	if (
		lower.includes("could not find service") ||
		lower.includes("no such service")
	) {
		return {
			message: "Service not found or not loaded",
			requiresRoot: false,
			sipProtected: false,
		};
	}

	// Already running/stopped
	if (
		lower.includes("already running") ||
		lower.includes("already bootstrapped")
	) {
		return {
			message: "Service is already running",
			requiresRoot: false,
			sipProtected: false,
		};
	}

	if (lower.includes("not running") || lower.includes("no such process")) {
		return {
			message: "Service is not running",
			requiresRoot: false,
			sipProtected: false,
		};
	}

	// Bootstrap errors
	if (
		lower.includes("could not bootstrap") ||
		lower.includes("bootstrap failed")
	) {
		return {
			message: "Failed to bootstrap service - check plist configuration",
			requiresRoot: false,
			sipProtected: false,
		};
	}

	// Timeout
	if (lower.includes("timed out")) {
		return {
			message: "Operation timed out",
			requiresRoot: false,
			sipProtected: false,
		};
	}

	// Generic exit code handling
	if (exitCode === 1) {
		return {
			message: stderr.trim() || "Operation failed",
			requiresRoot: true, // Assume might need root
			sipProtected: false,
		};
	}

	// Default
	return {
		message: stderr.trim() || `Unknown error (exit code ${exitCode})`,
		requiresRoot: false,
		sipProtected: false,
	};
}
