/**
 * Footer Component
 * Keyboard shortcuts and status messages
 */

import { COLORS } from "../constants";
import { useAppStore } from "../store/useAppStore";

export function Footer() {
	const dryRun = useAppStore((state) => state.dryRun);
	const lastActionResult = useAppStore((state) => state.lastActionResult);
	const loading = useAppStore((state) => state.loading);
	const executingAction = useAppStore((state) => state.executingAction);

	const shortcuts = [
		{ key: "↑↓/jk", action: "Navigate" },
		{ key: "/", action: "Search" },
		{ key: "f", action: "Filter" },
		{
			key: "D",
			action: dryRun ? "Dry ✓" : "Dry",
			highlight: dryRun,
		},
		{ key: "?", action: "Help" },
		{ key: "q", action: "Quit" },
	];

	const showMessage = lastActionResult || loading || executingAction;

	return (
		<box flexDirection="column" height={3} backgroundColor={COLORS.bgSecondary}>
			{/* Status message row */}
			{showMessage && (
				<box paddingLeft={1} height={1} flexDirection="row" gap={1}>
					{executingAction && <text fg={COLORS.textAccent}>⏳ Executing action...</text>}
					{loading && !executingAction && <text fg={COLORS.textAccent}>↻ Loading services...</text>}
					{lastActionResult && !executingAction && !loading && (
						<text fg={lastActionResult.success ? COLORS.textSuccess : COLORS.textError}>
							{lastActionResult.success ? "✓" : "✗"} {lastActionResult.message}
							{lastActionResult.error && ` - ${lastActionResult.error}`}
						</text>
					)}
				</box>
			)}

			{/* Keyboard shortcuts */}
			<box flexDirection="row" justifyContent="center" gap={2} paddingTop={showMessage ? 0 : 1}>
				{shortcuts.map(({ key, action, highlight }) => (
					<box key={key} flexDirection="row" gap={1}>
						<text
							fg={highlight ? COLORS.textWarning : COLORS.textAccent}
							bg={highlight ? COLORS.bgWarningLight : COLORS.bgTertiary}
						>
							{` ${key} `}
						</text>
						<text fg={highlight ? COLORS.textWarning : COLORS.textTertiary}>{action}</text>
					</box>
				))}
			</box>
		</box>
	);
}
