# TODO - macOS Service Manager TUI

## Current State (as of 2025-02-03)

The application is **fully functional** with ~7,000 lines of TypeScript. All core features complete.

### Implemented Features
- ✅ Service listing from launchctl and systemextensionsctl
- ✅ Fuzzy search with match highlighting and 300ms debounce
- ✅ Filtering by type, domain, status, Apple services, protected services
- ✅ Keyboard shortcuts for all filters (`1-4`, `[`, `]`, `a`, `p`)
- ✅ Sorting by label, status, type, domain, PID
- ✅ Service actions: start, stop, reload, enable, disable, unload
- ✅ **Open plist in editor** (`e` key) with TUI suspend/resume
- ✅ Dry-run mode (`Shift+D`) to preview commands
- ✅ Auto-refresh polling (`Shift+A`) every 10 seconds
- ✅ Offline mode detection with graceful degradation
- ✅ Plist metadata reading (KeepAlive, RunAtLoad, etc.)
- ✅ Responsive column widths based on terminal size
- ✅ Virtual scrolling for large service lists
- ✅ Zustand state management (clean architecture)
- ✅ **Proper sudo/PTY handling** (osascript + TUI password dialog)
- ✅ Touch ID support for sudo (via pam_tid.so)
- ✅ Comprehensive README with badges and documentation
- ✅ MIT License

### Architecture Highlights
- **State**: Zustand store (`src/store/useAppStore.ts`)
- **Keyboard**: Centralized handler (`src/hooks/useKeyboardShortcuts.tsx`)
- **Services**: Modular launchctl (`src/services/launchctl/` - 8 files)
- **Components**: 11 React/OpenTUI components
- **Sudo**: Hybrid approach - osascript (GUI) / password dialog (SSH)
- **Editor**: Uses `renderer.suspend()`/`resume()` for seamless editing

---

## High Priority

| Task | Description | Status |
|------|-------------|--------|
| ~~Add screenshot~~ | `docs/image.png` | ✅ Done |
| ~~Proper sudo handling~~ | osascript + TUI password dialog | ✅ Done |
| ~~Open plist in editor~~ | Press `e` with suspend/resume | ✅ Done |
| Test on macOS | Verify all features work correctly | Ongoing |

## Medium Priority - Features

| Task | Description | Effort |
|------|-------------|--------|
| Service log viewer | Show logs via `log show --predicate` | 2-3 hrs |
| Favorites/bookmarks | Pin frequently managed services | 2 hrs |
| Mouse support | Click to select, scroll wheel | 2-3 hrs |
| Batch operations | Select multiple services, action on all | 3-4 hrs |
| History | Track actions performed with timestamps | 2 hrs |

## Medium Priority - UI

| Task | Description | Effort |
|------|-------------|--------|
| Color themes | Light/dark mode, customizable colors | 2-3 hrs |
| Service dependencies | Show what depends on a service | 3-4 hrs |
| Compact filter bar | Single-line filter bar for small terminals | 1 hr |

## Low Priority

### Documentation
| Task | Description | Effort |
|------|-------------|--------|
| Video demo | Asciinema recording of usage | 30 min |
| Update ARCHITECTURE.md | Reflect current state | 1 hr |

### Testing
| Task | Description | Effort |
|------|-------------|--------|
| Component tests | Test UI components with mock store | 2-3 hrs |
| E2E tests | Full workflow tests with mock data | 3-4 hrs |

### Distribution
| Task | Description | Effort |
|------|-------------|--------|
| Standalone binary | Bundle with bun for single-file distribution | 1 hr |
| Homebrew formula | `brew install macos-service-manager` | 2 hrs |
| npm package | `npx macos-service-manager` | 1 hr |

## Technical Debt

| Task | Description | Lines | Effort |
|------|-------------|-------|--------|
| Split ServiceList.tsx | Extract ServiceRow, ListHeader components | 405 | 1 hr |
| Split plist.ts | Separate parsing from description logic | 454 | 1 hr |
| Split launchctl/index.ts | Extract action handlers | 417 | 1 hr |

## Known Issues

| Issue | Description | Priority |
|-------|-------------|----------|
| HelpPanel rendering | Some terminals may show garbled text | Low |

---

## Completed ✓

### Core Features
- [x] Service listing and details panel
- [x] Vim-style keyboard navigation (j/k, g/G)
- [x] Fuzzy search with match highlighting
- [x] Search input debouncing (300ms)
- [x] Type/domain/status filters with shortcuts
- [x] Sort by multiple fields
- [x] Service actions with confirmation
- [x] Help panel with shortcuts
- [x] Status and protection indicators
- [x] Open plist in $EDITOR (with TUI suspend/resume)

### Privilege Escalation
- [x] Sudo credential caching detection
- [x] osascript with admin privileges (GUI context)
- [x] TUI password dialog (SSH/headless context)
- [x] Touch ID support documentation
- [x] Proper sudo caching after osascript auth

### Architecture
- [x] Zustand state management
- [x] Centralized keyboard handling
- [x] Modular launchctl service (8 files)
- [x] Virtual scrolling
- [x] Offline mode detection
- [x] Auto-refresh polling
- [x] Dry-run mode
- [x] Plist metadata reading
- [x] Editor utilities with suspend/resume

### Bug Fixes
- [x] Ghost rows when toggling filters
- [x] Duplicate system extensions
- [x] Start action shortcut display (`[s]` → `[↵]`)
- [x] FilterBar alignment with ServiceList
- [x] Domain detection for LaunchAgents (gui vs system)
- [x] Process exit on quit
- [x] Sudo credential caching after osascript
- [x] HelpPanel text overlap

### Documentation
- [x] Comprehensive README
- [x] MIT License
- [x] Contributing guidelines
- [x] CONTEXT.md for AI agents
- [x] AGENTS.md for development
- [x] Touch ID for sudo instructions
- [x] Open plist editor implementation plan
