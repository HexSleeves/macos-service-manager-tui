/**
 * Header Component
 * App title and status bar
 */

import { COLORS } from "../constants";
import { useAppStore } from "../store/useAppStore";
import { useFilteredServices } from "../store/useDerivedState";

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
	const { filteredServices } = useFilteredServices();
	const services = useAppStore((state) => state.services);
	const autoRefresh = useAppStore((state) => state.autoRefresh);
	const offline = useAppStore((state) => state.offline);
	const dryRun = useAppStore((state) => state.dryRun);
	const loading = useAppStore((state) => state.loading);
	const searchQuery = useAppStore((state) => state.searchQuery);

	const totalCount = services.length;
	const filteredCount = filteredServices.length;
	const runningCount = filteredServices.filter((s) => s.status === "running").length;

	// Format auto-refresh interval for display
	const autoRefreshSeconds = Math.round(autoRefresh.intervalMs / 1000);

	// Offline state
	const { isOffline, lastSuccessfulRefresh } = offline;
	const lastRefreshText = lastSuccessfulRefresh ? formatRelativeTime(lastSuccessfulRefresh) : "never";

	return (
		<box
			flexDirection="row"
			justifyContent="space-between"
			alignItems="center"
			paddingLeft={1}
			paddingRight={1}
			height={3}
			backgroundColor={COLORS.bgHeader}
		>
			<box flexDirection="row" gap={2} alignItems="center">
				<text fg={COLORS.textAccent}>
					<strong>⚙ macOS Service Manager</strong>
				</text>
				{/* Connection status indicator */}
				{isOffline ? (
					<box backgroundColor={COLORS.bgWarning} paddingLeft={1} paddingRight={1}>
						<text fg={COLORS.textWarningLight}>
							<strong>⚡ OFFLINE</strong>
						</text>
					</box>
				) : (
					<text fg={COLORS.textSuccess}>● Online</text>
				)}
				{dryRun && (
					<box backgroundColor={COLORS.bgAmber} paddingLeft={1} paddingRight={1}>
						<text fg={COLORS.textPrimary}>
							<strong>🔍 DRY RUN</strong>
						</text>
					</box>
				)}
				{loading && <text fg={COLORS.textWarning}>Loading...</text>}
				{autoRefresh.enabled && !loading && !isOffline && (
					<text fg={COLORS.textSuccess}>↻ Auto ({autoRefreshSeconds}s)</text>
				)}
			</box>

			<box flexDirection="row" gap={3}>
				{/* Show stale data indicator when offline */}
				{isOffline && <text fg={COLORS.textWarning}>⚠ Stale data (last: {lastRefreshText})</text>}
				<text fg={COLORS.textTertiary}>
					Services: <span fg={COLORS.textSecondary}>{filteredCount}</span>
					{filteredCount !== totalCount && <span fg={COLORS.textMuted}>/{totalCount}</span>}
				</text>
				<text fg={COLORS.textTertiary}>
					Running: <span fg={COLORS.textSuccess}>{runningCount}</span>
				</text>
				{searchQuery && (
					<text fg={COLORS.textTertiary}>
						Search: <span fg={COLORS.textWarning}>"{searchQuery}"</span>
					</text>
				)}
			</box>
		</box>
	);
}
