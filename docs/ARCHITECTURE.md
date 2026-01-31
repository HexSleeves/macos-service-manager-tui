# Architecture Overview

## High-Level Design

```
┌───────────────────────────────────────────────────────────┐
│                        TUI Layer                            │
│  ┌─────────────┐ ┌─────────────┐ ┌──────────────────────┐ │
│  │   Header    │ │  SearchBar  │ │     FilterBar        │ │
│  └─────────────┘ └─────────────┘ └──────────────────────┘ │
│  ┌──────────────────────────┐ ┌─────────────────────────┐ │
│  │                          │ │                         │ │
│  │      ServiceList         │ │    ServiceDetails       │ │
│  │                          │ │                         │ │
│  │  - Scrollable list       │ │  - Selected service     │ │
│  │  - Status indicators     │ │  - Full metadata        │ │
│  │  - Keyboard navigation   │ │  - Action buttons       │ │
│  │                          │ │                         │ │
│  └──────────────────────────┘ └─────────────────────────┘ │
│  ┌─────────────────────────────────────────────────────┐ │
│  │                   Footer                              │ │
│  └─────────────────────────────────────────────────────┘ │
└───────────────────────────────────────────────────────────┘
                            │
                            ▼
┌───────────────────────────────────────────────────────────┐
│                     State Management                        │
│  ┌─────────────────────────────────────────────────────┐ │
│  │  AppContext (React Context + useReducer)               │ │
│  │    - services[]        - State                        │ │
│  │    - selectedIndex     - Dispatch                     │ │
│  │    - filter options    - Memoized selectors           │ │
│  │    - sort options      - Action handlers              │ │
│  └─────────────────────────────────────────────────────┘ │
└───────────────────────────────────────────────────────────┘
                            │
                            ▼
┌───────────────────────────────────────────────────────────┐
│                     Service Layer                           │
│  ┌─────────────────┐ ┌───────────────────┐ ┌────────────┐ │
│  │   launchctl.ts  │ │  systemextensions  │ │  mock.ts   │ │
│  │  - List parsing │ │  - List parsing    │ │ - Dev data │ │
│  │  - Actions      │ │  - Status parsing  │ │            │ │
│  └─────────────────┘ └───────────────────┘ └────────────┘ │
└───────────────────────────────────────────────────────────┘
                            │
                            ▼
┌───────────────────────────────────────────────────────────┐
│                     macOS System                             │
│  ┌─────────────────┐ ┌─────────────────────────────────┐ │
│  │   launchctl     │ │       systemextensionsctl         │ │
│  └─────────────────┘ └─────────────────────────────────┘ │
└───────────────────────────────────────────────────────────┘
```

## State Management

The application uses React Context with `useReducer` for state management:

```typescript
interface AppState {
  services: Service[];           // All discovered services
  loading: boolean;              // Loading state
  error: string | null;          // Error message
  selectedIndex: number;         // Currently selected service
  searchQuery: string;           // Search filter
  filter: FilterOptions;         // Filter settings
  sort: SortOptions;             // Sort settings
  focusedPanel: 'list' | 'details' | 'search';
  showHelp: boolean;             // Help panel visibility
  showConfirm: boolean;          // Confirmation dialog
  pendingAction: ServiceAction | null;
  lastActionResult: ActionResult | null;
}
```

### Actions

```typescript
type AppAction =
  | { type: 'SET_SERVICES'; payload: Service[] }
  | { type: 'SELECT_INDEX'; payload: number }
  | { type: 'SET_SEARCH'; payload: string }
  | { type: 'SET_FILTER'; payload: Partial<FilterOptions> }
  | { type: 'REQUEST_ACTION'; payload: ServiceAction }
  | { type: 'CONFIRM_ACTION' }
  | { type: 'CANCEL_ACTION' }
  // ... etc
```

## Command Execution Strategy

### Modern launchctl (macOS 10.10+)

```bash
# List all services in a domain
launchctl print system
launchctl print user/501
launchctl print gui/501

# Get detailed service info
launchctl print system/com.apple.mDNSResponder

# Start a service (kickstart forces immediate start)
launchctl kickstart -k system/com.example.myservice

# Stop a service
launchctl kill SIGTERM system/com.example.myservice

# Enable/disable
launchctl enable system/com.example.myservice
launchctl disable system/com.example.myservice

# Unload (remove from launchd)
launchctl bootout system/com.example.myservice
```

### Legacy launchctl (fallback)

```bash
# List services
launchctl list

# Load/unload
launchctl load /path/to/plist
launchctl unload /path/to/plist
```

### Output Parsing

The app parses `launchctl list` output:

```
PID    Status    Label
-      0         com.example.stopped
1234   0         com.example.running
-      78        com.example.error
```

- `PID = -`: Service not running
- `Status = 0`: Clean exit or never run
- `Status != 0`: Error exit code

## Error Handling

### Permission Detection

```typescript
const isPermissionError = 
  result.stderr.includes('Operation not permitted') ||
  result.stderr.includes('Permission denied') ||
  result.exitCode === 1;

if (isPermissionError && !service.requiresRoot) {
  return {
    success: false,
    message: 'Requires elevated privileges',
    requiresRoot: true,
  };
}
```

### SIP Detection

```typescript
function getProtectionStatus(label: string, plistPath?: string): ProtectionStatus {
  // System paths are SIP protected
  if (plistPath?.startsWith('/System/')) return 'sip-protected';
  
  // Apple services are system-owned
  if (label.startsWith('com.apple.')) return 'system-owned';
  
  // Known immutable services
  const immutable = ['com.apple.launchd', 'com.apple.kextd'];
  if (immutable.some(s => label.startsWith(s))) return 'immutable';
  
  return 'normal';
}
```

## Component Design

### ServiceList

- Virtual scrolling with visible window
- Alternating row colors
- Status indicators (color + symbol)
- Protection badges
- Keyboard navigation (j/k, arrows)

### ServiceDetails

- Dynamic content based on service type
- Action buttons with keyboard shortcuts
- Warning banners for protected/root services
- System extension specific fields

### FilterBar

- Type filter (Daemon/Agent/Extension)
- Domain filter (System/User)
- Status filter (Running/Stopped/Error)
- Toggle switches for Apple/Protected visibility

## Security Model

### Principle of Least Privilege

1. **User services first**: Prefer user-domain operations
2. **Root only when needed**: Use `sudo` only for system services
3. **Never bypass SIP**: Respect system protections
4. **Confirmation required**: All destructive actions need confirmation

### Safe Defaults

```typescript
const initialFilter: FilterOptions = {
  type: 'all',
  domain: 'all',
  status: 'all',
  showAppleServices: true,   // Show but indicate
  showProtected: true,        // Show but prevent actions
};
```

### Error Communication

- Clear error messages
- Specific guidance ("Requires admin privileges")
- Non-blocking UI (errors in footer, not modal)
