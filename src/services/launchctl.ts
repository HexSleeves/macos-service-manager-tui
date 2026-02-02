/**
 * macOS launchctl command parsing and execution
 * Based on: https://rakhesh.com/mac/macos-launchctl-commands/
 */

import { spawn } from "bun";
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
import { isTransientError, withRetry, type RetryOptions } from "../utils/retry";
import { readPlist, describePlistConfig } from "./plist";

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
let retryLogger: ((attempt: number, error: Error, delayMs: number) => void) | null = null;

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
		const result = await withRetry(
			async () => {
				const cmdResult = await execCommandOnce(command, args, timeoutMs);
				
				// Check if the error in stderr is transient and should trigger a retry
				if (cmdResult.exitCode !== 0 && isTransientError(cmdResult.stderr)) {
					throw new Error(cmdResult.stderr || `Command failed with exit code ${cmdResult.exitCode}`);
				}
				
				return cmdResult;
			},
			options,
		);

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

/**
 * Parse the output of `launchctl list` command
 * Format: PID\tStatus\tLabel
 */
export function parseLaunchctlList(output: string): Array<{
	pid: number | undefined;
	exitStatus: number | undefined;
	label: string;
}> {
	const lines = output.trim().split("\n");
	const services: Array<{
		pid: number | undefined;
		exitStatus: number | undefined;
		label: string;
	}> = [];

	// Skip header line
	for (let i = 1; i < lines.length; i++) {
		const line = lines[i];
		if (!line) continue;
		const trimmedLine = line.trim();
		if (!trimmedLine) continue;

		const parts = trimmedLine.split("\t");
		if (parts.length >= 3) {
			const pidPart = parts[0];
			const statusPart = parts[1];
			const labelPart = parts[2];
			if (!pidPart || !statusPart || !labelPart) continue;

			const pid = pidPart === "-" ? undefined : Number.parseInt(pidPart, 10);
			const exitStatus =
				statusPart === "-" ? undefined : Number.parseInt(statusPart, 10);

			services.push({ pid, exitStatus, label: labelPart });
		}
	}

	return services;
}

/**
 * Parse `launchctl print` output for detailed service info
 */
export function parseLaunchctlPrint(output: string): Record<string, string> {
	const info: Record<string, string> = {};
	const lines = output.split("\n");

	for (const line of lines) {
		const match = line.match(/^\s*([\w\s]+)\s*=\s*(.+)$/);
		if (match?.[1] && match[2]) {
			const key = match[1].trim().toLowerCase().replace(/\s+/g, "_");
			info[key] = match[2].trim();
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
 * Determine if root is required for an action
 */
export function requiresRoot(
	domain: ServiceDomain,
	plistPath?: string,
): boolean {
	if (domain === "system") return true;
	if (plistPath?.startsWith("/Library/")) return true;
	if (plistPath?.startsWith("/System/")) return true;
	return false;
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
				plistPath?.startsWith("/Library/") ||
				plistPath?.startsWith("/System/");

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
export async function getPlistMetadata(
	plistPath: string | undefined,
): Promise<{ metadata: PlistMetadata | undefined; description: string | undefined }> {
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
	if (service.requiresRoot) {
		// Insert sudo at the beginning
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
	if (lower.includes("operation not permitted") || lower.includes("permission denied")) {
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
	if (lower.includes("could not find service") || lower.includes("no such service")) {
		return {
			message: "Service not found or not loaded",
			requiresRoot: false,
			sipProtected: false,
		};
	}
	
	// Already running/stopped
	if (lower.includes("already running") || lower.includes("already bootstrapped")) {
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
	if (lower.includes("could not bootstrap") || lower.includes("bootstrap failed")) {
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
