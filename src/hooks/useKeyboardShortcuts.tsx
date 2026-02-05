/**
 * Keyboard Shortcuts Hook
 * Handles all keyboard input for the application
 */

import { useKeyboard, useRenderer } from "@opentui/react";
import { useAppStore } from "../store/useAppStore";
import { useFilteredServices, useSelectedService } from "../store/useDerivedState";
import type { ServiceAction } from "../types";
import { openInEditor, plistExists, requiresRootToEdit } from "../utils/editor";

export function useKeyboardShortcuts() {
	const renderer = useRenderer();
	const store = useAppStore();
	const { filteredServices } = useFilteredServices();
	const selectedService = useSelectedService(filteredServices);

	useKeyboard((key) => {
		// Block input while executing an action
		if (store.executingAction) {
			return;
		}

		// Handle password dialog
		if (store.showPasswordDialog) {
			if (key.name === "escape") {
				store.hidePasswordDialog();
				return;
			}
			if (key.name === "return" || key.name === "enter") {
				if (store.passwordInput) {
					store.submitPassword();
				}
				return;
			}
			if (key.name === "backspace") {
				store.setPasswordInput(store.passwordInput.slice(0, -1));
				return;
			}
			// Regular character input
			if (key.name && key.name.length === 1 && !key.ctrl && !key.meta) {
				store.setPasswordInput(store.passwordInput + key.name);
				return;
			}
			return; // Block other keys while dialog is open
		}

		// Handle confirm dialog
		if (store.showConfirm) {
			if (key.name === "escape") {
				store.cancelAction();
				return;
			}
			if (key.name === "return" || key.name === "enter") {
				store.confirmAction();
				if (store.pendingAction && selectedService) {
					store.executeAction(store.pendingAction, selectedService, {
						dryRun: store.dryRun,
					});
				}
				return;
			}
			return;
		}

		// Help toggle
		if (key.name === "?" || (key.shift && key.name === "/")) {
			store.toggleHelp();
			return;
		}

		// Close help
		if (store.showHelp) {
			if (key.name === "escape" || key.name === "?") {
				store.toggleHelp();
			}
			return;
		}

		// Search mode
		if (store.focusedPanel === "search") {
			if (key.name === "escape") {
				if (store.searchQuery) {
					store.setSearch("");
				} else {
					store.setFocus("list");
				}
				return;
			}
			if (key.name === "return" || key.name === "enter") {
				store.setFocus("list");
				return;
			}
			// Let input handle other keys
			return;
		}

		// Global shortcuts

		// Quit
		if (key.name === "q" || (key.ctrl && key.name === "c")) {
			renderer.destroy();
			process.exit(0);
		}

		// Focus search
		if (key.name === "/") {
			store.setFocus("search");
			return;
		}

		// Escape clears search or cancels
		if (key.name === "escape") {
			if (store.searchQuery) {
				store.setSearch("");
			}
			store.setActionResult(null);
			return;
		}

		// Toggle filters
		if (key.name === "f") {
			store.toggleFilters();
			return;
		}

		// Refresh
		if (key.shift && key.name === "r") {
			store.refresh();
			return;
		}

		// Navigation
		if (key.name === "up" || key.name === "k") {
			store.selectPrev();
			return;
		}
		if (key.name === "down" || key.name === "j") {
			const maxIndex = filteredServices.length - 1;
			if (store.selectedIndex < maxIndex) {
				store.selectNext();
			}
			return;
		}
		if (key.name === "g" && !key.shift) {
			store.selectIndex(0);
			return;
		}
		if (key.shift && key.name === "g") {
			store.selectIndex(filteredServices.length - 1);
			return;
		}

		// Page up/down
		if (key.name === "pageup") {
			store.selectIndex(Math.max(0, store.selectedIndex - 10));
			return;
		}
		if (key.name === "pagedown") {
			store.selectIndex(Math.min(filteredServices.length - 1, store.selectedIndex + 10));
			return;
		}

		// Sorting
		if (key.name === "s" && !key.shift) {
			store.cycleSortField();
			return;
		}
		if (key.shift && key.name === "s") {
			store.toggleSortDirection();
			return;
		}

		// Filter shortcuts
		if (key.name === "1") {
			store.setFilter({ type: "all" });
			return;
		}
		if (key.name === "2") {
			store.setFilter({ type: "LaunchDaemon" });
			return;
		}
		if (key.name === "3") {
			store.setFilter({ type: "LaunchAgent" });
			return;
		}
		if (key.name === "4") {
			store.setFilter({ type: "SystemExtension" });
			return;
		}
		if (key.name === "a" && !key.shift) {
			store.setFilter({ showAppleServices: !store.filter.showAppleServices });
			return;
		}
		// Toggle auto-refresh (Shift+A)
		if (key.shift && key.name === "a") {
			store.toggleAutoRefresh();
			return;
		}

		// Toggle dry-run mode (Shift+D)
		if (key.shift && key.name === "d") {
			store.toggleDryRun();
			return;
		}
		if (key.name === "p") {
			store.setFilter({ showProtected: !store.filter.showProtected });
			return;
		}

		// Domain filter cycling ([ key)
		if (key.name === "[") {
			const domains: Array<"all" | "system" | "user" | "gui"> = ["all", "system", "user", "gui"];
			const currentIndex = domains.indexOf(store.filter.domain);
			const nextDomain = domains[(currentIndex + 1) % domains.length];
			if (nextDomain) {
				store.setFilter({ domain: nextDomain });
			}
			return;
		}

		// Status filter cycling (] key)
		if (key.name === "]") {
			const statuses: Array<"all" | "running" | "stopped" | "disabled" | "error" | "unknown"> = [
				"all",
				"running",
				"stopped",
				"disabled",
				"error",
			];
			const currentIndex = statuses.indexOf(store.filter.status);
			const nextStatus = statuses[(currentIndex + 1) % statuses.length];
			if (nextStatus) {
				store.setFilter({ status: nextStatus });
			}
			return;
		}

		// Tab to switch panels
		if (key.name === "tab") {
			const nextPanel = store.focusedPanel === "list" ? "details" : "list";
			store.setFocus(nextPanel);
			return;
		}

		// Edit plist file (only when a service is selected with a plist path)
		if (key.name === "e" && selectedService && selectedService.type !== "SystemExtension") {
			const plistPath = selectedService.plistPath;

			if (!plistPath) {
				store.setActionResult({
					success: false,
					message: "No plist file for this service",
				});
				return;
			}

			if (!plistExists(plistPath)) {
				store.setActionResult({
					success: false,
					message: `Plist file not found: ${plistPath}`,
				});
				return;
			}

			// Suspend TUI, open editor, then resume
			const useRoot = requiresRootToEdit(plistPath);
			renderer.suspend();

			openInEditor(plistPath, { useRoot }).then((result) => {
				// Resume TUI after editor closes
				renderer.resume();

				if (result.success) {
					store.setActionResult({
						success: true,
						message: `Finished editing: ${plistPath}`,
					});
					// Refresh to pick up any changes
					store.refresh();
				} else if (result.error) {
					store.setActionResult({
						success: false,
						message: result.error,
					});
				}
			});

			return;
		}

		// Service actions (only when a service is selected and not a system extension)
		if (selectedService && selectedService.type !== "SystemExtension") {
			const requestAction = (action: ServiceAction) => {
				// Block actions when offline
				if (store.offline.isOffline) {
					store.setActionResult({
						success: false,
						message: "Cannot perform action - offline mode",
						error: "Connection to launchd unavailable. Waiting for reconnection...",
					});
					return;
				}
				if (selectedService.protection !== "normal") {
					store.setActionResult({
						success: false,
						message: "Cannot perform action on protected service",
						sipProtected: true,
					});
					return;
				}
				store.requestAction(action);
			};

			// Start (Enter when stopped)
			if ((key.name === "return" || key.name === "enter") && selectedService.status !== "running") {
				requestAction("start");
				return;
			}

			// Stop
			if (key.name === "x" && selectedService.status === "running") {
				requestAction("stop");
				return;
			}

			// Reload
			if (key.name === "r" && !key.shift && selectedService.status === "running") {
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
}
