/**
 * Constants for state management
 */

// Default auto-refresh interval (10 seconds)
export const DEFAULT_AUTO_REFRESH_INTERVAL = 10000;
// Active interval after user interaction (10 seconds)
export const ACTIVE_AUTO_REFRESH_INTERVAL = 10000;
// Idle interval when no recent interaction (30 seconds)
export const IDLE_AUTO_REFRESH_INTERVAL = 30000;
// Time threshold for considering user idle (60 seconds)
export const IDLE_THRESHOLD_MS = 60000;

// Number of consecutive failures before entering offline mode
export const OFFLINE_THRESHOLD = 3;

// Maximum metadata cache size (LRU eviction)
export const MAX_METADATA_CACHE_SIZE = 100;

// Search debounce delay (milliseconds)
export const SEARCH_DEBOUNCE_MS = 250;

// Reconnect interval when offline (30 seconds)
export const OFFLINE_RECONNECT_INTERVAL = 30000;
