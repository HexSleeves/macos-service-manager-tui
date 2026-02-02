/**
 * macOS version detection
 */

import { spawnSync } from "bun";
import type { MacOSVersion } from "./types";

/** Cached macOS version */
let cachedMacOSVersion: MacOSVersion | null = null;

/**
 * Get the macOS version information
 */
export function getMacOSVersion(): MacOSVersion {
	if (cachedMacOSVersion) {
		return cachedMacOSVersion;
	}

	let versionString = "10.15.0";

	try {
		const result = spawnSync(["sw_vers", "-productVersion"], {
			stdout: "pipe",
			stderr: "pipe",
		});
		if (result.exitCode === 0) {
			versionString = new TextDecoder().decode(result.stdout).trim();
		}
	} catch {
		// Use fallback
	}

	const parts = versionString.split(".").map(Number);
	const major = parts[0] ?? 10;
	const minor = parts[1] ?? 15;
	const patch = parts[2] ?? 0;

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
