/**
 * macOS launchctl service management
 *
 * Supports output format variations across macOS versions:
 * - macOS 10.14 Mojave through macOS 15 Sequoia
 */

import type {
	ActionResult,
	PlistMetadata,
	ProtectionStatus,
	Service,
	ServiceAction,
	ServiceDomain,
} from "../../types";
import { describePlistConfig, readPlist } from "../plist";
import { parseErrorMessage } from "./errors";
import { execCommand, execCommandWithRetry, setRetryLogger } from "./exec";
import { normalizePrintKey, parseLaunchctlList, parseLaunchctlPrint } from "./parsers";
import {
	getCurrentUid,
	getProtectionStatus,
	getServiceStatus,
	isAppleService,
	isRunningAsRoot,
	requiresRoot,
	shouldUseSudo,
} from "./permissions";
import { executePrivileged } from "./sudo";
import type { MacOSVersion, ParsedListEntry } from "./types";
import { PLIST_DIRECTORIES } from "./types";
import { isValidServiceLabel, validateLabel } from "./validation";
import { getMacOSVersion } from "./version";

// Re-export everything
export {
	// Types
	type MacOSVersion,
	type ParsedListEntry,
	PLIST_DIRECTORIES,
	// Validation
	isValidServiceLabel,
	validateLabel,
	// Execution
	setRetryLogger,
	// Version
	getMacOSVersion,
	// Parsers
	parseLaunchctlList,
	parseLaunchctlPrint,
	normalizePrintKey,
	// Permissions
	isAppleService,
	getProtectionStatus,
	isRunningAsRoot,
	getCurrentUid,
	requiresRoot,
	shouldUseSudo,
	getServiceStatus,
};

// ============================================================================
// Service Operations
// ============================================================================

/**
 * Find plist path for a service
 * Checks all directories in parallel for better performance
 */
export async function findPlistPath(label: string): Promise<string | undefined> {
	const searchDirs = [
		"/System/Library/LaunchDaemons",
		"/System/Library/LaunchAgents",
		"/Library/LaunchDaemons",
		"/Library/LaunchAgents",
		`${process.env.HOME}/Library/LaunchAgents`,
	];

	// Check all directories in parallel
	const checks = await Promise.allSettled(
		searchDirs.map(async (dir) => {
			const path = `${dir}/${label}.plist`;
			try {
				const file = Bun.file(path);
				if (await file.exists()) {
					return path;
				}
			} catch {
				// Ignore errors for individual checks
			}
			return undefined;
		}),
	);

	// Return the first successful result
	for (const result of checks) {
		if (result.status === "fulfilled" && result.value) {
			return result.value;
		}
	}

	return undefined;
}

/**
 * Read plist metadata for a service
 */
export async function getPlistMetadata(plistPath: string | undefined): Promise<{
	metadata: PlistMetadata | undefined;
	description: string | undefined;
}> {
	if (!plistPath) return { metadata: undefined, description: undefined };

	try {
		const plistData = await readPlist(plistPath);
		if (!plistData) return { metadata: undefined, description: undefined };

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
			hasSockets: plistData.sockets ? Object.keys(plistData.sockets).length > 0 : false,
			hasMachServices: plistData.machServices ? Object.keys(plistData.machServices).length > 0 : false,
		};

		const description = describePlistConfig(plistData);
		return { metadata, description: description || undefined };
	} catch {
		return { metadata: undefined, description: undefined };
	}
}

/**
 * List all services
 * Note: This does NOT eagerly load plist metadata. Use fetchServiceMetadata() for that.
 */
export async function listServices(): Promise<Service[]> {
	const services: Service[] = [];
	const seenLabels = new Set<string>();

	const listResult = await execCommand("launchctl", ["list"]);

	// Throw if launchctl list fails - this is a critical failure
	if (listResult.exitCode !== 0) {
		throw new Error(`Failed to list services: ${listResult.stderr || "Unknown error"}`);
	}

	const parsed = parseLaunchctlList(listResult.stdout);
	for (const { pid, exitStatus, label } of parsed) {
		if (seenLabels.has(label)) continue;
		seenLabels.add(label);

		// Use label-only heuristics for initial classification
		// These can be refined later when plist metadata is loaded
		const protection = getProtectionStatus(label);
		const apple = isAppleService(label);

		// Heuristic: if label contains "daemon", likely a daemon
		// Otherwise default to agent (will be refined when plist is loaded)
		const isDaemon = label.includes("daemon");
		// Default to user domain - will be refined when plist path is known
		const domain: ServiceDomain = "user";
		const type: "LaunchDaemon" | "LaunchAgent" = isDaemon ? "LaunchDaemon" : "LaunchAgent";
		// Conservative: assume root required for daemons, not for agents
		// This will be refined when plist metadata is loaded
		const needsRoot = isDaemon;

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
			// plistPath, description, plistMetadata will be loaded lazily
			enabled: true,
			isAppleService: apple,
			requiresRoot: needsRoot,
		});
	}

	return services;
}

/**
 * Fetch metadata for a service (plist path, metadata, description)
 * This is the lazy-loading entry point for service metadata
 */
