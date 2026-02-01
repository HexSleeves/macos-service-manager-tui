# TODO - macOS Service Manager TUI

## High Priority

### Core Functionality
- [ ] **Test on actual macOS** - Verify launchctl parsing works with real output
- [ ] **Handle `launchctl print` variations** - Different macOS versions have different output formats
- [ ] **Implement proper sudo handling** - Currently just prefixes command, need proper PTY/password handling
- [ ] **Add service plist reading** - Parse plist files for additional metadata (Program, ProgramArguments, etc.)
- [ ] **Implement real-time status updates** - Poll for PID/status changes periodically

### Error Handling
- [x] **Better error parsing** - Extract meaningful messages from launchctl stderr
- [x] **Timeout handling** - Add timeouts for launchctl commands that hang
- [ ] **Retry logic** - Automatic retry for transient failures
- [ ] **Offline mode** - Graceful degradation when commands fail

### Security
- [ ] **Audit sudo usage** - Ensure we only use sudo when absolutely necessary
- [x] **Validate service labels** - Prevent command injection via malicious labels
- [ ] **Add dry-run mode** - Show what would be executed without doing it

## Medium Priority

### UI Improvements
- [x] **Add loading spinners** - Visual feedback during long operations (executing overlay)
- [x] **Implement toast notifications** - Better action result feedback (footer status)
- [ ] **Add service log viewer** - Show recent logs from `log show --predicate`
- [ ] **Responsive column widths** - Adjust list columns based on terminal width
- [ ] **Add mouse support** - Click to select, scroll wheel
- [ ] **Implement fuzzy search** - Better search matching (fzf-style)
- [ ] **Add color themes** - Light/dark mode, customizable colors
- [ ] **Truncate long labels** - With ellipsis and full label on hover/details

### Features
- [ ] **Service dependencies** - Show what depends on a service
- [ ] **Batch operations** - Select multiple services, perform action on all
- [ ] **Service templates** - Quick-create new LaunchAgent plists
- [ ] **Export/import** - Backup and restore service configurations
- [ ] **Service diff** - Compare plist before/after changes
- [ ] **History** - Track actions performed with timestamps
- [ ] **Favorites/bookmarks** - Pin frequently managed services
- [ ] **Service groups** - Organize services into custom categories

### Information Display
- [ ] **Show KeepAlive settings** - Important for understanding restart behavior
- [ ] **Show RunAtLoad** - Whether service starts at boot
- [ ] **Show socket/port info** - For network services
- [ ] **Show resource limits** - SoftResourceLimits, HardResourceLimits
- [ ] **Show environment variables** - EnvironmentVariables from plist
- [ ] **Show working directory** - WorkingDirectory from plist
- [ ] **CPU/Memory usage** - Integrate with `ps` for running services

## Low Priority

### Polish
- [ ] **Add animations** - Smooth transitions for panel changes
- [ ] **Keyboard shortcut customization** - User-configurable keybindings
- [ ] **Persistent settings** - Save filter/sort preferences
- [ ] **Command palette** - Ctrl+P style command search
- [ ] **Breadcrumbs** - Show current filter state visually

### Documentation
- [ ] **Add screenshots** - Visual documentation in README
- [ ] **Video demo** - Asciinema recording of usage
- [ ] **Troubleshooting guide** - Common issues and solutions
- [ ] **Contributing guide** - How to add features, code style
- [ ] **API documentation** - JSDoc comments for all functions

### Testing
- [ ] **Unit tests** - Test parsing functions with sample outputs
- [ ] **Snapshot tests** - Test UI component rendering
- [ ] **Integration tests** - Test full workflows with mock data
- [ ] **E2E tests** - Test actual launchctl interactions (macOS CI)
- [ ] **Performance benchmarks** - Measure startup time, render performance

### Build & Distribution
- [ ] **Create standalone binary** - Bundle with bun for single-file distribution
- [ ] **Homebrew formula** - `brew install macos-service-manager`
- [ ] **GitHub releases** - Automated release builds
- [ ] **Version checking** - Notify user of updates
- [ ] **Auto-update** - Optional self-update mechanism

### Platform
- [ ] **Minimum macOS version detection** - Warn if unsupported
- [ ] **Apple Silicon optimization** - Ensure native arm64 performance
- [ ] **Rosetta detection** - Warn if running under translation

## Technical Debt

### Code Quality
- [ ] **Split large components** - ServiceList and ServiceDetails are getting big
- [ ] **Extract keyboard handling** - Create reusable keyboard navigation hook
- [ ] **Add proper TypeScript strict mode** - Fix any remaining `any` types
- [ ] **Implement proper error boundaries** - Graceful UI error handling
- [ ] **Add logging** - Debug logging with configurable verbosity

### Performance
- [x] **Virtualize service list** - Only render visible rows for large lists
- [ ] **Memoize filtered/sorted results** - Prevent unnecessary recalculations
- [ ] **Debounce search input** - Don't filter on every keystroke
- [ ] **Lazy load service details** - Fetch full info only when selected

### Architecture
- [ ] **Consider state machine** - XState for complex UI states
- [ ] **Add event emitter** - Decouple components from direct state access
- [ ] **Plugin system** - Allow custom service type handlers
- [ ] **Configuration file** - Support ~/.config/macos-service-manager/config.json

## Known Issues

- [ ] **Search doesn't clear on filter change** - Should optionally reset
- [x] **Selected index can exceed list length** - After filtering (bounded in reducer + provider)
- [x] **System extensions show action buttons** - Should be hidden entirely (already fixed)
- [x] **No indication of pending operations** - Actions appear instant (executing overlay added)
- [x] **Help panel doesn't scroll** - Clips on small terminals (adaptive sizing + compact mode)
- [x] **Filter bar takes too much space** - Consider collapsible or minimal mode (already collapsible with 'f')

## Ideas for Future

- [ ] **Web UI mode** - Serve TUI over HTTP for remote management
- [ ] **REST API** - Programmatic access to service management
- [ ] **Multi-machine** - SSH to manage services on remote Macs
- [ ] **Notifications** - Alert when watched services change state
- [ ] **Scheduling** - Schedule service start/stop at specific times
- [ ] **Profiles** - Different service configurations for work/home/etc
- [ ] **AI assistant** - Natural language service management

## Completed

- [x] Basic service listing
- [x] Service details panel
- [x] Keyboard navigation
- [x] Search filtering
- [x] Type/domain/status filters
- [x] Sort options
- [x] Action buttons (start/stop/reload/enable/disable/unload)
- [x] Confirmation dialogs (centered)
- [x] Help panel (centered)
- [x] Status indicators
- [x] Protection detection (SIP, system-owned, immutable)
- [x] Mock data for non-macOS development
- [x] React Context state management
- [x] launchctl command execution (using `launchctl list`)
- [x] systemextensionsctl parsing
- [x] Dynamic list height based on terminal size
- [x] Virtual scrolling for service list
- [x] Hide Apple/macOS services by default (toggle with 'a')
- [x] Biome linting and formatting
- [x] TypeScript strict type checking
