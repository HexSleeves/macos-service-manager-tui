/**
 * macOS Service Manager TUI
 * A terminal interface for managing launchd services and system extensions
 */

import { createCliRenderer } from "@opentui/core";
import {
	createRoot,
	useKeyboard,
	useRenderer,
	useTerminalDimensions,
} from "@opentui/react";
import { useState } from "react";
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
import type { AppState, ServiceAction } from "./types";

// Inner app component that uses context
function AppContent() {
	const renderer = useRenderer();
	const _terminalDimensions = useTerminalDimensions();
	const {
		state,
		dispatch,
		filteredServices,
		selectedService,
		executeAction,
		refresh,
	} = useAppState();
	const [showFilters, setShowFilters] = useState(false);

	// Keyboard handling
	useKeyboard((key) => {
		// Block input while executing an action
		if (state.executingAction) {
			return;
		}

		// Handle confirm dialog
		if (state.showConfirm) {
			if (key.name === "escape") {
				dispatch({ type: "CANCEL_ACTION" });
				return;
			}
			if (key.name === "return" || key.name === "enter") {
				dispatch({ type: "CONFIRM_ACTION" });
				if (state.pendingAction && selectedService) {
					executeAction(state.pendingAction, selectedService);
				}
				return;
			}
			return;
		}

		// Help toggle
		if (key.name === "?" || (key.shift && key.name === "/")) {
			dispatch({ type: "TOGGLE_HELP" });
			return;
		}

		// Close help
		if (state.showHelp) {
			if (key.name === "escape" || key.name === "?") {
				dispatch({ type: "TOGGLE_HELP" });
			}
			return;
		}

		// Search mode
		if (state.focusedPanel === "search") {
			if (key.name === "escape") {
				if (state.searchQuery) {
					dispatch({ type: "SET_SEARCH", payload: "" });
				} else {
					dispatch({ type: "SET_FOCUS", payload: "list" });
				}
				return;
			}
			if (key.name === "return" || key.name === "enter") {
				dispatch({ type: "SET_FOCUS", payload: "list" });
				return;
			}
			// Let input handle other keys
			return;
		}

		// Global shortcuts

		// Quit
		if (key.name === "q" || (key.ctrl && key.name === "c")) {
			renderer.destroy();
			return;
		}

		// Focus search
		if (key.name === "/") {
			dispatch({ type: "SET_FOCUS", payload: "search" });
			return;
		}

		// Escape clears search or cancels
		if (key.name === "escape") {
			if (state.searchQuery) {
				dispatch({ type: "SET_SEARCH", payload: "" });
			}
			dispatch({ type: "SET_ACTION_RESULT", payload: null });
			return;
		}

		// Toggle filters
		if (key.name === "f") {
			setShowFilters((f) => !f);
			return;
		}

		// Refresh
		if (key.shift && key.name === "r") {
			refresh();
			return;
		}

		// Navigation
		if (key.name === "up" || key.name === "k") {
			dispatch({ type: "SELECT_PREV" });
			return;
		}
		if (key.name === "down" || key.name === "j") {
			const maxIndex = filteredServices.length - 1;
			if (state.selectedIndex < maxIndex) {
				dispatch({ type: "SELECT_NEXT" });
			}
			return;
		}
		if (key.name === "g" && !key.shift) {
			dispatch({ type: "SELECT_INDEX", payload: 0 });
			return;
		}
		if (key.shift && key.name === "g") {
			dispatch({ type: "SELECT_INDEX", payload: filteredServices.length - 1 });
			return;
		}

		// Page up/down
		if (key.name === "pageup") {
			dispatch({
				type: "SELECT_INDEX",
				payload: Math.max(0, state.selectedIndex - 10),
			});
			return;
		}
		if (key.name === "pagedown") {
			dispatch({
				type: "SELECT_INDEX",
				payload: Math.min(
					filteredServices.length - 1,
					state.selectedIndex + 10,
				),
			});
			return;
		}

		// Sorting
		if (key.name === "s" && !key.shift) {
			dispatch({ type: "CYCLE_SORT_FIELD" });
			return;
		}
		if (key.shift && key.name === "s") {
			dispatch({ type: "TOGGLE_SORT_DIRECTION" });
			return;
		}

		// Filter shortcuts
		if (key.name === "1") {
			dispatch({ type: "SET_FILTER", payload: { type: "all" } });
			return;
		}
		if (key.name === "2") {
			dispatch({ type: "SET_FILTER", payload: { type: "LaunchDaemon" } });
			return;
		}
		if (key.name === "3") {
			dispatch({ type: "SET_FILTER", payload: { type: "LaunchAgent" } });
			return;
		}
		if (key.name === "4") {
			dispatch({ type: "SET_FILTER", payload: { type: "SystemExtension" } });
			return;
		}
		if (key.name === "a" && !key.shift) {
			dispatch({
				type: "SET_FILTER",
				payload: { showAppleServices: !state.filter.showAppleServices },
			});
			return;
		}
		if (key.name === "p") {
			dispatch({
				type: "SET_FILTER",
				payload: { showProtected: !state.filter.showProtected },
			});
			return;
		}

		// Tab to switch panels
		if (key.name === "tab") {
			const nextPanel: AppState["focusedPanel"] =
				state.focusedPanel === "list" ? "details" : "list";
			dispatch({ type: "SET_FOCUS", payload: nextPanel });
			return;
		}

		// Service actions (only when a service is selected and not a system extension)
		if (selectedService && selectedService.type !== "SystemExtension") {
			const requestAction = (action: ServiceAction) => {
				if (selectedService.protection !== "normal") {
					dispatch({
						type: "SET_ACTION_RESULT",
						payload: {
							success: false,
							message: "Cannot perform action on protected service",
							sipProtected: true,
						},
					});
					return;
				}
				dispatch({ type: "REQUEST_ACTION", payload: action });
			};

			// Start (Enter when stopped)
			if (
				(key.name === "return" || key.name === "enter") &&
				selectedService.status !== "running"
			) {
				requestAction("start");
				return;
			}

			// Stop
			if (key.name === "x" && selectedService.status === "running") {
				requestAction("stop");
				return;
			}

			// Reload
			if (
				key.name === "r" &&
				!key.shift &&
				selectedService.status === "running"
			) {
				requestAction("reload");
				return;
			}

			// Enable/Disable toggle
			if (key.name === "d") {
				requestAction(selectedService.enabled ? "disable" : "enable");
				return;
			}

			// Unload
			if (key.name === "u") {
				requestAction("unload");
				return;
			}
		}
	});

	return (
		<box flexDirection="column" width="100%" height="100%">
			{/* Header */}
			<Header />

			{/* Search Bar */}
			<SearchBar />

			{/* Filter Bar (collapsible) */}
			{showFilters && <FilterBar />}

			{/* Main content area */}
			<box flexDirection="row" flexGrow={1}>
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
