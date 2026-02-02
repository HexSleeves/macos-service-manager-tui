/**
 * Permission and protection utilities
 */

import type { ProtectionStatus, ServiceDomain } from "../../types";

/**
 * Check if a service is Apple/system owned
 */
export function isAppleService(label: string, plistPath?: string): boolean {
	if (label.startsWith("com.apple.")) return true;
	if (plistPath?.includes("/System/Library/")) return true;
	return false;
}

/**
 * Determine protection status
 */
export function getProtectionStatus(label: string, plistPath?: string): ProtectionStatus {
	if (plistPath?.startsWith("/System/")) return "sip-protected";
	if (label.startsWith("com.apple.")) return "system-owned";

	const immutableServices = ["com.apple.SystemConfiguration", "com.apple.launchd", "com.apple.kextd"];
	if (immutableServices.some((s) => label.startsWith(s))) return "immutable";

	return "normal";
}

/**
 * Check if running as root
 */
export function isRunningAsRoot(): boolean {
	return process.getuid?.() === 0;
}

/**
 * Get current user's UID
 */
export function getCurrentUid(): number {
	return process.getuid?.() ?? 501;
}

/**
 * Sudo Decision Matrix:
 *
 * Location                           | Domain  | Sudo Required?
 * -----------------------------------|---------|---------------
 * ~/Library/LaunchAgents             | user    | NO
 * /Library/LaunchAgents              | system  | YES
 * /Library/LaunchDaemons             | system  | YES
 * /System/Library/*                  | system  | SIP protected
 */
export function requiresRoot(domain: ServiceDomain, plistPath?: string): boolean {
	if (plistPath) {
		const homePath = process.env.HOME;
		if (homePath && plistPath.startsWith(`${homePath}/Library/LaunchAgents`)) {
			return false;
		}
		if (plistPath.startsWith("~/Library/LaunchAgents")) {
			return false;
		}
	}

	if (domain === "system") return true;
	if (plistPath?.startsWith("/Library/")) return true;
	if (plistPath?.startsWith("/System/")) return true;

	return false;
}

/**
 * Determine if sudo should be used
 */
export function shouldUseSudo(needsRoot: boolean): boolean {
	if (isRunningAsRoot()) return false;
	return needsRoot;
}

/**
 * Get service status from pid and exit status
 */
export function getServiceStatus(
	pid?: number,
	exitStatus?: number,
	enabled: boolean = true,
): "running" | "stopped" | "disabled" | "error" {
	if (!enabled) return "disabled";
	if (pid !== undefined && pid > 0) return "running";
	if (exitStatus !== undefined && exitStatus !== 0) return "error";
	return "stopped";
}
