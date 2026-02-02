/**
 * Service List Component
 * Main list view with filtering and selection
 */

import { useTerminalDimensions } from "@opentui/react";
import { useAppState } from "../hooks/useAppState";
import type { Service, ServiceMatchInfo } from "../types";
import {
	getProtectionSymbol,
	getStatusColor,
	getStatusSymbol,
} from "./StatusIndicator";

// Fixed UI element heights
const HEADER_HEIGHT = 3;
const SEARCH_BAR_HEIGHT = 1;
const FILTER_BAR_HEIGHT = 8; // 6 rows (Type, Domain, Status, Show, Sort, blank) + 2 padding
const FOOTER_HEIGHT = 3;
const LIST_BORDER_HEIGHT = 2; // top + bottom border
const LIST_HEADER_HEIGHT = 1;
const LIST_FOOTER_HEIGHT = 1; // scroll indicator row

const BASE_OVERHEAD =
	HEADER_HEIGHT +
	SEARCH_BAR_HEIGHT +
	FOOTER_HEIGHT +
	LIST_BORDER_HEIGHT +
	LIST_HEADER_HEIGHT +
	LIST_FOOTER_HEIGHT;

// Column width constants
const COL_STATUS = 2;
const COL_PROTECTION = 2;
const COL_TYPE_DOMAIN_COMBINED = 8; // "D/sys" format
const COL_TYPE_SEPARATE = 4; // "D" with padding
const COL_DOMAIN_SEPARATE = 6; // "sys" with padding
const COL_PID = 8;
const COL_PADDING = 2; // left + right padding
const COL_BORDER = 2; // list border

// Minimum width for label to be useful
const MIN_LABEL_WIDTH = 15;
// Minimum terminal width to display the list
const MIN_TERMINAL_WIDTH = COL_STATUS + COL_PROTECTION + COL_TYPE_DOMAIN_COMBINED + COL_PID + COL_PADDING + COL_BORDER + MIN_LABEL_WIDTH;
// Width threshold to show separate type/domain columns
const WIDE_TERMINAL_THRESHOLD = 100;

/**
 * Truncate text with ellipsis if it exceeds maxLength
 */
function truncateWithEllipsis(text: string, maxLength: number): string {
	if (maxLength <= 0) return "";
	if (text.length <= maxLength) return text;
	if (maxLength <= 3) return text.substring(0, maxLength);
	return text.substring(0, maxLength - 1) + "…";
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
		return <text fg={dimmed ? "#9ca3af" : baseColor}>{text}</text>;
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

	return (
		<text>
			{segments.map((seg, i) =>
				seg.highlighted ? (
					<b key={i}>
						<span fg={highlightColor}>{seg.text}</span>
					</b>
				) : (
					<span key={i} fg={dimmed ? "#9ca3af" : baseColor}>
						{seg.text}
					</span>
				),
			)}
		</text>
	);
}

function ServiceRow({ service, isSelected, index, layout, matchInfo, hasSearchQuery }: ServiceRowProps) {
	const statusColor = getStatusColor(service.status);
	const statusSymbol = getStatusSymbol(service.status);
	const protectionSymbol = getProtectionSymbol(service.protection);

	const bgColor = isSelected
		? "#2563eb"
		: index % 2 === 0
			? "#1f2937"
			: "#111827";
	const fgColor = isSelected ? "#ffffff" : "#e5e7eb";

	// Type indicator
	const typeIndicator =
		service.type === "LaunchDaemon"
			? "D"
			: service.type === "LaunchAgent"
				? "A"
				: "E";

	const domainIndicator =
		service.domain === "system"
			? "sys"
			: service.domain === "user"
				? "usr"
				: "gui";

	// Truncate label to fit available width
	const truncatedLabel = truncateWithEllipsis(service.label, layout.labelWidth);

	return (
		<box
			flexDirection="row"
			backgroundColor={bgColor}
			paddingLeft={1}
			paddingRight={1}
			height={1}
		>
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
						<text fg="#6b7280">{typeIndicator}</text>
					</box>
					<box width={COL_DOMAIN_SEPARATE}>
						<text fg="#6b7280">{domainIndicator}</text>
					</box>
				</>
			) : (
				<box width={COL_TYPE_DOMAIN_COMBINED}>
					<text fg="#6b7280">
						{typeIndicator}/{domainIndicator}
					</text>
				</box>
			)}

			{/* Label - width calculated based on terminal size */}
			<box width={layout.labelWidth}>
				{hasSearchQuery && matchInfo && matchInfo.matchField === "label" ? (
					<HighlightedText
						text={truncatedLabel}
						matchedIndices={matchInfo.matchedIndices.filter(
							(i) => i < truncatedLabel.length,
						)}
						baseColor={fgColor}
						highlightColor={isSelected ? "#fbbf24" : "#22c55e"}
						dimmed={service.isAppleService}
					/>
				) : (
					<text fg={fgColor}>
						{service.isAppleService ? (
							<span fg="#9ca3af">{truncatedLabel}</span>
						) : (
							truncatedLabel
						)}
					</text>
				)}
			</box>

			{/* PID */}
			<box width={COL_PID} justifyContent="flex-end">
				<text fg="#6b7280">{service.pid ? `PID ${service.pid}` : ""}</text>
			</box>
		</box>
	);
}

