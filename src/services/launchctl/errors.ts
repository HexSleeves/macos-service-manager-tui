/**
 * Error parsing utilities
 */

export interface ParsedError {
	message: string;
	requiresRoot: boolean;
	sipProtected: boolean;
}

/**
 * Parse launchctl error messages into user-friendly format
 */
export function parseErrorMessage(
	stderr: string,
	exitCode: number,
): ParsedError {
	const lower = stderr.toLowerCase();

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

	if (lower.includes("system integrity protection") || lower.includes("sip")) {
		return {
			message: "Protected by System Integrity Protection",
			requiresRoot: false,
			sipProtected: true,
		};
	}

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

	if (lower.includes("timed out")) {
		return {
			message: "Operation timed out",
			requiresRoot: false,
			sipProtected: false,
		};
	}

	if (exitCode === 1) {
		return {
			message: stderr.trim() || "Operation failed",
			requiresRoot: true,
			sipProtected: false,
		};
	}

	return {
		message: stderr.trim() || `Unknown error (exit code ${exitCode})`,
		requiresRoot: false,
		sipProtected: false,
	};
}
