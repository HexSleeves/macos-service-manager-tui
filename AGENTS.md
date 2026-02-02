# Repository Guidelines

## Project Structure

```bash
src/
├── index.tsx                 # Main entry point
├── types/index.ts            # TypeScript type definitions
├── hooks/useAppState.tsx     # React Context + useReducer state
├── components/               # UI components (OpenTUI/React)
│   ├── ServiceList.tsx       # Main list with virtual scrolling
│   ├── ServiceDetails.tsx    # Selected service info panel
│   └── ...                   # Header, Footer, FilterBar, etc.
├── services/                 # Business logic
│   ├── index.ts              # Unified service API
│   ├── launchctl/            # launchctl module (split into 8 files)
│   ├── systemextensions.ts   # System extensions parsing
│   ├── plist.ts              # Plist file parsing
│   └── mock.ts               # Mock data for non-macOS dev
└── utils/                    # Utilities (retry, fuzzy search)
```

## Build & Development Commands

```bash
export PATH="$HOME/.bun/bin:$PATH"  # Ensure bun is in PATH

bun install          # Install dependencies
bun run dev          # Run with hot reload (--watch)
bun run typecheck    # TypeScript type checking
bun run check        # Biome lint + format (with --write)
bun test             # Run all tests
```

## Coding Style

- **Formatter/Linter**: Biome (configured in `biome.json`)
- **Indentation**: Tabs
- **Naming**: camelCase for functions/variables, PascalCase for components/types
- **Imports**: Use relative paths within src/
- **React**: Functional components with hooks only

Run `bun run check` before committing to auto-fix formatting.

## Testing Guidelines

- **Framework**: Bun's built-in test runner (`bun:test`)
- **Location**: `__tests__/` directories next to source files
- **Naming**: `*.test.ts` files
- **Run**: `bun test` or `bun test src/path/to/file.test.ts`

Current tests cover launchctl parsing and fuzzy search. Add tests for new parsing logic.

## Commit Conventions

Follow conventional commits:

- `feat:` - New features
- `fix:` - Bug fixes
- `refactor:` - Code restructuring
- `docs:` - Documentation changes
- `test:` - Test additions/changes

Examples from history:

- `feat: implement real-time status updates with auto-refresh polling`
- `fix: ghost rows when toggling filters rapidly`
- `refactor: split launchctl.ts into modular structure`

## Architecture Notes

- **Virtual Scrolling**: ServiceList uses position-based keys (`key={row-${i}}`), not service IDs. This is intentional for TUI rendering.
- **State Management**: Single `useAppState` hook provides context. Actions dispatched via reducer.
- **macOS Detection**: Falls back to mock data on non-macOS systems.
- **OpenTUI**: Uses `<box>`, `<text>`, `<span>` components. No `<scrollbox>` (rendering issues).

## Agent Instructions

When making changes:

1. Run `bun run typecheck` and `bun test` before committing
2. Run `bun run check` to fix lint/format issues
3. Test UI changes by running `bun run dev` (uses mock data on non-macOS)
4. For virtual scrolling changes, test with rapid filter toggling
5. Keep files under 500 lines; split if larger
