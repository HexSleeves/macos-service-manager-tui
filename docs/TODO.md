# TODO - macOS Service Manager TUI

## Current State (as of 2025-02-02)

The application is functional with the following features implemented:
- Service listing from launchctl and systemextensionsctl
- Fuzzy search with match highlighting
- Filtering by type, domain, status, Apple services, protected services
- Domain filter cycling with `[` key (All/System/User/GUI)
- Status filter cycling with `]` key (All/Running/Stopped/Disabled/Error)
- Sorting by label, status, type, domain, PID
- Service actions: start, stop, reload, enable, disable, unload
- Dry-run mode (Shift+D) to preview commands
- Auto-refresh polling (Shift+A) every 10 seconds
- Offline mode detection with graceful degradation
- Plist metadata reading (KeepAlive, RunAtLoad, etc.)
- Responsive column widths based on terminal size
- Virtual scrolling for large service lists

### Recent Changes
- **Migrated to Zustand** for state management (from Context + useReducer)
  - `src/store/useAppStore.ts` - Main store with state and actions
  - `src/store/useAppEffects.ts` - Side effects (auto-refresh, reconnect, metadata)
  - `src/store/useDerivedState.ts` - Computed selectors
- Extracted keyboard handling to `src/hooks/useKeyboardShortcuts.tsx`
- Added domain and status filter keyboard shortcuts (`[` and `]`)
- Added constants module (`src/constants/index.ts`) for UI colors/dimensions
- Added comprehensive tests for reducer and utils

### Recent Fixes
- Fixed ghost rows when toggling filters rapidly (position-based keys for virtual scrolling)
- Fixed duplicate system extensions (deduplication by bundleId)
- Refactored launchctl.ts (1260 lines) into 8 focused modules
- Fixed all lint errors (array index keys, assignment in expressions)
- Fixed Start action shortcut display (was showing `[s]`, now shows `[↵]`)

## High Priority (Remaining)

| Task | Description | Status |
|------|-------------|--------|
| Test on actual macOS | Verify launchctl parsing works with real output | ⬚ |
| Implement proper sudo handling | PTY/password handling instead of just prefixing sudo | ⬚ |

## Medium Priority

### UI Improvements
| Task | Description | Status |
|------|-------------|--------|
| Service log viewer | Show recent logs from `log show --predicate` | ⬚ |
| Mouse support | Click to select, scroll wheel | ⬚ |
| Color themes | Light/dark mode, customizable colors | ⬚ |

### Features
| Task | Description | Status |
|------|-------------|--------|
| Service dependencies | Show what depends on a service | ⬚ |
| Batch operations | Select multiple services, perform action on all | ⬚ |
| History | Track actions performed with timestamps | ⬚ |
| Favorites/bookmarks | Pin frequently managed services | ⬚ |

## Low Priority

### Documentation
| Task | Description | Status |
|------|-------------|--------|
| Screenshots | Visual documentation in README | ⬚ |
| Video demo | Asciinema recording of usage | ⬚ |

### Testing
| Task | Description | Status |
|------|-------------|--------|
| Unit tests | More tests for parsing functions | ⬚ |
| Integration tests | Test full workflows with mock data | ⬚ |

### Build & Distribution
| Task | Description | Status |
|------|-------------|--------|
| Standalone binary | Bundle with bun for single-file distribution | ⬚ |
| Homebrew formula | `brew install macos-service-manager` | ⬚ |

## Technical Debt

| Task | Description | Status |
|------|-------------|--------|
| Split ServiceList.tsx | 451 lines, could be broken into smaller components | ⬚ |
| Remove legacy useAppState | Keep Zustand only, remove old Context code | ⬚ |
| Debounce search input | Prevent filtering on every keystroke | ⬚ |
| Memoize filtered results | Prevent unnecessary recalculations | ⬚ |

## Known Issues

| Issue | Description | Status |
|-------|-------------|--------|
| Search doesn't clear on filter change | Should optionally reset | ⬚ |

## Completed ✓

- Basic service listing and details panel
- Keyboard navigation (vim-style j/k)
- Search filtering with fuzzy matching
- Type/domain/status filters with keyboard shortcuts (1-4, [, ])
- Sort options
- Action buttons with confirmation dialogs
- Help panel with keyboard shortcuts
- Status and protection indicators
- Mock data for non-macOS development
- **Zustand state management** (migrated from React Context)
- launchctl and systemextensionsctl parsing
- Dynamic list height based on terminal size
- Virtual scrolling for large lists
- Hide Apple services by default
- Biome linting and TypeScript strict mode
- Error parsing with user-friendly messages
- Command timeout handling (30s)
- Input validation (prevent command injection)
- Loading spinners and executing overlay
- Adaptive help panel for small terminals
- Collapsible filter bar
- Plist metadata reading
- Auto-refresh polling
- Dry-run mode
- Offline mode detection
- Responsive column widths
- Fuzzy search with scoring
- System extension deduplication
- Refactored launchctl module structure
- Extracted keyboard shortcuts to dedicated hook
- Centralized UI constants
