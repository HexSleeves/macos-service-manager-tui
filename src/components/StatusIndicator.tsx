/**
 * Status Indicator Component
 * Visual indicators for service status
 */

import { COLORS } from "../constants";
import type { ProtectionStatus, ServiceStatus } from "../types";

interface StatusIndicatorProps {
	status: ServiceStatus;
	protection?: ProtectionStatus;
	compact?: boolean;
}

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

const PROTECTION_LABELS: Record<ProtectionStatus, string> = {
	normal: "",
	"sip-protected": "SIP",
	"system-owned": "SYS",
	immutable: "IMM",
};

export function StatusIndicator({ status, protection, compact = false }: StatusIndicatorProps) {
	const color = STATUS_COLORS[status];
	const symbol = STATUS_SYMBOLS[status];
	const protectionSymbol = protection ? PROTECTION_SYMBOLS[protection] : "";
	const protectionLabel = protection ? PROTECTION_LABELS[protection] : "";

	if (compact) {
		return (
			<text fg={color}>
				{symbol}
				{protectionSymbol && (
					<span>
						{protectionSymbol}
						{protectionLabel && ` ${protectionLabel}`}
					</span>
				)}
			</text>
		);
	}

	return (
		<box flexDirection="row" gap={1}>
			<text fg={color}>{symbol}</text>
			<text fg={color}>{status}</text>
			{protectionSymbol && (
				<text>
					{protectionSymbol}
					{protectionLabel && ` ${protectionLabel}`}
				</text>
			)}
		</box>
	);
}

export function getStatusColor(status: ServiceStatus): string {
	return STATUS_COLORS[status];
}

export function getStatusSymbol(status: ServiceStatus): string {
	return STATUS_SYMBOLS[status];
}

export function getProtectionSymbol(protection: ProtectionStatus): string {
	return PROTECTION_SYMBOLS[protection];
}
