/**
 * Service List Component
 * Main list view with filtering and selection
 */

import { useTerminalDimensions } from "@opentui/react";
import {
	BASE_OVERHEAD,
	COL_DOMAIN_SEPARATE,
	COL_PID,
	COL_PROTECTION,
	COL_STATUS,
	COL_TYPE_DOMAIN_COMBINED,
	COL_TYPE_SEPARATE,
	COLORS,
	FILTER_BAR_HEIGHT,
	MIN_TERMINAL_WIDTH,
} from "../constants";
import { useAppStore } from "../store/useAppStore";
import { useFilteredServices } from "../store/useDerivedState";
import { calculateColumnLayout, ServiceRow } from "./ServiceRow";

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
				<text fg={COLORS.textMuted}>
					{startIndex > 0 && "▲ "}
					{endIndex < totalItems && "▼"}
				</text>
			</box>
		</box>
	);
}
