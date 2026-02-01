/**
 * Footer Component
 * Keyboard shortcuts and status messages
 */

import { useAppState } from "../hooks/useAppState";

export function Footer() {
	const { state } = useAppState();

	const shortcuts = [
		{ key: "↑↓/jk", action: "Navigate" },
		{ key: "/", action: "Search" },
		{ key: "f", action: "Filter" },
		{ key: "a", action: "Apple" },
		{ key: "?", action: "Help" },
		{ key: "q", action: "Quit" },
	];

	const showMessage = state.lastActionResult || state.loading || state.executingAction;

	return (
		<box flexDirection="column" height={3} backgroundColor="#1f2937">
			{/* Status message row */}
			{showMessage && (
				<box paddingLeft={1} height={1} flexDirection="row" gap={1}>
					{state.executingAction && (
						<text fg="#60a5fa">⏳ Executing action...</text>
					)}
					{state.loading && !state.executingAction && (
						<text fg="#60a5fa">↻ Loading services...</text>
					)}
					{state.lastActionResult && !state.executingAction && !state.loading && (
						<text fg={state.lastActionResult.success ? "#22c55e" : "#ef4444"}>
							{state.lastActionResult.success ? "✓" : "✗"}{" "}
							{state.lastActionResult.message}
							{state.lastActionResult.error &&
								` - ${state.lastActionResult.error}`}
						</text>
					)}
				</box>
			)}

			{/* Keyboard shortcuts */}
			<box
				flexDirection="row"
				justifyContent="center"
				gap={2}
				paddingTop={showMessage ? 0 : 1}
			>
				{shortcuts.map(({ key, action }) => (
					<box key={key} flexDirection="row" gap={1}>
						<text fg="#60a5fa" bg="#374151">
							{` ${key} `}
						</text>
						<text fg="#9ca3af">{action}</text>
					</box>
				))}
			</box>
		</box>
	);
}
