/**
 * Header Component
 * App title and status bar
 */

import { useAppState } from "../hooks/useAppState";

/**
 * Format a date as relative time (e.g., "2 min ago")
 */
function formatRelativeTime(date: Date): string {
	const now = new Date();
	const diffMs = now.getTime() - date.getTime();
	const diffSec = Math.floor(diffMs / 1000);
	const diffMin = Math.floor(diffSec / 60);
	const diffHour = Math.floor(diffMin / 60);

	if (diffSec < 60) {
		return `${diffSec}s ago`;
	} else if (diffMin < 60) {
		return `${diffMin}m ago`;
	} else {
		return `${diffHour}h ago`;
	}
}

export function Header() {
	const { state, filteredServices } = useAppState();

	const totalCount = state.services.length;
	const filteredCount = filteredServices.length;
	const runningCount = filteredServices.filter((s) => s.status === "running").length;

	// Format auto-refresh interval for display
	const autoRefreshSeconds = Math.round(state.autoRefresh.intervalMs / 1000);

	// Offline state
	const { isOffline, lastSuccessfulRefresh } = state.offline;
	const lastRefreshText = lastSuccessfulRefresh ? formatRelativeTime(lastSuccessfulRefresh) : "never";

	return (
		<box
			flexDirection="row"
			justifyContent="space-between"
			alignItems="center"
			paddingLeft={1}
			paddingRight={1}
			height={3}
			backgroundColor="#1e3a5f"
		>
			<box flexDirection="row" gap={2} alignItems="center">
				<text fg="#60a5fa">
					<strong>⚙ macOS Service Manager</strong>
				</text>
				{/* Connection status indicator */}
				{isOffline ? (
					<box backgroundColor="#7f1d1d" paddingLeft={1} paddingRight={1}>
						<text fg="#fca5a5">
							<strong>⚡ OFFLINE</strong>
						</text>
					</box>
				) : (
					<text fg="#22c55e">● Online</text>
				)}
				{state.dryRun && (
					<box backgroundColor="#b45309" paddingLeft={1} paddingRight={1}>
						<text fg="#ffffff">
							<strong>🔍 DRY RUN</strong>
						</text>
					</box>
				)}
				{state.loading && <text fg="#fbbf24">Loading...</text>}
				{state.autoRefresh.enabled && !state.loading && !isOffline && (
					<text fg="#22c55e">↻ Auto ({autoRefreshSeconds}s)</text>
				)}
			</box>

			<box flexDirection="row" gap={3}>
				{/* Show stale data indicator when offline */}
				{isOffline && <text fg="#fbbf24">⚠ Stale data (last: {lastRefreshText})</text>}
				<text fg="#9ca3af">
					Services: <span fg="#e5e7eb">{filteredCount}</span>
					{filteredCount !== totalCount && <span fg="#6b7280">/{totalCount}</span>}
				</text>
				<text fg="#9ca3af">
					Running: <span fg="#22c55e">{runningCount}</span>
				</text>
				{state.searchQuery && (
					<text fg="#9ca3af">
						Search: <span fg="#fbbf24">"{state.searchQuery}"</span>
					</text>
				)}
			</box>
		</box>
	);
}
