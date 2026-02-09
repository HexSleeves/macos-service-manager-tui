/**
 * Keyboard Shortcuts Hook
 * Handles all keyboard input for the application
 */

import { useKeyboard, useRenderer } from "@opentui/react";
import { useAppStore } from "../store/useAppStore";
import { useFilteredServices, useSelectedService } from "../store/useDerivedState";
import type { Service, ServiceAction } from "../types";
import { openInEditor, plistExists, requiresRootToEdit } from "../utils/editor";

interface KeyEvent {
	name?: string;
	shift?: boolean;
	ctrl?: boolean;
	meta?: boolean;
}

type StoreState = ReturnType<typeof useAppStore.getState>;

// ============================================================================
// Per-mode handlers
// ============================================================================

/** Handle input while password dialog is open */
function handlePasswordMode(key: KeyEvent, store: StoreState): boolean {
	if (!store.showPasswordDialog) return false;

	if (key.name === "escape") {
		store.hidePasswordDialog();
	} else if (key.name === "return" || key.name === "enter") {
		if (store.passwordInput) store.submitPassword();
	} else if (key.name === "backspace") {
		store.setPasswordInput(store.passwordInput.slice(0, -1));
	} else if (key.name && key.name.length === 1 && !key.ctrl && !key.meta) {
		store.setPasswordInput(store.passwordInput + key.name);
	}
	return true; // Always consume input in password mode
}

/** Handle input while confirm dialog is open */
function handleConfirmMode(key: KeyEvent, store: StoreState, selectedService: Service | null): boolean {
	if (!store.showConfirm) return false;

	if (key.name === "escape") {
		store.cancelAction();
	} else if (key.name === "return" || key.name === "enter") {
		const { pendingAction, dryRun } = store;
		store.confirmAction();
		if (pendingAction && selectedService) {
			store.executeAction(pendingAction, selectedService, { dryRun });
		}
	}
	return true; // Always consume input in confirm mode
}

/** Handle input while help panel is open */
function handleHelpMode(key: KeyEvent, store: StoreState): boolean {
	if (!store.showHelp) return false;

	if (key.name === "escape" || key.name === "?") {
		store.toggleHelp();
	}
	return true; // Always consume input in help mode
}

/** Handle input while search is focused */
function handleSearchMode(key: KeyEvent, store: StoreState): boolean {
	if (store.focusedPanel !== "search") return false;

	if (key.name === "escape") {
		if (store.searchQuery) {
			store.setSearch("");
		} else {
			store.setFocus("list");
		}
	} else if (key.name === "return" || key.name === "enter") {
		store.setFocus("list");
	}
	// Let input component handle other keys
	return true;
}

/** Handle navigation keys (arrows, vim, page up/down) */
function handleNavigation(key: KeyEvent, store: StoreState, filteredCount: number): boolean {
	if (key.name === "up" || key.name === "k") {
		store.selectPrev();
		return true;
	}
	if (key.name === "down" || key.name === "j") {
		if (store.selectedIndex < filteredCount - 1) store.selectNext();
		return true;
	}
	if (key.name === "g" && !key.shift) {
		store.selectIndex(0);
		return true;
	}
	if (key.shift && key.name === "g") {
		store.selectIndex(filteredCount - 1);
		return true;
	}
	if (key.name === "pageup") {
		store.selectIndex(Math.max(0, store.selectedIndex - 10));
		return true;
	}
	if (key.name === "pagedown") {
		store.selectIndex(Math.min(filteredCount - 1, store.selectedIndex + 10));
		return true;
	}
	return false;
}

/** Handle sorting keys */
function handleSorting(key: KeyEvent, store: StoreState): boolean {
	if (key.name === "s" && !key.shift) {
		store.cycleSortField();
		return true;
	}
	if (key.shift && key.name === "s") {
		store.toggleSortDirection();
		return true;
	}
	return false;
}

/** Handle filter shortcut keys */
function handleFilters(key: KeyEvent, store: StoreState): boolean {
	if (key.name === "1") {
		store.setFilter({ type: "all" });
		return true;
	}
	if (key.name === "2") {
		store.setFilter({ type: "LaunchDaemon" });
		return true;
	}
	if (key.name === "3") {
		store.setFilter({ type: "LaunchAgent" });
		return true;
	}
	if (key.name === "4") {
		store.setFilter({ type: "SystemExtension" });
		return true;
	}

	if (key.name === "a" && !key.shift) {
		store.setFilter({ showAppleServices: !store.filter.showAppleServices });
		return true;
	}
	if (key.name === "p") {
		store.setFilter({ showProtected: !store.filter.showProtected });
		return true;
	}

	if (key.name === "[") {
		const domains: Array<"all" | "system" | "user" | "gui"> = ["all", "system", "user", "gui"];
		const idx = domains.indexOf(store.filter.domain);
		const next = domains[(idx + 1) % domains.length];
		if (next) store.setFilter({ domain: next });
		return true;
	}
	if (key.name === "]") {
		const statuses = ["all", "running", "stopped", "disabled", "error"] as const;
		const idx = statuses.indexOf(store.filter.status as (typeof statuses)[number]);
		const next = statuses[(idx + 1) % statuses.length];
		if (next) store.setFilter({ status: next });
		return true;
	}
	return false;
}

