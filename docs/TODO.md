# TODO - macOS Service Manager TUI

## High Priority (Most Important)

| Task | Description | Status |
|------|-------------|--------|
| Test on actual macOS | Verify launchctl parsing works with real output | ⬚ |
| Handle launchctl print variations | Different macOS versions have different output formats | ⬚ |
| Implement proper sudo handling | Currently just prefixes command, need proper PTY/password handling | ⬚ |
| Add service plist reading | Parse plist files for additional metadata | ⬚ |
| Implement real-time status updates | Poll for PID/status changes periodically | ⬚ |
| Retry logic | Automatic retry for transient failures | ⬚ |
| Offline mode | Graceful degradation when commands fail | ⬚ |
| Audit sudo usage | Ensure we only use sudo when absolutely necessary | ⬚ |
| Add dry-run mode | Show what would be executed without doing it | ⬚ |

## Medium Priority (Nice to Have)

### UI Improvements
| Task | Description | Status |
|------|-------------|--------|
| Service log viewer | Show recent logs from `log show --predicate` | ⬚ |
| Responsive column widths | Adjust list columns based on terminal width | ⬚ |
| Mouse support | Click to select, scroll wheel | ⬚ |
| Fuzzy search | Better search matching (fzf-style) | ⬚ |
| Color themes | Light/dark mode, customizable colors | ⬚ |
| Truncate long labels | With ellipsis and full label on hover/details | ⬚ |

### Features
| Task | Description | Status |
|------|-------------|--------|
| Service dependencies | Show what depends on a service | ⬚ |
| Batch operations | Select multiple services, perform action on all | ⬚ |
| Service templates | Quick-create new LaunchAgent plists | ⬚ |
| Export/import | Backup and restore service configurations | ⬚ |
| Service diff | Compare plist before/after changes | ⬚ |
| History | Track actions performed with timestamps | ⬚ |
| Favorites/bookmarks | Pin frequently managed services | ⬚ |
| Service groups | Organize services into custom categories | ⬚ |

### Information Display
| Task | Description | Status |
|------|-------------|--------|
| Show KeepAlive settings | Important for understanding restart behavior | ⬚ |
| Show RunAtLoad | Whether service starts at boot | ⬚ |
| Show socket/port info | For network services | ⬚ |
| Show resource limits | SoftResourceLimits, HardResourceLimits | ⬚ |
| Show environment variables | EnvironmentVariables from plist | ⬚ |
| Show working directory | WorkingDirectory from plist | ⬚ |
| CPU/Memory usage | Integrate with `ps` for running services | ⬚ |

## Low Priority (Polish)

### Polish
| Task | Description | Status |
|------|-------------|--------|
| Animations | Smooth transitions for panel changes | ⬚ |
| Keyboard shortcut customization | User-configurable keybindings | ⬚ |
| Persistent settings | Save filter/sort preferences | ⬚ |
| Command palette | Ctrl+P style command search | ⬚ |
| Breadcrumbs | Show current filter state visually | ⬚ |

### Documentation
| Task | Description | Status |
|------|-------------|--------|
| Screenshots | Visual documentation in README | ⬚ |
| Video demo | Asciinema recording of usage | ⬚ |
| Troubleshooting guide | Common issues and solutions | ⬚ |
| Contributing guide | How to add features, code style | ⬚ |
| API documentation | JSDoc comments for all functions | ⬚ |

### Testing
| Task | Description | Status |
|------|-------------|--------|
| Unit tests | Test parsing functions with sample outputs | ⬚ |
| Snapshot tests | Test UI component rendering | ⬚ |
| Integration tests | Test full workflows with mock data | ⬚ |
| E2E tests | Test actual launchctl interactions (macOS CI) | ⬚ |
| Performance benchmarks | Measure startup time, render performance | ⬚ |

