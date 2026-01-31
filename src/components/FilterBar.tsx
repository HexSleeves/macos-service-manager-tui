/**
 * Filter Bar Component
 * Filter controls for services
 */

import { useAppState } from "../hooks/useAppState";

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
				{shortcut && <span fg="#60a5fa">[{shortcut}]</span>} {label}
			</text>
		</box>
	);
}

export function FilterBar() {
	const { state } = useAppState();
	const { filter, sort } = state;

	return (
		<box flexDirection="column" backgroundColor="#1f2937" padding={1} gap={1}>
			{/* Type filter */}
			<box flexDirection="row" gap={1} alignItems="center">
				<text fg="#6b7280" width={8}>
					Type:
				</text>
				<box flexDirection="row" gap={1}>
					<FilterButton
						label="All"
						active={filter.type === "all"}
						shortcut="1"
					/>
					<FilterButton
						label="Daemons"
						active={filter.type === "LaunchDaemon"}
						shortcut="2"
					/>
					<FilterButton
						label="Agents"
						active={filter.type === "LaunchAgent"}
						shortcut="3"
					/>
					<FilterButton
						label="SysExt"
						active={filter.type === "SystemExtension"}
						shortcut="4"
					/>
				</box>
			</box>

			{/* Domain filter */}
			<box flexDirection="row" gap={1} alignItems="center">
				<text fg="#6b7280" width={8}>
					Domain:
				</text>
				<box flexDirection="row" gap={1}>
					<FilterButton label="All" active={filter.domain === "all"} />
					<FilterButton label="System" active={filter.domain === "system"} />
					<FilterButton label="User" active={filter.domain === "user"} />
				</box>
			</box>

			{/* Status filter */}
			<box flexDirection="row" gap={1} alignItems="center">
				<text fg="#6b7280" width={8}>
					Status:
				</text>
				<box flexDirection="row" gap={1}>
					<FilterButton label="All" active={filter.status === "all"} />
					<FilterButton label="Running" active={filter.status === "running"} />
					<FilterButton label="Stopped" active={filter.status === "stopped"} />
					<FilterButton label="Error" active={filter.status === "error"} />
				</box>
			</box>

			{/* Toggles */}
			<box flexDirection="row" gap={2} alignItems="center">
				<text fg="#6b7280" width={8}>
					Show:
				</text>
				<box flexDirection="row" gap={2}>
					<text fg={filter.showAppleServices ? "#22c55e" : "#6b7280"}>
						[✓] Apple Services
					</text>
					<text fg={filter.showProtected ? "#22c55e" : "#6b7280"}>
						[✓] Protected
					</text>
				</box>
			</box>

			{/* Sort info */}
			<box flexDirection="row" gap={1} alignItems="center">
				<text fg="#6b7280" width={8}>
					Sort:
				</text>
				<text fg="#9ca3af">
					{sort.field} ({sort.direction})
				</text>
				<text fg="#6b7280"> - Press [s] to cycle, [S] to toggle direction</text>
			</box>
		</box>
	);
}