/** Handle plist editor launch */
function handleEditor(
	key: KeyEvent,
	store: StoreState,
	selectedService: Service | null,
	renderer: ReturnType<typeof useRenderer>,
): boolean {
	if (key.name !== "e" || !selectedService || selectedService.type === "SystemExtension") {
		return false;
	}

	const plistPath = selectedService.plistPath;
	if (!plistPath) {
		store.setActionResult({ success: false, message: "No plist file for this service" });
		return true;
	}
	if (!plistExists(plistPath)) {
		store.setActionResult({ success: false, message: `Plist file not found: ${plistPath}` });
		return true;
	}

	const useRoot = requiresRootToEdit(plistPath);
	renderer.suspend();

	openInEditor(plistPath, { useRoot })
		.then((result) => {
			renderer.resume();
			if (result.success) {
				useAppStore.getState().setActionResult({ success: true, message: `Finished editing: ${plistPath}` });
				useAppStore.getState().refresh();
			} else if (result.error) {
				useAppStore.getState().setActionResult({ success: false, message: result.error });
			}
		})
		.catch((error) => {
			renderer.resume();
			useAppStore.getState().setActionResult({
				success: false,
				message: error instanceof Error ? error.message : "Failed to open editor",
			});
		});

	return true;
}

/** Handle service action keys (start, stop, reload, etc.) */
function handleServiceActions(key: KeyEvent, store: StoreState, selectedService: Service | null): boolean {
	if (!selectedService || selectedService.type === "SystemExtension") return false;

	const requestAction = (action: ServiceAction) => {
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

	if ((key.name === "return" || key.name === "enter") && selectedService.status !== "running") {
		requestAction("start");
		return true;
	}
	if (key.name === "x" && selectedService.status === "running") {
		requestAction("stop");
		return true;
	}
	if (key.name === "r" && !key.shift && selectedService.status === "running") {
		requestAction("reload");
		return true;
	}
	if (key.name === "d") {
		requestAction(selectedService.enabled ? "disable" : "enable");
		return true;
	}
	if (key.name === "u") {
		requestAction("unload");
		return true;
	}
	return false;
}

// ============================================================================
// Main hook
// ============================================================================

export function useKeyboardShortcuts() {
	const renderer = useRenderer();
	const { filteredServices } = useFilteredServices();
	const selectedService = useSelectedService(filteredServices);

	useKeyboard((key) => {
		const store = useAppStore.getState();

		if (store.executingAction) return;

		// Modal modes (consume all input)
		if (handlePasswordMode(key, store)) return;
		if (handleConfirmMode(key, store, selectedService)) return;

		// Help toggle (works everywhere)
		if (key.name === "?" || (key.shift && key.name === "/")) {
			store.toggleHelp();
			return;
		}
		if (handleHelpMode(key, store)) return;

		// Search mode
		if (handleSearchMode(key, store)) return;

		// Global shortcuts
		if (key.name === "q" || (key.ctrl && key.name === "c")) {
			renderer.destroy();
			process.exit(0);
		}
		if (key.name === "/") {
			store.setFocus("search");
			return;
		}
		if (key.name === "escape") {
			if (store.searchQuery) store.setSearch("");
			store.setActionResult(null);
			return;
		}
		if (key.name === "f") {
			store.toggleFilters();
			return;
		}
		if (key.shift && key.name === "r") {
			store.refresh();
			return;
		}
		if (key.shift && key.name === "a") {
			store.toggleAutoRefresh();
			return;
		}
		if (key.shift && key.name === "d") {
			store.toggleDryRun();
			return;
		}
		if (key.name === "tab") {
			store.setFocus(store.focusedPanel === "list" ? "details" : "list");
			return;
		}

		// Delegated handlers
		if (handleNavigation(key, store, filteredServices.length)) return;
		if (handleSorting(key, store)) return;
		if (handleFilters(key, store)) return;
		if (handleEditor(key, store, selectedService, renderer)) return;
		handleServiceActions(key, store, selectedService);
	});
}
