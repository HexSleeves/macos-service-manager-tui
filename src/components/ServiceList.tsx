/**
 * Service List Component
 * Main list view with filtering and selection
 */

import { useTerminalDimensions } from "@opentui/react";
import { useAppState } from "../hooks/useAppState";
import type { Service } from "../types";
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

interface ServiceRowProps {
	service: Service;
	isSelected: boolean;
	index: number;
}

function ServiceRow({ service, isSelected, index }: ServiceRowProps) {
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

	return (
		<box
			flexDirection="row"
			backgroundColor={bgColor}
			paddingLeft={1}
			paddingRight={1}
			height={1}
		>
			{/* Status indicator */}
			<box width={2}>
				<text fg={statusColor}>{statusSymbol}</text>
			</box>

			{/* Protection indicator */}
			<box width={2}>
				<text>{protectionSymbol || " "}</text>
			</box>

			{/* Type and Domain */}
			<box width={8}>
				<text fg="#6b7280">
					{typeIndicator}/{domainIndicator}
				</text>
			</box>

			{/* Label */}
			<box flexGrow={1}>
				<text fg={fgColor}>
					{service.isAppleService ? (
						<span fg="#9ca3af">{service.label}</span>
					) : (
						service.label
					)}
				</text>
			</box>

			{/* PID */}
			<box width={8} justifyContent="flex-end">
				<text fg="#6b7280">{service.pid ? `PID ${service.pid}` : ""}</text>
			</box>
		</box>
	);
}

export function ServiceList() {
	const { state, filteredServices } = useAppState();
	const { height: terminalHeight } = useTerminalDimensions();

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
				<box width={2}>
					<text fg="#9ca3af">S</text>
				</box>
				<box width={2}>
					<text fg="#9ca3af">P</text>
				</box>
				<box width={8}>
					<text fg="#9ca3af">Type</text>
				</box>
				<box flexGrow={1}>
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
				<box width={8} justifyContent="flex-end">
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
						return (
							<ServiceRow
								key={`row-${i}`}
								service={service}
								isSelected={startIndex + i === state.selectedIndex}
								index={startIndex + i}
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
