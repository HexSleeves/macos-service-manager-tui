/**
 * Initial application state
 */

import type { AppState, OfflineState } from "../types";
import { ACTIVE_AUTO_REFRESH_INTERVAL } from "./constants";

const initialOfflineState: OfflineState = {
	isOffline: false,
	consecutiveFailures: 0,
	lastSuccessfulRefresh: null,
	cachedServices: [],
	lastError: null,
};

export const initialState: AppState = {
	services: [],
	loading: true,
	error: null,
	selectedIndex: 0,
	searchQuery: "",
	filter: {
		type: "all",
		domain: "all",
		status: "all",
		showAppleServices: false,
		showProtected: true,
	},
	sort: {
		field: "label",
		direction: "asc",
	},
	focusedPanel: "list",
	showHelp: false,
	showConfirm: false,
	showFilters: false,
	pendingAction: null,
	lastActionResult: null,
	executingAction: false,
	autoRefresh: {
		enabled: false,
		intervalMs: ACTIVE_AUTO_REFRESH_INTERVAL,
	},
	dryRun: false,
	dryRunCommand: null,
	offline: initialOfflineState,
	serviceMetadata: new Map(),
	metadataLoading: new Map(),
	showPasswordDialog: false,
	passwordDialogError: null,
	pendingPrivilegedAction: null,
	passwordInput: "",
};
