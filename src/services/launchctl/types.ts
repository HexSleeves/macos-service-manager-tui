/**
 * Types for launchctl module
 */

import type { RetryInfo } from "../../types";

/** Command result type */
export interface CommandResult {
	stdout: string;
	stderr: string;
	exitCode: number;
}

/** Command result with retry info */
export interface CommandResultWithRetry extends CommandResult {
	retryInfo?: RetryInfo;
}

/** Parsed service entry from launchctl list */
export interface ParsedListEntry {
	pid: number | undefined;
	exitStatus: number | undefined;
	label: string;
}

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

/** Standard plist directories */
export const PLIST_DIRECTORIES = {
	systemDaemons: "/Library/LaunchDaemons",
	systemAgents: "/Library/LaunchAgents",
	userAgents: "~/Library/LaunchAgents",
	appleDaemons: "/System/Library/LaunchDaemons",
	appleAgents: "/System/Library/LaunchAgents",
} as const;

/** Default command timeout in milliseconds */
export const DEFAULT_TIMEOUT_MS = 30000;
