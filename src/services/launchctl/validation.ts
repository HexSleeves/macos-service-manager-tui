/**
 * Service label validation utilities
 */

/**
 * Validate a service label to prevent command injection
 * Labels should only contain alphanumeric, dots, hyphens, and underscores
 */
export function isValidServiceLabel(label: string): boolean {
	if (!label || label.length === 0 || label.length > 256) return false;
	const safePattern = /^[a-zA-Z0-9._-]+$/;
	return safePattern.test(label);
}

/**
 * Sanitize a service label (validate and return or throw)
 */
export function validateLabel(label: string): string {
	if (!isValidServiceLabel(label)) {
		throw new Error(`Invalid service label: ${label}`);
	}
	return label;
}
