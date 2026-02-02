/**
 * Help Panel Component
 * Shows keyboard shortcuts and usage information
 */

import { useTerminalDimensions } from "@opentui/react";
import { useAppState } from "../hooks/useAppState";

interface ShortcutGroup {
	title: string;
	shortcuts: Array<{ key: string; description: string }>;
}

const SHORTCUT_GROUPS: ShortcutGroup[] = [
	{
		title: "Navigation",
		shortcuts: [
			{ key: "↑/k ↓/j", description: "Move selection" },
			{ key: "g/G", description: "First/last service" },
			{ key: "Tab", description: "Switch panel" },
			{ key: "PgUp/Dn", description: "Page up/down" },
		],
	},
	{
		title: "Search & Filter",
		shortcuts: [
			{ key: "/", description: "Focus search" },
			{ key: "ESC", description: "Clear/cancel" },
			{ key: "f", description: "Toggle filters" },
			{ key: "1-4", description: "Filter by type" },
			{ key: "[", description: "Cycle domain" },
			{ key: "]", description: "Cycle status" },
			{ key: "a", description: "Toggle Apple svcs" },
			{ key: "p", description: "Toggle protected" },
		],
	},
	{
		title: "Sorting",
		shortcuts: [{ key: "s/S", description: "Cycle field/dir" }],
	},
	{
		title: "Actions",
		shortcuts: [
			{ key: "Enter", description: "Start (if stopped)" },
			{ key: "x", description: "Stop service" },
			{ key: "r", description: "Reload service" },
			{ key: "d", description: "Enable/disable" },
			{ key: "u", description: "Unload service" },
		],
	},
	{
		title: "General",
		shortcuts: [
			{ key: "R", description: "Refresh list" },
			{ key: "Shift+A", description: "Toggle auto-refresh" },
			{ key: "Shift+D", description: "Toggle dry-run mode" },
			{ key: "?", description: "Toggle help" },
			{ key: "q", description: "Quit" },
		],
	},
];

export function HelpPanel() {
	const { state } = useAppState();
	const { height: terminalHeight } = useTerminalDimensions();

	if (!state.showHelp) {
		return null;
	}

	// Calculate appropriate height based on terminal
	const maxHeight = Math.min(terminalHeight - 4, 32);
	const useCompactMode = terminalHeight < 30;

	return (
		<box
			position="absolute"
			left={0}
			top={0}
			right={0}
			bottom={0}
			justifyContent="center"
			alignItems="center"
		>
			<box
				width={useCompactMode ? 50 : 65}
				height={maxHeight}
				border
				borderColor="#3b82f6"
				backgroundColor="#111827"
				flexDirection="column"
				overflow="hidden"
			>
				{/* Header */}
				<box
					backgroundColor="#1e3a5f"
					paddingLeft={2}
					paddingRight={2}
					height={1}
					justifyContent="space-between"
					flexDirection="row"
				>
					<text fg="#60a5fa">
						<strong>Keyboard Shortcuts</strong>
					</text>
					<text fg="#6b7280">[?] close</text>
				</box>

				{/* Shortcuts content - two column layout for compact mode */}
				{useCompactMode ? (
					<box flexDirection="column" padding={1} flexGrow={1}>
						{SHORTCUT_GROUPS.map((group) => (
							<box key={group.title} flexDirection="row" flexWrap="wrap">
								<box width="100%">
									<text fg="#fbbf24">
										<strong>{group.title}:</strong>
									</text>
								</box>
								{group.shortcuts.map(({ key, description }) => (
									<box key={`${group.title}-${key}`} width="50%">
										<text>
											<span fg="#60a5fa">{key}</span>
											<span fg="#6b7280"> {description}</span>
										</text>
									</box>
								))}
							</box>
						))}
					</box>
				) : (
					<box flexDirection="column" padding={1} flexGrow={1}>
						{SHORTCUT_GROUPS.map((group) => (
							<box key={group.title} flexDirection="column" marginBottom={1}>
								<text fg="#fbbf24">
									<strong>{group.title}</strong>
								</text>
								{group.shortcuts.map(({ key, description }) => (
									<box key={`${group.title}-${key}`} flexDirection="row" paddingLeft={2}>
										<box width={12}>
											<text fg="#60a5fa">{key}</text>
										</box>
										<text fg="#9ca3af">{description}</text>
									</box>
								))}
							</box>
						))}

						{/* Status legend - inline */}
						<box flexDirection="row" paddingLeft={2} gap={2} marginTop={1}>
							<text>
								<span fg="#22c55e">●</span> Run
							</text>
							<text>
								<span fg="#6b7280">○</span> Stop
							</text>
							<text>
								<span fg="#eab308">◌</span> Off
							</text>
							<text>
								<span fg="#ef4444">✕</span> Err
							</text>
							<text>🔒 SIP</text>
							<text>⚙ Sys</text>
							<text>🛡 Imm</text>
						</box>
					</box>
				)}
			</box>
		</box>
	);
}
