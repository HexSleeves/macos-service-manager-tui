/**
 * Service List Component
 * Main list view with filtering and selection
 */

import { useTerminalDimensions } from "@opentui/react";
import {
	BASE_OVERHEAD,
	COL_BORDER,
	COL_DOMAIN_SEPARATE,
	COL_PADDING,
	COL_PID,
	COL_PROTECTION,
	COL_STATUS,
	COL_TYPE_DOMAIN_COMBINED,
	COL_TYPE_SEPARATE,
	COLORS,
	FILTER_BAR_HEIGHT,
	MIN_TERMINAL_WIDTH,
	WIDE_TERMINAL_THRESHOLD,
} from "../constants";
import { useAppStore } from "../store/useAppStore";
import { useFilteredServices } from "../store/useDerivedState";
import type { Service, ServiceMatchInfo } from "../types";
import { getProtectionSymbol, getStatusColor, getStatusSymbol } from "./StatusIndicator";

/**
 * Truncate text with ellipsis if it exceeds maxLength
 */
function truncateWithEllipsis(text: string, maxLength: number): string {
	if (maxLength <= 0) return "";
	if (text.length <= maxLength) return text;
	if (maxLength <= 3) return text.substring(0, maxLength);
	return `${text.substring(0, maxLength - 1)}…`;
}

/**
 * Calculate column layout based on terminal width
 */
interface ColumnLayout {
	labelWidth: number;
	separateTypeAndDomain: boolean;
	isTooNarrow: boolean;
}

