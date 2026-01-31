/**
 * macOS System Extensions management
 * Uses systemextensionsctl for listing system extensions
 */

import { spawn } from "bun";
import type { ServiceStatus, SystemExtension } from "../types";

/**
 * Execute a shell command and return stdout/stderr
 */
async function execCommand(
	command: string,
	args: string[],
): Promise<{ stdout: string; stderr: string; exitCode: number }> {
	try {
		const proc = spawn([command, ...args], {
			stdout: "pipe",
			stderr: "pipe",
		});

		const stdout = await new Response(proc.stdout).text();
		const stderr = await new Response(proc.stderr).text();
		const exitCode = await proc.exited;

		return { stdout, stderr, exitCode };
	} catch (error) {
		return {
			stdout: "",
			stderr: error instanceof Error ? error.message : "Unknown error",
			exitCode: 1,
		};
	}
}

/**
 * Parse systemextensionsctl list output
 * Format varies but generally:
 * --- com.apple.system_extension.network_extension
 * enabled	active	teamID	bundleID [version]
 */
export function parseSystemExtensionsList(output: string): SystemExtension[] {
	const extensions: SystemExtension[] = [];
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

			extensions.push({
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

	return extensions;
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
		// systemextensionsctl may require elevated privileges
		// or simply not be available (not macOS)
		console.error("Failed to list system extensions:", result.stderr);
		return [];
	}

	return parseSystemExtensionsList(result.stdout);
}

/**
 * Uninstall a system extension
 * Note: This is typically done through the app that installed it
 */
export async function uninstallSystemExtension(
	_bundleId: string,
): Promise<{ success: boolean; message: string; error?: string }> {
	// systemextensionsctl uninstall requires the team ID and bundle ID
	// Format: systemextensionsctl uninstall TEAM_ID BUNDLE_ID

	// Note: In practice, system extensions should be uninstalled through
	// their parent application or System Preferences
	return {
		success: false,
		message:
			"System extensions should be uninstalled through System Preferences or the parent application",
		error: "Manual uninstallation not recommended",
	};
}

/**
 * Reset system extensions (for debugging/development)
 * WARNING: This is a developer tool and affects all extensions
 */
export async function resetSystemExtensions(): Promise<{
	success: boolean;
	message: string;
	error?: string;
}> {
	const result = await execCommand("systemextensionsctl", ["reset"]);

	if (result.exitCode === 0) {
		return {
			success: true,
			message: "System extensions reset requested. A reboot may be required.",
		};
	}

	return {
		success: false,
		message: "Failed to reset system extensions",
		error: result.stderr || "Permission denied or command not available",
	};
}
