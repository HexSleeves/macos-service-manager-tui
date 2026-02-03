# macOS Service Manager TUI

A **Terminal User Interface (TUI)** for inspecting and managing macOS system services, including LaunchDaemons, LaunchAgents, and System Extensions.

Built with [OpenTUI](https://github.com/anomalyco/opentui) and React.

![macOS Service Manager Screenshot](docs/screenshot.png)

## Features

### Service Discovery

- List all LaunchDaemons, LaunchAgents, and System Extensions
- Clear distinction between:
  - User-level vs system-level services
  - Loaded vs unloaded services
  - Enabled vs disabled services
- Service metadata display:
  - Label
  - PID (if running)
  - Status
  - Domain (user/system)
  - Exit status
  - Plist path

### Service Management

- **Start** stopped services
- **Stop** running services
- **Enable/Disable** services
- **Reload** services
- **Unload** services
- Clear indication when:
  - Root privileges are required
  - Services are protected by SIP
- Graceful handling of restricted or immutable services

### UI/UX Features

- Fully keyboard-driven navigation
- Real-time search filtering
- Multiple filter options:
  - By type (Daemon/Agent/Extension)
  - By domain (System/User)
  - By status (Running/Stopped/Error)
  - Show/hide Apple services
  - Show/hide protected services
- Sort by label, status, type, domain, or PID
- Visual indicators for:
  - Running (● green)
  - Stopped (○ gray)
  - Disabled (◌ yellow)
  - Error (✕ red)
  - Protected (🔒 SIP, 🛡 immutable, ⚙ system-owned)
- Confirmation prompts for destructive actions
- Help panel with keyboard shortcuts

## Installation

### Prerequisites

- [Bun](https://bun.sh/) runtime (v1.0 or later)
- macOS 11+ (Big Sur or later)

### Setup

```bash
# Clone the repository
git clone https://github.com/yourusername/macos-service-manager
cd macos-service-manager

# Install dependencies
bun install

# Run the application
bun run src/index.tsx
```

## Usage

### Keyboard Shortcuts

#### Navigation

| Key | Action |
| --- | ------ |
| `↑` / `k` | Move selection up |
| `↓` / `j` | Move selection down |
| `g` | Go to first service |
| `G` | Go to last service |
| `PgUp/PgDn` | Page up/down |
| `Tab` | Switch panel focus |

#### Search & Filter

| Key | Action |
| --- | ------ |
| `/` | Focus search |
| `Esc` | Clear search / Cancel |
| `f` | Toggle filter panel |
| `1-4` | Filter by type (All/Daemon/Agent/Extension) |
| `a` | Toggle Apple services visibility |
| `p` | Toggle protected services visibility |

#### Sorting

| Key | Action |
| --- | ------ |
| `s` | Cycle sort field |
| `S` | Toggle sort direction |

#### Service Actions

| Key | Action |
| --- | ------ |
| `Enter` | Start service (if stopped) |
| `x` | Stop service |
| `r` | Reload service |
| `d` | Toggle enable/disable |
| `u` | Unload service |

#### General

| Key | Action |
| --- | ------ |
| `R` | Refresh service list |
| `?` | Toggle help panel |
| `q` / `Ctrl+C` | Quit |

## Architecture

```bash
src/
├── index.tsx           # Main app entry point
├── types/
│   └── index.ts        # TypeScript type definitions
├── services/
│   ├── index.ts        # Unified service discovery
│   ├── launchctl.ts    # launchctl command parsing
│   ├── systemextensions.ts # systemextensionsctl parsing
│   └── mock.ts         # Mock data for development
├── hooks/
│   └── useAppState.tsx # Application state management
└── components/
    ├── index.ts        # Component exports
    ├── Header.tsx      # App header
    ├── Footer.tsx      # Status bar & shortcuts
    ├── ServiceList.tsx # Main service list
    ├── ServiceDetails.tsx # Selected service details
    ├── FilterBar.tsx   # Filter controls
    ├── SearchBar.tsx   # Search input
    ├── ConfirmDialog.tsx # Action confirmation
    ├── HelpPanel.tsx   # Keyboard shortcuts
    └── StatusIndicator.tsx # Status icons
```

## Technical Details

### Command Execution

The app uses modern `launchctl` commands:

- `launchctl print <domain>` - List services
- `launchctl print <domain>/<label>` - Get service details
- `launchctl kickstart -k <target>` - Start service
- `launchctl kill SIGTERM <target>` - Stop service
- `launchctl enable <target>` - Enable service
- `launchctl disable <target>` - Disable service
- `launchctl bootout <target>` - Unload service

For system extensions:

- `systemextensionsctl list` - List all extensions

### Security Considerations

1. **System Integrity Protection (SIP)**
   - Services in `/System/Library/` are protected
   - The app clearly indicates SIP-protected services
   - Actions on protected services are blocked

2. **Root Privileges**
   - System services require `sudo`
   - The app indicates when root is required
   - Uses `sudo` prefix when necessary

3. **Immutable Services**
   - Critical system services cannot be modified
   - Examples: `com.apple.launchd`, `com.apple.SystemConfiguration`

### Known Limitations

1. System Extensions cannot be started/stopped directly
   - They must be managed through System Preferences or their parent app

2. Some services may require:
   - Full Disk Access (for reading certain plist files)
   - Administrator privileges

3. Actions may fail silently if:
   - The user cancels `sudo` authentication
   - The service is in an invalid state

## Development

### Running in Development Mode

```bash
bun run dev
```

This runs with `--watch` for hot reloading.

### Running on Non-macOS Systems

On non-macOS systems, the app uses mock data for demonstration purposes.

### Building

```bash
bun build src/index.tsx --outdir dist --target bun
```

## License

MIT

## Acknowledgments

- [OpenTUI](https://github.com/anomalyco/opentui) - Terminal UI framework
- [rakhesh.com](https://rakhesh.com/mac/macos-launchctl-commands/) - launchctl reference
- Apple Developer Documentation
