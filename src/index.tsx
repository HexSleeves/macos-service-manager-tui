/**
 * macOS Service Manager TUI
 * A terminal interface for managing launchd services and system extensions
 */

import { createCliRenderer } from "@opentui/core";
import { createRoot, useTerminalDimensions } from "@opentui/react";
import { useEffect } from "react";

import {
	ConfirmDialog,
	FilterBar,
	Footer,
	Header,
	HelpPanel,
	PasswordDialog,
	SearchBar,
	ServiceDetails,
	ServiceList,
} from "./components";
import { useKeyboardShortcuts } from "./hooks/useKeyboardShortcuts";
import { useAppEffects } from "./store/useAppEffects";
import { useAppStore } from "./store/useAppStore";

// Main App component
function App() {
	const _terminalDimensions = useTerminalDimensions();
	const showFilters = useAppStore((state) => state.showFilters);

	// Initialize effects (auto-refresh, offline reconnect, metadata prefetch)
	useAppEffects();

	// Initial fetch on mount
	const refresh = useAppStore((state) => state.refresh);
	useEffect(() => {
		refresh();
	}, [refresh]);

	// Keyboard handling via hook
	useKeyboardShortcuts();

	return (
		<box flexDirection="column" width="100%" height="100%">
			{/* Header */}
			<Header />

			{/* Search Bar */}
			<SearchBar />

			{/* Filter Bar (collapsible) */}
			{showFilters && <FilterBar />}

			{/* Main content area */}
			<box flexDirection="row" flexGrow={1} overflow="hidden">
				{/* Service List */}
				<ServiceList />

				{/* Service Details */}
				<ServiceDetails />
			</box>

			{/* Footer */}
			<Footer />

			{/* Overlays */}
			<HelpPanel />
			<ConfirmDialog />
			<PasswordDialog />
		</box>
	);
}

// Initialize and render
const renderer = await createCliRenderer({
	exitOnCtrlC: false, // We handle Ctrl+C ourselves
});

createRoot(renderer).render(<App />);
