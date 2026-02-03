# Feature: Open Plist in Editor

## Overview

Allow users to open a service's plist file in their preferred editor directly from the TUI.

## User Flow

1. User selects a service that has a plist file
2. User presses `e` to edit
3. TUI suspends, editor opens with the plist file
4. User edits/views the file, closes editor
5. TUI resumes automatically

## Editor Selection Priority

```
$EDITOR → $VISUAL → nano → vim → vi → open -t (TextEdit on macOS)
```

## Implementation Plan

### Phase 1: Editor Utilities

**Create `src/utils/editor.ts`:**

```typescript
/**
 * Editor utilities for opening files in external editors
 */

import { spawn } from "bun";

/**
 * Get the user's preferred editor
 * Priority: $EDITOR → $VISUAL → nano → vim → vi → open -t
 */
export function getPreferredEditor(): string {
  const editor = process.env.EDITOR || process.env.VISUAL;
  if (editor) return editor;
  
  // Check if common editors exist
  // For simplicity, default to nano which is available on macOS
  return "nano";
}

/**
 * Check if a file requires root to edit
 */
export function requiresRootToEdit(filePath: string): boolean {
  if (filePath.startsWith("/System/")) return true;
  if (filePath.startsWith("/Library/")) return true;
  return false;
}

/**
 * Open a file in the preferred editor
 * Returns a promise that resolves when the editor closes
 * 
 * @param filePath - Path to the file to edit
 * @param useRoot - Whether to use sudo
 * @param onSuspend - Callback before editor opens (to suspend TUI)
 * @param onResume - Callback after editor closes (to resume TUI)
 */
export async function openInEditor(
  filePath: string,
  options: {
    useRoot?: boolean;
    onSuspend?: () => void;
    onResume?: () => void;
  } = {}
): Promise<{ success: boolean; error?: string }> {
  const { useRoot = false, onSuspend, onResume } = options;
  
  const editor = getPreferredEditor();
  
  // Build command
  const command = useRoot 
    ? ["sudo", editor, filePath]
    : [editor, filePath];
  
  try {
    // Suspend TUI before spawning editor
    onSuspend?.();
    
    // Spawn editor with inherited stdio (takes over terminal)
    const proc = spawn(command, {
      stdin: "inherit",
      stdout: "inherit", 
      stderr: "inherit",
    });
    
    // Wait for editor to close
    const exitCode = await proc.exited;
    
    // Resume TUI
    onResume?.();
    
    return {
      success: exitCode === 0,
      error: exitCode !== 0 ? `Editor exited with code ${exitCode}` : undefined,
    };
  } catch (error) {
    onResume?.();
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to open editor",
    };
  }
}
```

### Phase 2: TUI Suspend/Resume

**Approach:** Use OpenTUI's renderer to handle suspension.

The key insight is that when we spawn the editor with `stdio: "inherit"`, the editor takes over the terminal. We need to:

1. Tell OpenTUI to stop rendering
2. Restore terminal to normal mode
3. Spawn editor
4. Wait for editor to exit
5. Re-initialize OpenTUI rendering

**Option A - Simple Destroy/Recreate:**
```typescript
// In keyboard handler
if (key.name === "e" && selectedService?.plistPath) {
  renderer.destroy(); // Stop TUI
  
  await openInEditor(selectedService.plistPath, {
    useRoot: selectedService.requiresRoot,
  });
  
  // Re-render will happen automatically since React state persists
  // But we may need to trigger a re-render
}
```

**Option B - Pause/Resume (if OpenTUI supports it):**
```typescript
renderer.pause();
await openInEditor(...);
renderer.resume();
```

Need to check OpenTUI docs/source for pause/resume support.

### Phase 3: Store Integration

**Update `src/store/useAppStore.ts`:**

