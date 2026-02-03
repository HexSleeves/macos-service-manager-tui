# macOS Service Manager TUI - Project Context

## Overview

A Terminal User Interface (TUI) for managing macOS system services (LaunchDaemons, LaunchAgents, and System Extensions). Built with [OpenTUI](https://github.com/anomalyco/opentui) React renderer and TypeScript.

**Repository**: <https://github.com/HexSleeves/macos-service-manager-tui>

## Tech Stack

- **Runtime**: [Bun](https://bun.sh/) v1.0+
- **UI Framework**: [@opentui/react](https://github.com/anomalyco/opentui) - React reconciler for terminal UIs
- **State Management**: [Zustand](https://zustand-demo.pmnd.rs/) v5 - Lightweight state management
- **Language**: TypeScript (strict mode)
- **Linting/Formatting**: [Biome](https://biomejs.dev/)
- **Target Platform**: macOS 11+ (Big Sur and later)

## Project Structure

```bash
macos-service-manager/
├── src/
│   ├── index.tsx              # Main entry point, app shell
│   ├── types/
│   │   └── index.ts           # TypeScript type definitions (162 lines)
│   ├── constants/
│   │   └── index.ts           # UI constants (colors, column widths)
│   ├── store/                 # Zustand state management
│   │   ├── index.ts           # Store exports
│   │   ├── useAppStore.ts     # Main store with state + actions (354 lines)
│   │   ├── useAppEffects.ts   # Side effects (auto-refresh, reconnect)
│   │   ├── useDerivedState.ts # Computed selectors (filtered services)
│   │   ├── constants.ts       # Store constants (thresholds, intervals)
│   │   ├── initialState.ts    # Default state values
│   │   └── utils.ts           # Helper functions (mergeServices)
│   ├── services/
│   │   ├── index.ts           # Unified service discovery API (251 lines)
│   │   ├── launchctl/         # launchctl module (7 files)
│   │   │   ├── index.ts       # Main exports & actions (417 lines)
│   │   │   ├── exec.ts        # Command execution with timeout
│   │   │   ├── parsers.ts     # Output parsing (274 lines)
│   │   │   ├── permissions.ts # Permission & root checks
│   │   │   ├── errors.ts      # Error parsing & messages
│   │   │   ├── types.ts       # Launchctl-specific types
│   │   │   ├── version.ts     # macOS version detection
│   │   │   └── validation.ts  # Input validation
│   │   ├── systemextensions.ts # systemextensionsctl parsing (209 lines)
│   │   ├── plist.ts           # Plist file parsing (454 lines)
│   │   └── mock.ts            # Mock data for non-macOS (374 lines)
│   ├── hooks/
│   │   └── useKeyboardShortcuts.tsx # All keyboard handling (275 lines)
│   ├── utils/
│   │   ├── index.ts           # Utility exports
│   │   ├── fuzzy.ts           # Fuzzy search with scoring (298 lines)
│   │   └── retry.ts           # Retry logic with backoff (261 lines)
│   └── components/
│       ├── index.ts           # Component exports
│       ├── Header.tsx         # App title bar with stats
│       ├── Footer.tsx         # Keyboard shortcuts bar
│       ├── SearchBar.tsx      # Search input
│       ├── FilterBar.tsx      # Filter controls (type/domain/status)
│       ├── ServiceList.tsx    # Virtual scrolling list (405 lines)
│       ├── ServiceDetails.tsx # Detail panel with actions (213 lines)
│       ├── ConfirmDialog.tsx  # Action confirmation modal
│       ├── HelpPanel.tsx      # Keyboard shortcuts help (171 lines)
│       └── StatusIndicator.tsx # Status icons and colors
├── docs/
│   ├── TODO.md               # Task tracking
│   ├── ARCHITECTURE.md       # Technical deep-dive
│   └── SECURITY.md           # Security considerations
├── package.json
├── tsconfig.json
├── biome.json                # Linting/formatting config
├── LICENSE                   # MIT License
└── README.md
```

**Total codebase**: ~6,500 lines of TypeScript/TSX

## Key Concepts

### State Management

Uses **Zustand** for global state management (migrated from Context + useReducer):

```typescript
// src/store/useAppStore.ts
const useAppStore = create<AppStoreState & AppStoreActions>((set, get) => ({
  // State
  services: [],
  loading: true,
  error: null,
  selectedIndex: 0,
  searchQuery: '',
  filter: FilterOptions,
  sort: SortOptions,
  focusedPanel: 'list',
  showHelp: false,
  showConfirm: false,
  pendingAction: null,
  lastActionResult: null,
  offline: OfflineState,
  serviceMetadata: Map<string, Partial<Service>>,

  // Actions (methods that update state)
  setServices: (services) => set({ services }),
  selectNext: () => set((state) => ({ selectedIndex: state.selectedIndex + 1 })),
  refresh: async () => { /* fetch and update */ },
  executeAction: async (action, service, options) => { /* perform action */ },
  // ... more actions
}));

// Usage in components:
const services = useAppStore((state) => state.services);
const refresh = useAppStore((state) => state.refresh);
```

**Key files:**

- `src/store/useAppStore.ts` - Main store with state and actions
- `src/store/useAppEffects.ts` - Side effects (auto-refresh, offline reconnect, metadata prefetch)
- `src/store/useDerivedState.ts` - Computed selectors (filtered/sorted services, selected service)

### Service Discovery

Uses `launchctl list` to get services (works without root):

```bash
# Output format: PID\tStatus\tLabel
launchctl list
-       0       com.example.stopped
1234    0       com.example.running
-       78      com.example.error
```

- `PID = -`: Service not running
- `Status = 0`: Clean exit
- `Status != 0`: Error exit code

### Service Types

| Type | Description | Location |
| ---- | ----------- | -------- |
| LaunchDaemon | System-level services | /Library/LaunchDaemons, /System/Library/LaunchDaemons |
| LaunchAgent | User-level services | ~/Library/LaunchAgents, /Library/LaunchAgents |
| SystemExtension | Kernel extension replacements | Managed via systemextensionsctl |

### Protection Levels

| Level | Symbol | Description |
| ----- | ------ | ----------- |
| normal | (none) | Can be modified |
| system-owned | ⚙ | Apple service, may have restrictions |
| sip-protected | 🔒 | Protected by System Integrity Protection |
| immutable | 🛡 | Cannot be modified (e.g., launchd itself) |

### Service Actions

```typescript
type ServiceAction = 'start' | 'stop' | 'enable' | 'disable' | 'unload' | 'reload';
```

Mapped to launchctl commands:

- `start` → `launchctl kickstart -k <target>`
- `stop` → `launchctl kill SIGTERM <target>`
- `enable` → `launchctl enable <target>`
- `disable` → `launchctl disable <target>`
- `unload` → `launchctl bootout <target>`
- `reload` → `launchctl kickstart -kp <target>`

## UI Layout

```bash
┌─────────────────────────────────────────────────────────────┐
│ ⚙ macOS Service Manager          Services: 23  Running: 17 │ <- Header (3 rows)
├─────────────────────────────────────────────────────────────┤
│ 🔍 Search services...                                       │ <- SearchBar (1 row)
├─────────────────────────────────────────────────────────────┤
│ [Filter Bar - toggleable with 'f']                          │ <- FilterBar (6 rows when visible)
├────────────────────────────┬────────────────────────────────┤
│ S P Type    Label      PID │ Service Details                │
│ ● ⚙ A/usr  com.docker 1567│ ─────────────────              │
│ ○   D/sys  org.nginx   -  │ Label: com.docker.helper       │
│ ...                        │ Type: LaunchAgent              │
│                            │ Status: ● running              │
│                            │ PID: 1567                      │
│                            │ ...                            │
│                            │ [Actions: Stop, Reload, etc.]  │
├────────────────────────────┴────────────────────────────────┤
│ ↑↓/jk Navigate  / Search  f Filter  a Toggle Apple  ? Help │ <- Footer (3 rows)
└─────────────────────────────────────────────────────────────┘
```

## Keyboard Shortcuts

### Navigation

- `↑/k` - Move up
- `↓/j` - Move down
- `g` - Go to first
- `G` - Go to last
- `Tab` - Switch panel focus

### Search & Filter

- `/` - Focus search
- `Esc` - Clear search / Cancel
- `f` - Toggle filter bar
- `1-4` - Filter by type (All/Daemon/Agent/Extension)
- `[` - Cycle domain filter (All/System/User/GUI)
- `]` - Cycle status filter (All/Running/Stopped/Disabled/Error)
- `a` - Toggle Apple services visibility
- `p` - Toggle protected services visibility

### Sorting

- `s` - Cycle sort field (label/status/type/domain/pid)
- `S` - Toggle sort direction

### Actions

- `Enter` - Start service (if stopped)
- `x` - Stop service
- `r` - Reload service
- `d` - Toggle enable/disable
- `u` - Unload service
- `R` - Refresh service list

### General

- `?` - Toggle help panel
- `q` / `Ctrl+C` - Quit

## Default Behavior

- **Apple services hidden by default** - Press `a` to show
- **Protected services shown** - Press `p` to hide
- **Sorted by label (A-Z)** - Press `s` to change, `S` to reverse
- **All types shown** - Press `1-4` to filter

## Development

### Running Locally

```bash
# Install dependencies
bun install

# Run in development mode (with watch)
bun run dev

# Run once
bun run src/index.tsx

# Type check
bun run typecheck

# Lint and format
bun run check
```

### Non-macOS Development

On non-macOS systems, mock data is automatically used for development/testing.

### Scripts

```json
{
  "dev": "bun run --watch src/index.tsx",
  "typecheck": "tsc --noEmit",
  "check": "bunx biome check --write",
  "format": "bunx biome format --write .",
  "lint": "bunx biome lint --write ."
}
```

## OpenTUI Specifics

### Components Used

- `<box>` - Flexbox container with borders, backgrounds
- `<text>` - Text with styling (`fg`, `bg`)
- `<span>` - Inline text styling within `<text>`
- `<input>` - Text input field
- `<scrollbox>` - Scrollable container (avoided due to rendering issues)

### Hooks Used

- `useKeyboard()` - Keyboard event handling
- `useRenderer()` - Access to renderer for `destroy()`
- `useTerminalDimensions()` - Get terminal width/height

### Key Patterns

1. **Centering modals**: Use full-screen absolute overlay with flexbox

   ```tsx
   <box position="absolute" left={0} top={0} right={0} bottom={0}
        justifyContent="center" alignItems="center">
     <box width={60}>{/* modal content */}</box>
   </box>
   ```

2. **Virtual scrolling**: Calculate visible window based on terminal height

   ```tsx
   const { height } = useTerminalDimensions();
   const visibleRows = height - FIXED_OVERHEAD;
   const visibleServices = services.slice(startIndex, startIndex + visibleRows);
   ```

3. **Keyboard handling**: Single handler with state-aware branching

   ```tsx
   useKeyboard((key) => {
     if (state.showConfirm) { /* handle confirm dialog */ return; }
     if (state.showHelp) { /* handle help panel */ return; }
     // ... normal key handling
   });
   ```

## Known Limitations

1. **System Extensions** - Cannot be started/stopped directly; must use System Preferences
2. **Root privileges** - Some operations require sudo (indicated in UI)
3. **SIP-protected services** - Cannot be modified (macOS security)
4. **No scrollbox** - Using manual virtual scrolling due to rendering issues with scrollbox component

## References

- [launchctl commands reference](https://rakhesh.com/mac/macos-launchctl-commands/)
- [OpenTUI documentation](https://github.com/anomalyco/opentui)
- [OpenTUI skill reference](https://github.com/msmps/opentui-skill)