function calculateColumnLayout(terminalWidth: number): ColumnLayout {
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

interface ServiceRowProps {
	key: string;
	service: Service;
	isSelected: boolean;
	index: number;
	layout: ColumnLayout;
	matchInfo?: ServiceMatchInfo;
	hasSearchQuery: boolean;
}

/**
 * Render text with highlighted matched characters
 */
function HighlightedText({
	text,
	matchedIndices,
	baseColor,
	highlightColor,
	dimmed,
}: {
	text: string;
	matchedIndices: number[];
	baseColor: string;
	highlightColor: string;
	dimmed?: boolean;
}) {
	if (matchedIndices.length === 0) {
		return <text fg={dimmed ? COLORS.textTertiary : baseColor}>{text}</text>;
	}

	const matchSet = new Set(matchedIndices);
	const segments: Array<{ text: string; highlighted: boolean }> = [];
	let currentSegment = "";
	let currentHighlighted = false;

	for (let i = 0; i < text.length; i++) {
		const isHighlighted = matchSet.has(i);
		if (i === 0) {
			currentHighlighted = isHighlighted;
			currentSegment = text[i] ?? "";
		} else if (isHighlighted === currentHighlighted) {
			currentSegment += text[i];
		} else {
			segments.push({ text: currentSegment, highlighted: currentHighlighted });
			currentSegment = text[i] ?? "";
			currentHighlighted = isHighlighted;
		}
	}
	if (currentSegment) {
		segments.push({ text: currentSegment, highlighted: currentHighlighted });
	}

	// Optimize: merge very small segments (< 2 chars) with adjacent segments to reduce element count
	// This reduces React element overhead while maintaining visual appearance
	const optimizedSegments: Array<{ text: string; highlighted: boolean }> = [];
	for (let i = 0; i < segments.length; i++) {
		const seg = segments[i];
		if (!seg) continue;
		if (seg.text.length < 2 && optimizedSegments.length > 0) {
			// Merge small segment with previous segment
			const prev = optimizedSegments[optimizedSegments.length - 1];
			if (prev) {
				prev.text += seg.text;
			}
		} else {
			optimizedSegments.push({ text: seg.text, highlighted: seg.highlighted });
		}
	}

	return (
		<text>
			{optimizedSegments.map((seg, i) =>
				seg.highlighted ? (
					<b key={`hl-${i}-${seg.text.substring(0, 10)}`}>
						<span fg={highlightColor}>{seg.text}</span>
					</b>
				) : (
					<span key={`txt-${i}-${seg.text.substring(0, 10)}`} fg={dimmed ? COLORS.textTertiary : baseColor}>
						{seg.text}
					</span>
				),
			)}
		</text>
	);
}

function ServiceRow({ key, service, isSelected, index, layout, matchInfo, hasSearchQuery }: ServiceRowProps) {
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
		<box key={key} flexDirection="row" backgroundColor={bgColor} paddingLeft={1} paddingRight={1} height={1}>
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
}

export function ServiceList() {
	const { filteredServices, serviceMatchInfo } = useFilteredServices();
	const selectedIndex = useAppStore((state) => state.selectedIndex);
	const focusedPanel = useAppStore((state) => state.focusedPanel);
	const sort = useAppStore((state) => state.sort);
	const searchQuery = useAppStore((state) => state.searchQuery);
	const loading = useAppStore((state) => state.loading);
	const showFilters = useAppStore((state) => state.showFilters);
	const { height: terminalHeight, width: terminalWidth } = useTerminalDimensions();

	// Calculate column layout based on terminal width
	const layout = calculateColumnLayout(terminalWidth);

	// Calculate visible rows based on terminal height
	// Account for filter bar when visible - use compact height on small terminals
	const filterBarHeight = showFilters
		? terminalHeight < 25
			? 6 // Compact mode: reduced padding/gaps
			: FILTER_BAR_HEIGHT
		: 0;
	const overhead = BASE_OVERHEAD + filterBarHeight;
	const visibleRows = Math.max(1, terminalHeight - overhead);

	// Calculate visible window - keep selected item in view
	const totalItems = filteredServices.length;
	let startIndex = 0;

	if (totalItems > visibleRows) {
		// Try to keep selected item centered
		const halfVisible = Math.floor(visibleRows / 2);
		startIndex = Math.max(0, selectedIndex - halfVisible);
		// Adjust if we're near the end
		if (startIndex + visibleRows > totalItems) {
			startIndex = Math.max(0, totalItems - visibleRows);
		}
	}

	const endIndex = Math.min(totalItems, startIndex + visibleRows);
	const visibleServices = filteredServices.slice(startIndex, endIndex);

	// Show warning if terminal is too narrow
	if (layout.isTooNarrow) {
		return (
			<box flexGrow={1} justifyContent="center" alignItems="center" border borderColor={COLORS.textWarning}>
				<text fg={COLORS.textWarning}>⚠ Terminal too narrow</text>
				<text fg={COLORS.textMuted}>Minimum width: {MIN_TERMINAL_WIDTH} columns</text>
				<text fg={COLORS.textMuted}>Current width: {terminalWidth} columns</text>
				<text fg={COLORS.textMuted}>Please resize your terminal</text>
			</box>
		);
	}

	if (filteredServices.length === 0) {
		return (
			<box flexGrow={1} justifyContent="center" alignItems="center" border borderColor={COLORS.bgTertiary}>
				<text fg={COLORS.textMuted}>{loading ? "Loading services..." : "No services found"}</text>
				{searchQuery && <text fg={COLORS.textMuted}>Try adjusting your search or filters</text>}
			</box>
		);
	}

	return (
		<box
			flexDirection="column"
			flexGrow={1}
			border
			borderColor={focusedPanel === "list" ? COLORS.bgFocus : COLORS.bgTertiary}
		>
			{/* List header */}
			<box
				flexDirection="row"
				backgroundColor={COLORS.bgTertiary}
				paddingLeft={1}
				paddingRight={1}
				height={1}
			>
				{focusedPanel === "list" && <text fg={COLORS.bgFocus}>▶ </text>}
				<box width={COL_STATUS}>
					<text fg={COLORS.textTertiary}>S</text>
				</box>
				<box width={COL_PROTECTION}>
					<text fg={COLORS.textTertiary}>P</text>
				</box>
				{/* Type and Domain headers - conditional based on width */}
				{layout.separateTypeAndDomain ? (
					<>
						<box width={COL_TYPE_SEPARATE}>
							<text fg={COLORS.textTertiary}>Type</text>
						</box>
						<box width={COL_DOMAIN_SEPARATE}>
							<text fg={COLORS.textTertiary}>Domain</text>
						</box>
					</>
				) : (
					<box width={COL_TYPE_DOMAIN_COMBINED}>
						<text fg={COLORS.textTertiary}>Type</text>
					</box>
				)}
				<box width={layout.labelWidth}>
					<text fg={COLORS.textTertiary}>
						Label
						{sort.field === "label" && (
							<span fg={COLORS.textAccent}> {sort.direction === "asc" ? "▲" : "▼"}</span>
						)}
					</text>
				</box>
				<box width={COL_PID} justifyContent="flex-end">
					<text fg={COLORS.textTertiary}>PID</text>
				</box>
			</box>

			{/* Service rows - virtual scrolling */}
			{/* Key on container forces re-render when list size changes significantly */}
			<box
				key={`list-container-${filteredServices.length}`}
				flexDirection="column"
				flexGrow={1}
				overflow="hidden"
			>
				{Array.from({ length: visibleRows }).map((_, i) => {
					const service = visibleServices[i];
					if (service) {
						const matchInfo = serviceMatchInfo.get(service.id);
						// Use position-based key for virtual scrolling - service.id causes issues
						// when list changes because same ID appears at different positions
						return (
							<ServiceRow
								// biome-ignore lint/suspicious/noArrayIndexKey: position-based keys required for virtual scrolling
								key={`row-${i}`}
								service={service}
								isSelected={startIndex + i === selectedIndex}
								index={startIndex + i}
								layout={layout}
								matchInfo={matchInfo}
								hasSearchQuery={!!searchQuery}
							/>
						);
					}

					// Empty row placeholder to fill space and clear old content
					return (
						<box
							// biome-ignore lint/suspicious/noArrayIndexKey: position-based keys required for virtual scrolling
							key={`empty-${i}`}
							height={1}
							backgroundColor={i % 2 === 0 ? COLORS.bgSecondary : COLORS.bgPrimary}
						>
							<text> </text>
						</box>
					);
				})}
			</box>

			{/* Scroll indicator */}
			<box
				flexDirection="row"
				justifyContent="space-between"
				paddingLeft={1}
				paddingRight={1}
				backgroundColor={COLORS.bgSecondary}
				height={1}
			>
				<text fg={COLORS.textMuted}>
					{selectedIndex + 1} / {filteredServices.length}
				</text>
				<text fg="#6b7280">
					{startIndex > 0 && "▲ "}
					{endIndex < totalItems && "▼"}
				</text>
			</box>
		</box>
	);
}
