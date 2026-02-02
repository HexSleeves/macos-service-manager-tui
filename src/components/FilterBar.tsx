/**
 * Filter Bar Component
 * Filter controls for services
 */

import { useTerminalDimensions } from "@opentui/react";
import { useAppState } from "../hooks/useAppState";

// Shared layout constants for consistent alignment
const LABEL_WIDTH = 8;
const ROW_GAP = 1;

interface FilterRowProps {
	label: string;
	children: React.ReactNode;
}

function FilterRow({ label, children }: FilterRowProps) {
	return (
		<box flexDirection="row" alignItems="center" gap={ROW_GAP}>
			<text fg="#6b7280" width={LABEL_WIDTH}>
				{label}
			</text>
			<box flexDirection="row" gap={1}>
				{children}
			</box>
		</box>
	);
}

interface FilterButtonProps {
	label: string;
	active: boolean;
	shortcut?: string;
}

function FilterButton({ label, active, shortcut }: FilterButtonProps) {
	const bgColor = active ? "#2563eb" : "#374151";
	const fgColor = active ? "#ffffff" : "#9ca3af";

	return (
		<box backgroundColor={bgColor} paddingLeft={1} paddingRight={1}>
			<text fg={fgColor}>
				{shortcut ? (
					<>
						<span fg="#60a5fa">[{shortcut}]</span> {label}
					</>
				) : (
					label
				)}
			</text>
		</box>
	);
}

interface TogglePillProps {
	label: string;
	active: boolean;
	shortcut?: string;
}

function TogglePill({ label, active, shortcut }: TogglePillProps) {
	const bgColor = active ? "#2563eb" : "#374151";
	const fgColor = active ? "#22c55e" : "#ef4444";

	return (
		<box backgroundColor={bgColor} paddingLeft={1} paddingRight={1}>
			<text fg={fgColor}>
				[{active ? "✓" : "x"}] {label}
				{shortcut && <span fg="#9ca3af"> ({shortcut})</span>}
			</text>
		</box>
	);
}

export function FilterBar() {
	const { state } = useAppState();
	const { filter, sort } = state;
	const { height: terminalHeight } = useTerminalDimensions();

	// Use compact layout on small terminals (< 25 rows)
	const isCompact = terminalHeight < 25;
	const padding = isCompact ? 0 : 1;
	const gap = isCompact ? 0 : 1;

	return (
		<box
			flexDirection="column"
			backgroundColor="#1f2937"
			paddingTop={padding}
			paddingBottom={padding}
			paddingLeft={isCompact ? 1 : 2}
			paddingRight={padding}
			gap={gap}
		>
			{/* Type filter */}
			<FilterRow label="Type:">
				<FilterButton label="All" active={filter.type === "all"} shortcut="1" />
				<FilterButton label="Daemons" active={filter.type === "LaunchDaemon"} shortcut="2" />
				<FilterButton label="Agents" active={filter.type === "LaunchAgent"} shortcut="3" />
				<FilterButton label="SysExt" active={filter.type === "SystemExtension"} shortcut="4" />
			</FilterRow>

			{/* Domain filter */}
			<FilterRow label="Domain:">
				<FilterButton label="All" active={filter.domain === "all"} />
				<FilterButton label="System" active={filter.domain === "system"} />
				<FilterButton label="User" active={filter.domain === "user"} />
				<FilterButton label="GUI" active={filter.domain === "gui"} />
				<text fg="#6b7280"> - Press [ to cycle</text>
			</FilterRow>

			{/* Status filter */}
			<FilterRow label="Status:">
				<FilterButton label="All" active={filter.status === "all"} />
				<FilterButton label="Running" active={filter.status === "running"} />
				<FilterButton label="Stopped" active={filter.status === "stopped"} />
				<FilterButton label="Disabled" active={filter.status === "disabled"} />
				<FilterButton label="Error" active={filter.status === "error"} />
				<text fg="#6b7280"> - Press ] to cycle</text>
			</FilterRow>

			{/* Toggles */}
			<FilterRow label="Show:">
				<TogglePill label="Apple/macOS Services" active={filter.showAppleServices} shortcut="a" />
				<TogglePill label="Protected" active={filter.showProtected} shortcut="p" />
			</FilterRow>

			{/* Sort info */}
			<FilterRow label="Sort:">
				<text fg="#9ca3af">
					{sort.field} ({sort.direction})
				</text>
				<text fg="#6b7280"> - Press [s] to cycle, [S] to toggle direction</text>
			</FilterRow>
		</box>
	);
}
