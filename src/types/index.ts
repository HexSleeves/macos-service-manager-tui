/**
 * macOS Service Manager - Type Definitions
 */

// Domain types for macOS services
export type ServiceDomain = "system" | "user" | "gui";

// Service types
export type ServiceType = "LaunchDaemon" | "LaunchAgent" | "SystemExtension";

// Service status
export type ServiceStatus =
	| "running"
	| "stopped"
	| "disabled"
	| "error"
	| "unknown";

// Protection status
export type ProtectionStatus =
	| "normal"
	| "sip-protected"
	| "system-owned"
	| "immutable";

// Service action types
export type ServiceAction =
	| "start"
	| "stop"
	| "enable"
	| "disable"
	| "unload"
	| "reload";

// Plist metadata extracted from service plist files
export interface PlistMetadata {
	program?: string;
	programArguments?: string[];
	runAtLoad?: boolean;
	keepAlive?: boolean | Record<string, unknown>;
	workingDirectory?: string;
	environmentVariables?: Record<string, string>;
	standardOutPath?: string;
	standardErrorPath?: string;
	startInterval?: number;
	startCalendarInterval?: Record<string, number> | Record<string, number>[];
	processType?: string;
	watchPaths?: string[];
	queueDirectories?: string[];
	hasSockets?: boolean;
	hasMachServices?: boolean;
}

// Core service interface
export interface Service {
	id: string;
	label: string;
	displayName: string;
	type: ServiceType;
	domain: ServiceDomain;
	status: ServiceStatus;
	pid?: number;
	exitStatus?: number;
	protection: ProtectionStatus;
	plistPath?: string;
	bundleId?: string;
	description?: string;
	lastError?: string;
	enabled: boolean;
	isAppleService: boolean;
	requiresRoot: boolean;
	plistMetadata?: PlistMetadata;
}

// System extension specific info
export interface SystemExtension extends Service {
	teamId?: string;
	version?: string;
	state?:
		| "activated_enabled"
		| "activated_waiting"
		| "uninstalled"
		| "terminated";
	categories?: string[];
}

// Filter options
export interface FilterOptions {
	type: ServiceType | "all";
	domain: ServiceDomain | "all";
	status: ServiceStatus | "all";
	showAppleServices: boolean;
	showProtected: boolean;
}

// Sort options
export type SortField = "label" | "status" | "type" | "domain" | "pid";
export type SortDirection = "asc" | "desc";

export interface SortOptions {
	field: SortField;
	direction: SortDirection;
}

// Retry information for action results
export interface RetryInfo {
	/** Total number of attempts made (1 = no retries) */
	attempts: number;
	/** Whether retries were needed */
	retried: boolean;
	/** Errors encountered during retries */
	retryErrors?: string[];
}

// Action result
export interface ActionResult {
	success: boolean;
	message: string;
	error?: string;
	requiresRoot?: boolean;
	sipProtected?: boolean;
	/** Retry information if retries were attempted */
	retryInfo?: RetryInfo;
}

// Auto-refresh configuration
export interface AutoRefreshConfig {
	enabled: boolean;
	intervalMs: number; // Interval in milliseconds
}

// App state
export interface AppState {
	services: Service[];
	loading: boolean;
	error: string | null;
	selectedIndex: number;
	searchQuery: string;
	filter: FilterOptions;
	sort: SortOptions;
	focusedPanel: "list" | "details" | "search" | "help";
	showHelp: boolean;
	showConfirm: boolean;
	showFilters: boolean; // Whether the filter bar is visible
	pendingAction: ServiceAction | null;
	lastActionResult: ActionResult | null;
	executingAction: boolean; // True while an action is being executed
	autoRefresh: AutoRefreshConfig; // Auto-refresh settings
	dryRun: boolean; // When true, show commands without executing them
	dryRunCommand: string | null; // The command that would be executed in dry-run mode
}

// App actions
export type AppAction =
	| { type: "SET_SERVICES"; payload: Service[] }
	| { type: "SET_LOADING"; payload: boolean }
	| { type: "SET_ERROR"; payload: string | null }
	| { type: "SELECT_INDEX"; payload: number }
	| { type: "SELECT_NEXT" }
	| { type: "SELECT_PREV" }
	| { type: "SET_SEARCH"; payload: string }
	| { type: "SET_FILTER"; payload: Partial<FilterOptions> }
	| { type: "SET_SORT"; payload: SortOptions }
	| { type: "TOGGLE_SORT_DIRECTION" }
	| { type: "CYCLE_SORT_FIELD" }
	| { type: "SET_FOCUS"; payload: AppState["focusedPanel"] }
	| { type: "TOGGLE_HELP" }
	| { type: "REQUEST_ACTION"; payload: ServiceAction }
	| { type: "CONFIRM_ACTION" }
	| { type: "CANCEL_ACTION" }
	| { type: "SET_ACTION_RESULT"; payload: ActionResult | null }
	| { type: "REFRESH" }
	| { type: "SET_EXECUTING"; payload: boolean }
	| { type: "TOGGLE_FILTERS" }
	| { type: "TOGGLE_AUTO_REFRESH" }
	| { type: "SET_AUTO_REFRESH_INTERVAL"; payload: number }
	| { type: "UPDATE_SERVICES"; payload: Service[] }
	| { type: "TOGGLE_DRY_RUN" }
	| { type: "SET_DRY_RUN_COMMAND"; payload: string | null };

// Context type
export interface AppContextType {
	state: AppState;
	dispatch: React.Dispatch<AppAction>;
	filteredServices: Service[];
	selectedService: Service | null;
	executeAction: (
		action: ServiceAction,
		service: Service,
	) => Promise<ActionResult>;
	refresh: () => Promise<void>;
}
