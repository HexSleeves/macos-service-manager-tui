/**
 * Service Row Component
 * Individual row rendering for the service list
 */

import { memo } from "react";
import {
	COL_BORDER,
	COL_DOMAIN_SEPARATE,
	COL_PADDING,
	COL_PID,
	COL_PROTECTION,
	COL_STATUS,
	COL_TYPE_DOMAIN_COMBINED,
	COL_TYPE_SEPARATE,
	COLORS,
	MIN_TERMINAL_WIDTH,
	WIDE_TERMINAL_THRESHOLD,
} from "../constants";
import type { Service, ServiceMatchInfo } from "../types";
import { getProtectionSymbol, getStatusColor, getStatusSymbol } from "../utils/status";
import { HighlightedText } from "./HighlightedText";

/**
 * Truncate text with ellipsis if it exceeds maxLength
 */
export function truncateWithEllipsis(text: string, maxLength: number): string {
	if (maxLength <= 0) return "";
	if (text.length <= maxLength) return text;
	if (maxLength <= 3) return text.substring(0, maxLength);
	return `${text.substring(0, maxLength - 1)}…`;
}

/**
 * Calculate column layout based on terminal width
 */
export interface ColumnLayout {
	labelWidth: number;
	separateTypeAndDomain: boolean;
	isTooNarrow: boolean;
}

export function calculateColumnLayout(terminalWidth: number): ColumnLayout {
	const fixedWidth = COL_STATUS + COL_PROTECTION + COL_PID + COL_PADDING + COL_BORDER;

	// Check if terminal is too narrow
	if (terminalWidth < MIN_TERMINAL_WIDTH) {
		return {
			labelWidth: Math.max(1, terminalWidth - fixedWidth - COL_TYPE_DOMAIN_COMBINED),
			separateTypeAndDomain: false,
			isTooNarrow: true,
		};
	}

	// Wide terminal: show separate type and domain columns
	if (terminalWidth >= WIDE_TERMINAL_THRESHOLD) {
		const typeAndDomainWidth = COL_TYPE_SEPARATE + COL_DOMAIN_SEPARATE;
		return {
			labelWidth: terminalWidth - fixedWidth - typeAndDomainWidth,
			separateTypeAndDomain: true,
			isTooNarrow: false,
		};
	}

	// Normal width: combined type/domain
	return {
		labelWidth: terminalWidth - fixedWidth - COL_TYPE_DOMAIN_COMBINED,
		separateTypeAndDomain: false,
		isTooNarrow: false,
	};
}

export interface ServiceRowProps {
	service: Service;
	isSelected: boolean;
	index: number;
	layout: ColumnLayout;
	matchInfo?: ServiceMatchInfo;
	hasSearchQuery: boolean;
}

export const ServiceRow = memo(function ServiceRow({
	service,
	isSelected,
	index,
	layout,
	matchInfo,
	hasSearchQuery,
}: ServiceRowProps) {
	const statusColor = getStatusColor(service.status);
	const statusSymbol = getStatusSymbol(service.status);
	const protectionSymbol = getProtectionSymbol(service.protection);

	const bgColor = isSelected ? COLORS.bgSelected : index % 2 === 0 ? COLORS.bgSecondary : COLORS.bgPrimary;
	const fgColor = isSelected ? COLORS.textPrimary : COLORS.textSecondary;

	// Type indicator
	const typeIndicator = service.type === "LaunchDaemon" ? "D" : service.type === "LaunchAgent" ? "A" : "E";

	const domainIndicator = service.domain === "system" ? "sys" : service.domain === "user" ? "usr" : "gui";

	// Truncate label to fit available width
	const truncatedLabel = truncateWithEllipsis(service.label, layout.labelWidth);

	return (
		<box flexDirection="row" backgroundColor={bgColor} paddingLeft={1} paddingRight={1} height={1}>
			{/* Status indicator */}
			<box width={COL_STATUS}>
				<text fg={statusColor}>{statusSymbol}</text>
			</box>

			{/* Protection indicator */}
			<box width={COL_PROTECTION}>
				<text>{protectionSymbol || " "}</text>
			</box>

			{/* Type and Domain - conditional rendering based on width */}
			{layout.separateTypeAndDomain ? (
				<>
					<box width={COL_TYPE_SEPARATE}>
						<text fg={COLORS.textMuted}>{typeIndicator}</text>
					</box>
					<box width={COL_DOMAIN_SEPARATE}>
						<text fg={COLORS.textMuted}>{domainIndicator}</text>
					</box>
				</>
			) : (
				<box width={COL_TYPE_DOMAIN_COMBINED}>
					<text fg={COLORS.textMuted}>
						{typeIndicator}/{domainIndicator}
					</text>
				</box>
			)}

			{/* Label - width calculated based on terminal size */}
			<box width={layout.labelWidth}>
				{hasSearchQuery && matchInfo && matchInfo.matchField === "label" ? (
					<HighlightedText
						text={truncatedLabel}
						matchedIndices={matchInfo.matchedIndices.filter((i) => i < truncatedLabel.length)}
						baseColor={fgColor}
						highlightColor={isSelected ? COLORS.textPrimary : COLORS.textSuccess}
						dimmed={service.isAppleService}
					/>
				) : (
					<text fg={fgColor}>
						{service.isAppleService ? <span fg={COLORS.textTertiary}>{truncatedLabel}</span> : truncatedLabel}
					</text>
				)}
			</box>

			{/* PID */}
			<box width={COL_PID} justifyContent="flex-end">
				<text fg={COLORS.textMuted}>{service.pid ? `PID ${service.pid}` : ""}</text>
			</box>
		</box>
	);
});
