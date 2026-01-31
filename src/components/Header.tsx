/**
 * Header Component
 * App title and status bar
 */

import { useAppState } from "../hooks/useAppState";

export function Header() {
	const { state, filteredServices } = useAppState();

	const totalCount = state.services.length;
	const filteredCount = filteredServices.length;
	const runningCount = filteredServices.filter(
		(s) => s.status === "running",
	).length;

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
				{state.loading && <text fg="#fbbf24">Loading...</text>}
			</box>

			<box flexDirection="row" gap={3}>
				<text fg="#9ca3af">
					Services: <span fg="#e5e7eb">{filteredCount}</span>
					{filteredCount !== totalCount && (
						<span fg="#6b7280">/{totalCount}</span>
					)}
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
