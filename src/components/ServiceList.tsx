/**
 * Service List Component
 * Main list view with filtering and selection
 */

import { useAppState } from "../hooks/useAppState";
import type { Service } from "../types";
import {
	getProtectionSymbol,
	getStatusColor,
	getStatusSymbol,
} from "./StatusIndicator";

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

const VISIBLE_ROWS = 15;

export function ServiceList() {
	const { state, filteredServices } = useAppState();

	// Calculate visible window - keep selected item in view
	const totalItems = filteredServices.length;
	let startIndex = 0;

	if (totalItems > VISIBLE_ROWS) {
		// Try to keep selected item centered
		const halfVisible = Math.floor(VISIBLE_ROWS / 2);
		startIndex = Math.max(0, state.selectedIndex - halfVisible);
		// Adjust if we're near the end
		if (startIndex + VISIBLE_ROWS > totalItems) {
			startIndex = Math.max(0, totalItems - VISIBLE_ROWS);
		}
	}

	const endIndex = Math.min(totalItems, startIndex + VISIBLE_ROWS);
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
			<box flexDirection="column" flexGrow={1}>
				{visibleServices.map((service, i) => (
					<ServiceRow
						key={service.id}
						service={service}
						isSelected={startIndex + i === state.selectedIndex}
						index={startIndex + i}
					/>
				))}
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