### Build & Distribution
| Task | Description | Status |
|------|-------------|--------|
| Standalone binary | Bundle with bun for single-file distribution | ⬚ |
| Homebrew formula | `brew install macos-service-manager` | ⬚ |
| GitHub releases | Automated release builds | ⬚ |
| Version checking | Notify user of updates | ⬚ |
| Auto-update | Optional self-update mechanism | ⬚ |

### Platform
| Task | Description | Status |
|------|-------------|--------|
| Minimum macOS version detection | Warn if unsupported | ⬚ |
| Apple Silicon optimization | Ensure native arm64 performance | ⬚ |
| Rosetta detection | Warn if running under translation | ⬚ |

## Technical Debt

### Code Quality
| Task | Description | Status |
|------|-------------|--------|
| Split large components | ServiceList and ServiceDetails are getting big | ⬚ |
| Extract keyboard handling | Create reusable keyboard navigation hook | ⬚ |
| TypeScript strict mode | Fix any remaining `any` types | ⬚ |
| Error boundaries | Graceful UI error handling | ⬚ |
| Logging | Debug logging with configurable verbosity | ⬚ |

### Performance
| Task | Description | Status |
|------|-------------|--------|
| Memoize filtered/sorted results | Prevent unnecessary recalculations | ⬚ |
| Debounce search input | Don't filter on every keystroke | ⬚ |
| Lazy load service details | Fetch full info only when selected | ⬚ |

### Architecture
| Task | Description | Status |
|------|-------------|--------|
| State machine | XState for complex UI states | ⬚ |
| Event emitter | Decouple components from direct state access | ⬚ |
| Plugin system | Allow custom service type handlers | ⬚ |
| Configuration file | Support ~/.config/macos-service-manager/config.json | ⬚ |

## Known Issues

| Issue | Description | Status |
|-------|-------------|--------|
| Search doesn't clear on filter change | Should optionally reset | ⬚ |

## Ideas for Future

| Idea | Description |
|------|-------------|
| Web UI mode | Serve TUI over HTTP for remote management |
| REST API | Programmatic access to service management |
| Multi-machine | SSH to manage services on remote Macs |
| Notifications | Alert when watched services change state |
| Scheduling | Schedule service start/stop at specific times |
| Profiles | Different service configurations for work/home/etc |
| AI assistant | Natural language service management |

## Completed ✓

| Task | Description |
|------|-------------|
| ✓ Basic service listing | List all services from launchctl |
| ✓ Service details panel | Show detailed info for selected service |
| ✓ Keyboard navigation | vim-style j/k navigation |
| ✓ Search filtering | Filter services by label |
| ✓ Type/domain/status filters | Filter by service type, domain, status |
| ✓ Sort options | Sort by label, status, type, domain, PID |
| ✓ Action buttons | start/stop/reload/enable/disable/unload |
| ✓ Confirmation dialogs | Centered confirmation for destructive actions |
| ✓ Help panel | Centered help with keyboard shortcuts |
| ✓ Status indicators | Visual indicators for service status |
| ✓ Protection detection | SIP, system-owned, immutable detection |
| ✓ Mock data | For non-macOS development |
| ✓ React Context state | useReducer-based state management |
| ✓ launchctl execution | Using `launchctl list` |
| ✓ systemextensionsctl parsing | Parse system extensions |
| ✓ Dynamic list height | Based on terminal size |
| ✓ Virtual scrolling | Only render visible rows |
| ✓ Hide Apple services | Toggle with 'a' key |
| ✓ Biome linting | Linting and formatting |
| ✓ TypeScript strict | Type checking enabled |
| ✓ Better error parsing | User-friendly error messages |
| ✓ Timeout handling | 30s timeout for commands |
| ✓ Input validation | Prevent command injection |
| ✓ Loading spinners | Executing overlay |
| ✓ Toast notifications | Footer status messages |
| ✓ Adaptive help panel | Compact mode for small terminals |
| ✓ Collapsible filter bar | Toggle with 'f' key |
| ✓ Ghost row fix | Fixed rendering artifacts |
| ✓ Filter bar height fix | Proper scroll calculation |
