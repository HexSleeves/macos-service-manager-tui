# TODO - macOS Service Manager TUI

## Current State (as of 2025-02-03)

The application is **fully functional** with ~6,500 lines of TypeScript. Core features complete.

### Implemented Features
- ✅ Service listing from launchctl and systemextensionsctl
- ✅ Fuzzy search with match highlighting
- ✅ Filtering by type, domain, status, Apple services, protected services
- ✅ Keyboard shortcuts for all filters (`1-4`, `[`, `]`, `a`, `p`)
- ✅ Sorting by label, status, type, domain, PID
- ✅ Service actions: start, stop, reload, enable, disable, unload
- ✅ Dry-run mode (`Shift+D`) to preview commands
- ✅ Auto-refresh polling (`Shift+A`) every 10 seconds
- ✅ Offline mode detection with graceful degradation
- ✅ Plist metadata reading (KeepAlive, RunAtLoad, etc.)
- ✅ Responsive column widths based on terminal size
- ✅ Virtual scrolling for large service lists
- ✅ Zustand state management (clean architecture)
- ✅ Comprehensive README with badges and documentation
- ✅ MIT License

### Architecture Highlights
- **State**: Zustand store (`src/store/useAppStore.ts` - 354 lines)
- **Keyboard**: Centralized handler (`src/hooks/useKeyboardShortcuts.tsx` - 275 lines)
- **Services**: Modular launchctl (`src/services/launchctl/` - 7 files)
- **Components**: 10 React/OpenTUI components
- **Tests**: Launchctl parsing, fuzzy search, store utils

---

## High Priority

| Task | Description | Effort |
|------|-------------|--------|
| Add screenshot | `docs/screenshot.png` referenced in README | 5 min |
| Test on macOS | Verify launchctl parsing with real output | 30 min |
| Proper sudo handling | PTY/password handling instead of prefixing sudo | 4+ hrs |

## Quick Wins

| Task | Description | Effort |
|------|-------------|--------|
| Debounce search | Prevent filtering on every keystroke | 15 min |
| Update HelpPanel | Add `[` `]` shortcuts to help text | 10 min |

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
| Compact mode | Single-line filter bar for small terminals | 1 hr |

## Low Priority

### Documentation
| Task | Description | Effort |
|------|-------------|--------|
| Video demo | Asciinema recording of usage | 30 min |
| Update ARCHITECTURE.md | Reflect Zustand migration | 1 hr |

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
| No screenshot | README references missing `docs/screenshot.png` | High |
| HelpPanel outdated | Missing `[` `]` domain/status shortcuts | Medium |

---

## Completed ✓

### Core Features
- [x] Service listing and details panel
- [x] Vim-style keyboard navigation (j/k, g/G)
- [x] Fuzzy search with match highlighting
- [x] Type/domain/status filters with shortcuts
- [x] Sort by multiple fields
- [x] Service actions with confirmation
- [x] Help panel with shortcuts
- [x] Status and protection indicators

### Architecture
- [x] Zustand state management
- [x] Centralized keyboard handling
- [x] Modular launchctl service
- [x] Virtual scrolling
- [x] Offline mode detection
- [x] Auto-refresh polling
- [x] Dry-run mode
- [x] Plist metadata reading

### Code Quality
- [x] TypeScript strict mode
- [x] Biome linting/formatting
- [x] Unit tests for parsing
- [x] Mock data for non-macOS dev
- [x] Clean process exit on quit

### Documentation
- [x] Comprehensive README
- [x] MIT License
- [x] Contributing guidelines
- [x] CONTEXT.md for AI agents
- [x] AGENTS.md for development
