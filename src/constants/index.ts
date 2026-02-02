/**
 * UI Constants
 * Centralized constants for heights, widths, colors, and other UI values
 */

// Fixed UI element heights
export const HEADER_HEIGHT = 3;
export const SEARCH_BAR_HEIGHT = 1;
export const FILTER_BAR_HEIGHT = 8; // 6 rows (Type, Domain, Status, Show, Sort, blank) + 2 padding
export const FOOTER_HEIGHT = 3;
export const LIST_BORDER_HEIGHT = 2; // top + bottom border
export const LIST_HEADER_HEIGHT = 1;
export const LIST_FOOTER_HEIGHT = 1; // scroll indicator row

export const BASE_OVERHEAD =
	HEADER_HEIGHT +
	SEARCH_BAR_HEIGHT +
	FOOTER_HEIGHT +
	LIST_BORDER_HEIGHT +
	LIST_HEADER_HEIGHT +
	LIST_FOOTER_HEIGHT;

// Column width constants
export const COL_STATUS = 2;
export const COL_PROTECTION = 2;
export const COL_TYPE_DOMAIN_COMBINED = 8; // "D/sys" format
export const COL_TYPE_SEPARATE = 4; // "D" with padding
export const COL_DOMAIN_SEPARATE = 6; // "sys" with padding
export const COL_PID = 8;
export const COL_PADDING = 2; // left + right padding
export const COL_BORDER = 2; // list border

// Minimum width for label to be useful
export const MIN_LABEL_WIDTH = 15;
// Minimum terminal width to display the list
export const MIN_TERMINAL_WIDTH =
	COL_STATUS +
	COL_PROTECTION +
	COL_TYPE_DOMAIN_COMBINED +
	COL_PID +
	COL_PADDING +
	COL_BORDER +
	MIN_LABEL_WIDTH;
// Width threshold to show separate type/domain columns
export const WIDE_TERMINAL_THRESHOLD = 100;

// Colors
export const COLORS = {
	// Backgrounds
	bgPrimary: "#111827",
	bgSecondary: "#1f2937",
	bgTertiary: "#374151",
	bgHeader: "#1e3a5f",
	bgSelected: "#2563eb",
	bgFocus: "#3b82f6",
	bgWarning: "#7f1d1d",
	bgWarningLight: "#78350f",

	// Text colors
	textPrimary: "#ffffff",
	textSecondary: "#e5e7eb",
	textTertiary: "#9ca3af",
	textMuted: "#6b7280",
	textAccent: "#60a5fa",
	textSuccess: "#22c55e",
	textWarning: "#fbbf24",
	textError: "#ef4444",
	textWarningLight: "#fca5a5",
	textWarningYellow: "#fcd34d",

	// Status colors
	statusRunning: "#22c55e",
	statusStopped: "#6b7280",
	statusDisabled: "#eab308",
	statusError: "#ef4444",
	statusUnknown: "#8b5cf6",
} as const;
