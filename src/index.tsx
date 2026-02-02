/**
 * macOS Service Manager TUI
 * A terminal interface for managing launchd services and system extensions
 */

import { createCliRenderer } from "@opentui/core";
import { createRoot, useTerminalDimensions } from "@opentui/react";

import {
	ConfirmDialog,
	FilterBar,
	Footer,
	Header,
	HelpPanel,
	SearchBar,
	ServiceDetails,
	ServiceList,
} from "./components";
import { AppContext, useAppProvider, useAppState } from "./hooks/useAppState";
import { useKeyboardShortcuts } from "./hooks/useKeyboardShortcuts";

// Inner app component that uses context
function AppContent() {
	const _terminalDimensions = useTerminalDimensions();
	const { state, dispatch, filteredServices, selectedService, executeAction, refresh } = useAppState();

	// Keyboard handling via hook
	useKeyboardShortcuts({
		state,
		dispatch,
		filteredServices,
		selectedService,
		executeAction,
		refresh,
	});

	return (
		<box flexDirection="column" width="100%" height="100%">
			{/* Header */}
			<Header />

			{/* Search Bar */}
			<SearchBar />

			{/* Filter Bar (collapsible) */}
			{state.showFilters && <FilterBar />}

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
		</box>
	);
}

// Main App wrapper with provider
function App() {
	const contextValue = useAppProvider();

	return (
		<AppContext.Provider value={contextValue}>
			<AppContent />
		</AppContext.Provider>
	);
}

// Initialize and render
const renderer = await createCliRenderer({
	exitOnCtrlC: false, // We handle Ctrl+C ourselves
});

createRoot(renderer).render(<App />);