export function ServiceList() {
	const { state, filteredServices, serviceMatchInfo } = useAppState();
	const { height: terminalHeight, width: terminalWidth } = useTerminalDimensions();

	// Calculate column layout based on terminal width
	const layout = calculateColumnLayout(terminalWidth);

	// Calculate visible rows based on terminal height
	// Account for filter bar when visible
	const overhead = BASE_OVERHEAD + (state.showFilters ? FILTER_BAR_HEIGHT : 0);
	const visibleRows = Math.max(1, terminalHeight - overhead);

	// Calculate visible window - keep selected item in view
	const totalItems = filteredServices.length;
	let startIndex = 0;

	if (totalItems > visibleRows) {
		// Try to keep selected item centered
		const halfVisible = Math.floor(visibleRows / 2);
		startIndex = Math.max(0, state.selectedIndex - halfVisible);
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
			<box
				flexGrow={1}
				justifyContent="center"
				alignItems="center"
				border
				borderColor="#f59e0b"
			>
				<text fg="#f59e0b">⚠ Terminal too narrow</text>
				<text fg="#6b7280">Minimum width: {MIN_TERMINAL_WIDTH} columns</text>
				<text fg="#6b7280">Current width: {terminalWidth} columns</text>
				<text fg="#6b7280">Please resize your terminal</text>
			</box>
		);
	}

	if (filteredServices.length === 0) {
		return (
			<box
				flexGrow={1}
				justifyContent="center"
				alignItems="center"
				border
				borderColor="#374151"
			>
				<text fg="#6b7280">
					{state.loading ? "Loading services..." : "No services found"}
				</text>
				{state.searchQuery && (
					<text fg="#6b7280">Try adjusting your search or filters</text>
				)}
			</box>
		);
	}

	return (
		<box
			flexDirection="column"
			flexGrow={1}
			border
			borderColor={state.focusedPanel === "list" ? "#3b82f6" : "#374151"}
		>
			{/* List header */}
			<box
				flexDirection="row"
				backgroundColor="#374151"
				paddingLeft={1}
				paddingRight={1}
				height={1}
			>
				<box width={COL_STATUS}>
					<text fg="#9ca3af">S</text>
				</box>
				<box width={COL_PROTECTION}>
					<text fg="#9ca3af">P</text>
				</box>
				{/* Type and Domain headers - conditional based on width */}
				{layout.separateTypeAndDomain ? (
					<>
						<box width={COL_TYPE_SEPARATE}>
							<text fg="#9ca3af">Type</text>
						</box>
						<box width={COL_DOMAIN_SEPARATE}>
							<text fg="#9ca3af">Domain</text>
						</box>
					</>
				) : (
					<box width={COL_TYPE_DOMAIN_COMBINED}>
						<text fg="#9ca3af">Type</text>
					</box>
				)}
				<box width={layout.labelWidth}>
					<text fg="#9ca3af">
						Label
						{state.sort.field === "label" && (
							<span fg="#60a5fa">
								{" "}
								{state.sort.direction === "asc" ? "▲" : "▼"}
							</span>
						)}
					</text>
				</box>
				<box width={COL_PID} justifyContent="flex-end">
					<text fg="#9ca3af">PID</text>
				</box>
			</box>

			{/* Service rows - virtual scrolling */}
			{/* Render exactly visibleRows to prevent ghost rows */}
			<box 
				flexDirection="column" 
				flexGrow={1}
				overflow="hidden"
			>
				{Array.from({ length: visibleRows }).map((_, i) => {
					const service = visibleServices[i];
					if (service) {
						const matchInfo = serviceMatchInfo.get(service.id);
						return (
							<ServiceRow
								key={`row-${i}`}
								service={service}
								isSelected={startIndex + i === state.selectedIndex}
								index={startIndex + i}
								layout={layout}
								matchInfo={matchInfo}
								hasSearchQuery={!!state.searchQuery}
							/>
						);
					}
					// Empty row placeholder to fill space and clear old content
					return (
						<box
							key={`empty-${i}`}
							height={1}
							backgroundColor={i % 2 === 0 ? "#1f2937" : "#111827"}
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
				backgroundColor="#1f2937"
				height={1}
			>
				<text fg="#6b7280">
					{state.selectedIndex + 1} / {filteredServices.length}
				</text>
				<text fg="#6b7280">
					{startIndex > 0 && "▲ "}
					{endIndex < totalItems && "▼"}
				</text>
			</box>
		</box>
	);
}
