/**
 * macOS System Extensions management
 * Uses systemextensionsctl for listing system extensions
 */

import type { ServiceStatus, SystemExtension } from "../types";
import { execCommand } from "./launchctl/exec";

/**
 * Parse systemextensionsctl list output
 * Format varies but generally:
 * --- com.apple.system_extension.network_extension
 * enabled	active	teamID	bundleID [version]
 *
 * Note: The same extension can appear multiple times under different categories.
 * We deduplicate by bundleId, keeping the most "active" instance and merging categories.
 */
export function parseSystemExtensionsList(output: string): SystemExtension[] {
	const extensionMap = new Map<string, SystemExtension>();
	const lines = output.split("\n");

	let currentCategory = "";

	for (const line of lines) {
		// Category header
		if (line.startsWith("---")) {
			currentCategory = line.replace(/^-+\s*/, "").trim();
			continue;
		}

		// Extension line
		const extMatch = line.match(
			/^\s*(enabled|disabled)?\s*(active|inactive|terminated|waiting)?\s*(\w{10})?\s+([\w.]+)(?:\s+\[([^\]]+)\])?/,
		);
		if (extMatch) {
			const [, enabledState, activeState, teamId, bundleId, version] = extMatch;

			// Skip if bundleId is undefined
			if (!bundleId) continue;

			const status = getExtensionStatus(enabledState, activeState);
			const state = mapExtensionState(activeState);

			// Check if we already have this extension
			const existing = extensionMap.get(bundleId);
			if (existing) {
				// Merge categories
				if (currentCategory && existing.categories) {
					if (!existing.categories.includes(currentCategory)) {
						existing.categories.push(currentCategory);
					}
				} else if (currentCategory) {
					existing.categories = [currentCategory];
				}
				// Keep the more "active" status (running > stopped > disabled > error > unknown)
				if (isMoreActiveStatus(status, existing.status)) {
					existing.status = status;
					existing.state = state;
					existing.enabled = enabledState === "enabled";
				}
				continue;
			}

			extensionMap.set(bundleId, {
				id: `sysext-${bundleId}`,
				label: bundleId,
				displayName: bundleId.split(".").pop() || bundleId,
				type: "SystemExtension",
				domain: "system",
				status,
				protection: "system-owned",
				bundleId,
				teamId,
				version,
				state,
				categories: currentCategory ? [currentCategory] : undefined,
				enabled: enabledState === "enabled",
				isAppleService: bundleId.startsWith("com.apple."),
				requiresRoot: true,
			});
		}
	}

	return Array.from(extensionMap.values());
}

/**
 * Compare status "activity" levels - returns true if newStatus is more active
 */
function isMoreActiveStatus(newStatus: ServiceStatus, oldStatus: ServiceStatus): boolean {
	const priority: Record<ServiceStatus, number> = {
		running: 5,
		stopped: 4,
		disabled: 3,
		error: 2,
		unknown: 1,
	};
	return (priority[newStatus] ?? 0) > (priority[oldStatus] ?? 0);
}

function getExtensionStatus(enabled?: string, active?: string): ServiceStatus {
	if (enabled === "disabled") return "disabled";
	if (active === "active") return "running";
	if (active === "terminated") return "error";
	if (active === "waiting") return "stopped";
	return "unknown";
}

function mapExtensionState(state?: string): SystemExtension["state"] {
	switch (state) {
		case "active":
			return "activated_enabled";
		case "waiting":
			return "activated_waiting";
		case "terminated":
			return "terminated";
		case "inactive":
			return "uninstalled";
		default:
			return undefined;
	}
}

/**
 * List all system extensions
 */
export async function listSystemExtensions(): Promise<SystemExtension[]> {
	const result = await execCommand("systemextensionsctl", ["list"]);

	if (result.exitCode !== 0) {
		return [];
	}

	return parseSystemExtensionsList(result.stdout);
}