Add action:
```typescript
openPlistInEditor: async (service: Service) => {
  if (!service.plistPath) {
    set({
      lastActionResult: {
        success: false,
        message: "No plist file for this service",
      },
    });
    return;
  }
  
  // Check if file exists
  const exists = await Bun.file(service.plistPath).exists();
  if (!exists) {
    set({
      lastActionResult: {
        success: false,
        message: `Plist file not found: ${service.plistPath}`,
      },
    });
    return;
  }
  
  // The actual editor opening will be handled by the component
  // since it needs access to the renderer
  return { plistPath: service.plistPath, requiresRoot: service.requiresRoot };
}
```

### Phase 4: Keyboard Handler

**Update `src/hooks/useKeyboardShortcuts.tsx`:**

```typescript
// In the service actions section
if (key.name === "e") {
  if (!selectedService?.plistPath) {
    store.setActionResult({
      success: false,
      message: "No plist file for this service",
    });
    return;
  }
  
  // Suspend TUI and open editor
  renderer.destroy();
  
  const result = await openInEditor(selectedService.plistPath, {
    useRoot: requiresRootToEdit(selectedService.plistPath),
  });
  
  // TUI will need to be re-initialized
  // This might require restructuring the app entry point
  return;
}
```

### Phase 5: UI Updates

**Update `src/components/ServiceDetails.tsx`:**

Add edit button (only if plist path exists):
```typescript
{service.plistPath && (
  <ActionButton
    label="Edit plist"
    shortcut="e"
    disabled={false}
  />
)}
```

**Update `src/components/HelpPanel.tsx`:**

Add to Actions section:
```typescript
{ key: "e", description: "Edit plist file" },
```

### Phase 6: App Entry Point Changes

**Update `src/index.tsx`:**

The tricky part is handling the renderer lifecycle. Options:

**Option A - Wrap in restart-capable structure:**
```typescript
async function main() {
  let shouldRestart = true;
  
  while (shouldRestart) {
    shouldRestart = false;
    const renderer = await createCliRenderer({ exitOnCtrlC: false });
    
    // Pass a restart function to the app
    const requestRestart = () => { shouldRestart = true; };
    
    createRoot(renderer).render(<App onRequestRestart={requestRestart} />);
    
    // Wait for renderer to be destroyed
    await renderer.waitForExit(); // If this exists
  }
}
```

**Option B - Use global state for editor opening:**
```typescript
// Store editor request in global/store
// Have a useEffect that watches for it and handles outside React
```

## Files to Create/Modify

| File | Action | Description |
|------|--------|-------------|
| `src/utils/editor.ts` | Create | Editor utilities |
| `src/store/useAppStore.ts` | Modify | Add editor-related state |
| `src/hooks/useKeyboardShortcuts.tsx` | Modify | Add `e` key handler |
| `src/components/ServiceDetails.tsx` | Modify | Add Edit button |
| `src/components/HelpPanel.tsx` | Modify | Add shortcut docs |
| `src/index.tsx` | Modify | Handle TUI restart |

## Edge Cases

1. **No plist path**: Show error message
2. **File doesn't exist**: Show error message  
3. **Permission denied**: Use sudo if needed, or show error
4. **Editor not found**: Fall back to next option or show error
5. **User cancels sudo**: Handle gracefully
6. **System Extensions**: No plist file - disable edit option

## Testing

1. Test with $EDITOR set to various editors (vim, nano, code)
2. Test with $EDITOR unset (should use default)
3. Test editing user LaunchAgent (no sudo)
4. Test editing system LaunchDaemon (needs sudo)
5. Test with non-existent plist path
6. Test with System Extension (no plist)

## Estimated Effort

| Phase | Time |
|-------|------|
| Phase 1: Editor utilities | 30 min |
| Phase 2: TUI suspend/resume | 1-2 hrs |
| Phase 3: Store integration | 30 min |
| Phase 4: Keyboard handler | 30 min |
| Phase 5: UI updates | 15 min |
| Phase 6: App restructure | 1 hr |
| Testing & polish | 30 min |
| **Total** | **4-5 hrs** |

## Open Questions

1. Does OpenTUI have a pause/resume API? Need to check.
2. Should we refresh service list after editing plist? (User might have changed settings)
3. Should we support opening in GUI editor (like `open -a "Visual Studio Code"`)?
