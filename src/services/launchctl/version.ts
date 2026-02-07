/**
 * macOS version detection
 */

import { spawn } from "bun";
import type { MacOSVersion } from "./types";

/** Cached macOS version */
let cachedMacOSVersion: MacOSVersion | null = null;

/**
 * Get the macOS version information (async, cached after first call)
 */
export async function getMacOSVersion(): Promise<MacOSVersion> {
	if (cachedMacOSVersion) {
		return cachedMacOSVersion;
	}

	let versionString = "";

	try {
		const proc = spawn(["sw_vers", "-productVersion"], {
			stdout: "pipe",
			stderr: "pipe",
		});

		const stdout = await new Response(proc.stdout).text();
		const exitCode = await proc.exited;

		if (exitCode === 0) {
			versionString = stdout.trim();
		}
	} catch {
		// Not on macOS or sw_vers unavailable
	}

	// Fallback for non-macOS (e.g., development on Linux)
	if (!versionString) {
		versionString = "0.0.0";
	}

	const parts = versionString.split(".").map(Number);
	const major = parts[0] ?? 0;
	const minor = parts[1] ?? 0;
	const patch = parts[2] ?? 0;

	const versionNames: Record<number, string> = {
		11: "Big Sur",
		12: "Monterey",
		13: "Ventura",
		14: "Sonoma",
		15: "Sequoia",
		16: "Tahoe",
	};

	let name: string;
	if (major === 10) {
		name = minor >= 15 ? "Catalina" : "Mojave or earlier";
	} else {
		name = versionNames[major] ?? "Unknown";
	}

	cachedMacOSVersion = {
		major,
		minor,
		patch,
		full: versionString,
		name,
	};

	return cachedMacOSVersion;
}

/**
 * Clear cached version (for testing)
 */
export function clearVersionCache(): void {
	cachedMacOSVersion = null;
}
