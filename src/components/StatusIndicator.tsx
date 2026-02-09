/**
 * Status Indicator Component
 * Visual indicators for service status
 */

import type { ProtectionStatus, ServiceStatus } from "../types";
import { getProtectionSymbol, getStatusColor, getStatusSymbol } from "../utils/status";

const PROTECTION_LABELS: Record<ProtectionStatus, string> = {
	normal: "",
	"sip-protected": "SIP",
	"system-owned": "SYS",
	immutable: "IMM",
};

interface StatusIndicatorProps {
	status: ServiceStatus;
	protection?: ProtectionStatus;
	compact?: boolean;
}

export function StatusIndicator({ status, protection, compact = false }: StatusIndicatorProps) {
	const color = getStatusColor(status);
	const symbol = getStatusSymbol(status);
	const protectionSymbol = protection ? getProtectionSymbol(protection) : "";
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