export async function fetchServiceMetadata(service: Service): Promise<{
	plistPath?: string;
	plistMetadata?: PlistMetadata;
	description?: string;
	protection?: ProtectionStatus;
	isAppleService?: boolean;
	requiresRoot?: boolean;
	type?: "LaunchDaemon" | "LaunchAgent";
	domain?: ServiceDomain;
}> {
	// Validate label before using it
	if (!isValidServiceLabel(service.label)) {
		return {};
	}

	const plistPath = await findPlistPath(service.label);
	const { metadata: plistMetadata, description } = await getPlistMetadata(plistPath);

	// Refine protection and Apple status with plist path
	const protection = getProtectionStatus(service.label, plistPath);
	const apple = isAppleService(service.label, plistPath);

	// Refine type and domain based on plist path
	let type: "LaunchDaemon" | "LaunchAgent" =
		service.type === "LaunchDaemon" || service.type === "LaunchAgent" ? service.type : "LaunchAgent"; // Default for SystemExtension (shouldn't happen)
	let domain: ServiceDomain = service.domain;

	if (plistPath) {
		const isDaemon = plistPath.includes("LaunchDaemons");
		const isSystemLevel = plistPath.startsWith("/Library/") || plistPath.startsWith("/System/");

		type = isDaemon ? "LaunchDaemon" : "LaunchAgent";
		domain = isSystemLevel ? "system" : "user";
	}

	const needsRoot = requiresRoot(domain, plistPath);

	return {
		plistPath,
		plistMetadata,
		description,
		protection,
		isAppleService: apple,
		requiresRoot: needsRoot,
		type,
		domain,
	};
}

/**
 * Get detailed info for a specific service
 */
export async function getServiceInfo(
	label: string,
	domain: ServiceDomain,
	type: "LaunchDaemon" | "LaunchAgent",
): Promise<Service | null> {
	const target = domain === "system" ? "system" : `user/${process.getuid?.() || 501}`;
	const result = await execCommand("launchctl", ["print", `${target}/${label}`]);

	if (result.exitCode !== 0) return null;

	const info = parseLaunchctlPrint(result.stdout);
	const plistPath = info.path || (await findPlistPath(label));
	const protection = getProtectionStatus(label, plistPath);
	const apple = isAppleService(label, plistPath);
	const needsRoot = requiresRoot(domain, plistPath);
	const { metadata: plistMetadata, description } = await getPlistMetadata(plistPath);

	const pid = info.pid ? parseInt(info.pid, 10) : undefined;
	const exitStatus = info.last_exit_status ? parseInt(info.last_exit_status, 10) : undefined;
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

// ============================================================================
// Service Actions
// ============================================================================

export interface ExecuteServiceActionOptions {
	dryRun?: boolean;
	password?: string;
}

export interface DryRunResult extends ActionResult {
	command?: string;
}

/**
 * Execute a service action
 */
export async function executeServiceAction(
	action: ServiceAction,
	service: Service,
	options: ExecuteServiceActionOptions = {},
): Promise<DryRunResult> {
	const { dryRun = false } = options;

	try {
		validateLabel(service.label);
	} catch (error) {
		return {
			success: false,
			message: `Cannot ${action} service`,
			error: error instanceof Error ? error.message : "Invalid service label",
		};
	}

	if (service.protection === "sip-protected" || service.protection === "immutable") {
		return {
			success: false,
			message: `Cannot ${action} service`,
			error: "Service is protected by System Integrity Protection",
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
			command = ["launchctl", "kickstart", "-k", target];
			break;
		case "stop":
			command = ["launchctl", "kill", "SIGTERM", target];
			break;
		case "enable":
			command = ["launchctl", "enable", target];
			break;
		case "disable":
			command = ["launchctl", "disable", target];
			break;
		case "unload":
			command = ["launchctl", "bootout", target];
			break;
		case "reload":
			command = ["launchctl", "kickstart", "-kp", target];
			break;
		default:
			return {
				success: false,
				message: `Unknown action: ${action}`,
				error: "Invalid action specified",
			};
	}

	const needsSudo = shouldUseSudo(service.requiresRoot);
	const commandString = needsSudo ? `sudo ${command.join(" ")}` : command.join(" ");

	if (dryRun) {
		return {
			success: true,
			message: `[DRY RUN] Would execute: ${commandString}`,
			command: commandString,
		};
	}

	// Execute with privilege escalation if needed
	if (needsSudo) {
		const result = await executePrivileged(command, options.password);

		if (result.needsPassword) {
			return {
				success: false,
				message: "Administrator password required",
				error: "NEEDS_PASSWORD",
			};
		}

		if (result.authCancelled) {
			return {
				success: false,
				message: "Authentication cancelled",
			};
		}

		if (result.authFailed) {
			return {
				success: false,
				message: "Authentication failed",
				error: "AUTH_FAILED",
			};
		}

		if (result.success) {
			return {
				success: true,
				message: `Successfully ${action}ed service: ${service.label}`,
			};
		}

		// Privileged execution failed
		const errorInfo = parseErrorMessage(result.stderr, result.exitCode);
		return {
			success: false,
			message: `Failed to ${action} service`,
			error: errorInfo.message,
			sipProtected: errorInfo.sipProtected,
		};
	}

	// Non-privileged execution
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
