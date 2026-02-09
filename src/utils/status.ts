/**
 * Status display utilities
 * Pure functions for mapping service status/protection to colors and symbols
 */

import { COLORS } from "../constants";
import type { ProtectionStatus, ServiceStatus } from "../types";

const STATUS_COLORS: Record<ServiceStatus, string> = {
	running: COLORS.statusRunning,
	stopped: COLORS.statusStopped,
	disabled: COLORS.statusDisabled,
	error: COLORS.statusError,
	unknown: COLORS.statusUnknown,
};

const STATUS_SYMBOLS: Record<ServiceStatus, string> = {
	running: "●",
	stopped: "○",
	disabled: "◌",
	error: "✕",
	unknown: "?",
};

const PROTECTION_SYMBOLS: Record<ProtectionStatus, string> = {
	normal: "",
	"sip-protected": "🔒",
	"system-owned": "⚙",
	immutable: "🛡",
};

export function getStatusColor(status: ServiceStatus): string {
	return STATUS_COLORS[status];
}

export function getStatusSymbol(status: ServiceStatus): string {
	return STATUS_SYMBOLS[status];
}

export function getProtectionSymbol(protection: ProtectionStatus): string {
	return PROTECTION_SYMBOLS[protection];
}
