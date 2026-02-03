# Sudo/PTY Handling Research & Implementation Plan

## Problem Statement

The current implementation prepends `sudo` to commands requiring root privileges, but this doesn't work in the TUI because:
1. The password prompt doesn't display properly (no TTY allocation)
2. There's no way to input the password
3. Bun's `spawn()` with piped stdout/stderr doesn't provide a pseudo-terminal

## Current Code Flow

1. `permissions.ts`: `requiresRoot()` determines if a service needs root based on domain/plist path
2. `permissions.ts`: `shouldUseSudo()` returns true if root needed and not already root
3. `index.ts`: `executeServiceAction()` prepends `sudo` to the command array
4. `exec.ts`: `execCommand()` spawns the process with piped I/O (no TTY)

## Researched Options

### Option 1: node-pty

**Description**: Use a PTY library to create a pseudo-terminal for proper TTY allocation.

**Pros**:
- Full PTY support, real terminal interaction
- Would work with any command that needs TTY

**Cons**:
- Native dependency requiring compilation for each platform
- Complex integration with @opentui's existing terminal handling
- May conflict with the TUI's own terminal control
- Overkill for just password prompts
- Bun compatibility uncertain

**Verdict**: ❌ Not recommended - too complex, conflicts with TUI architecture

---

### Option 2: osascript with Administrator Privileges (macOS native)

**Description**: Use AppleScript to invoke commands with admin privileges, which shows a native macOS authentication dialog.

```bash
osascript -e 'do shell script "launchctl kickstart -k system/com.example" with administrator privileges'
```

**Pros**:
- Native macOS approach with proper security dialog
- Handles password securely (never touches the app)
- No additional dependencies
- Works in terminal context (shows GUI dialog)
- User-familiar authentication experience

**Cons**:
- macOS-specific (but this is a macOS service manager)
- Requires GUI context (won't work over SSH without X11 forwarding)
- Might be jarring to have GUI dialog from terminal app
- Need to properly escape commands

**Verdict**: ✅ Good option for GUI context

---

### Option 3: TUI Password Input with sudo -S

**Description**: Implement a password input in the TUI and use `sudo -S` which reads password from stdin.

```bash
echo "password" | sudo -S launchctl kickstart -k system/com.example
```

**Pros**:
- Works in any terminal context including SSH
- Keeps everything within the TUI
- No additional dependencies (use existing `<input>` component)
- Consistent UX

**Cons**:
- Need to implement secure password handling
- Password passes through the process (briefly in memory)
- `sudo -S` has some security considerations
- Need to handle password masking in the input

**Verdict**: ✅ Good fallback option for headless/SSH context

---

### Option 4: Check Sudo Cache First

**Description**: Use `sudo -n -v` to check if sudo credentials are cached.

```bash
sudo -n -v  # Exit 0 = cached, non-zero = needs password
```

**Pros**:
- Zero-friction when sudo is already authenticated
- Can be combined with other options as a first check

**Cons**:
- Only helps when user has recently authenticated
- Still needs fallback for when not cached

**Verdict**: ✅ Should be used as the first step in any approach

---

## Recommended Approach: Hybrid Strategy

### Flow Diagram

```
Action requires root?
        │
        ▼
   [Check sudo cache: sudo -n -v]
        │
    ┌───┴───┐
    │       │
Cached    Not Cached
    │       │
    ▼       ▼
Use sudo   [Check context]
            │
      ┌─────┴─────┐
      │           │
   GUI ctx    SSH/Headless
      │           │
      ▼           ▼
osascript    TUI password
w/ admin     input + sudo -S
```

### Implementation Steps

#### Phase 1: Core Infrastructure

**1.1 Create `src/services/launchctl/sudo.ts`**

```typescript
/**
 * Sudo and privilege escalation utilities
 */

import { spawn } from "bun";

/** Result of a privileged command execution */
export interface PrivilegedResult {
  stdout: string;
  stderr: string;
  exitCode: number;
  authCancelled?: boolean;  // User cancelled auth dialog
  authFailed?: boolean;     // Wrong password
}

/**
 * Check if sudo credentials are currently cached
 */
export async function isSudoCached(): Promise<boolean> {
  const proc = spawn(["sudo", "-n", "-v"], {
    stdout: "pipe",
    stderr: "pipe",
  });
  const exitCode = await proc.exited;
  return exitCode === 0;
}

/**
 * Detect if running in a GUI context (vs SSH/headless)
 */
export function isGuiContext(): boolean {
  // SSH session indicators
  if (process.env.SSH_CONNECTION || process.env.SSH_TTY) {
    return false;
  }
  // Has a terminal program (likely GUI terminal)
  if (process.env.TERM_PROGRAM) {
    return true;
  }
  // Default to GUI on macOS when not SSH
  return true;
}

/**
 * Execute command with osascript admin privileges (GUI context)
 */
export async function execWithOsascript(
  command: string,
  args: string[]
): Promise<PrivilegedResult> {
  // Build the command string, properly escaped
  const fullCommand = [command, ...args]
    .map(arg => arg.includes(" ") ? `"${arg}"` : arg)
    .join(" ");
  
  // Use osascript with administrator privileges
  const script = `do shell script "${fullCommand.replace(/"/g, '\\"')}" with administrator privileges`;
  
  const proc = spawn(["osascript", "-e", script], {
    stdout: "pipe",
    stderr: "pipe",
  });
  
  const [stdout, stderr, exitCode] = await Promise.all([
    new Response(proc.stdout).text(),
    new Response(proc.stderr).text(),
    proc.exited,
  ]);
  
  // Check for user cancellation
  const authCancelled = stderr.includes("User canceled") || 
                        stderr.includes("user canceled");
  
  return {
    stdout,
    stderr,
    exitCode,
    authCancelled,
    authFailed: exitCode !== 0 && !authCancelled,
  };
}

/**
 * Execute command with sudo -S (reads password from stdin)
 */
export async function execWithSudoStdin(
  command: string,
  args: string[],
  password: string
): Promise<PrivilegedResult> {
  const proc = spawn(["sudo", "-S", command, ...args], {
    stdin: "pipe",
    stdout: "pipe",
    stderr: "pipe",
  });
  
  // Write password to stdin
  const writer = proc.stdin.getWriter();
  await writer.write(new TextEncoder().encode(password + "\n"));
  await writer.close();
  
  const [stdout, stderr, exitCode] = await Promise.all([
    new Response(proc.stdout).text(),
    new Response(proc.stderr).text(),
    proc.exited,
  ]);
  
  // Check for auth failure
  const authFailed = stderr.includes("Sorry, try again") ||
                     stderr.includes("incorrect password");
  
  return {
    stdout,
    stderr: stderr.replace(/^\[sudo\].*\n?/gm, ""), // Strip sudo prompts
    exitCode,
    authFailed,
  };
}
```

#### Phase 2: UI Components

**2.1 Create `src/components/PasswordDialog.tsx`**

```typescript
/**
 * Password Input Dialog for sudo authentication
 * Used when running in SSH/headless context
 */

import { useState } from "react";

interface PasswordDialogProps {
  visible: boolean;
  serviceName: string;
  action: string;
  onSubmit: (password: string) => void;
  onCancel: () => void;
  error?: string;
}

export function PasswordDialog({
  visible,
  serviceName,
  action,
  onSubmit,
  onCancel,
  error,
}: PasswordDialogProps) {
  const [password, setPassword] = useState("");

  if (!visible) return null;

  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === "Enter" && password) {
      onSubmit(password);
      setPassword("");
    } else if (e.key === "Escape") {
      onCancel();
      setPassword("");
    }
  };

  return (
    <box
      position="absolute"
      left={0}
      top={0}
      right={0}
      bottom={0}
      justifyContent="center"
      alignItems="center"
    >
      <box
        width={60}
        border
        borderColor="#f59e0b"
        backgroundColor="#1f2937"
        padding={2}
        flexDirection="column"
        gap={1}
      >
        <text fg="#f59e0b">
          <strong>🔐 Administrator Password Required</strong>
        </text>

        <box marginTop={1}>
          <text fg="#e5e7eb">
            Enter password to {action}:
          </text>
        </box>

        <box marginTop={1} padding={1} backgroundColor="#111827">
          <text fg="#9ca3af">{serviceName}</text>
        </box>

        {error && (
          <box marginTop={1}>
            <text fg="#ef4444">⚠ {error}</text>
          </box>
        )}

        <box marginTop={1}>
          <text fg="#6b7280">Password: </text>
          <input
            value={"•".repeat(password.length)}
            onChange={setPassword}
            focused={true}
            width={30}
            backgroundColor="#374151"
            textColor="#e5e7eb"
            onKeyDown={handleKeyDown}
          />
        </box>

        <box flexDirection="row" gap={4} marginTop={2} justifyContent="center">
          <box backgroundColor="#22c55e" paddingLeft={2} paddingRight={2}>
            <text fg="#ffffff">[Enter] Submit</text>
          </box>
          <box backgroundColor="#374151" paddingLeft={2} paddingRight={2}>
            <text fg="#ffffff">[ESC] Cancel</text>
          </box>
        </box>
      </box>
    </box>
  );
}
```

**Note**: The `<input>` component may need investigation to support:
- Password masking (showing dots instead of characters)
- Proper onChange callback with actual characters (not masked)

#### Phase 3: Integration

**3.1 Update `src/services/launchctl/index.ts`**

Modify `executeServiceAction` to support different privilege escalation modes:

```typescript
export type PrivilegeMode = "none" | "sudo" | "osascript" | "sudo-stdin";

export interface ExecuteServiceActionOptions {
  dryRun?: boolean;
  privilegeMode?: PrivilegeMode;
  password?: string;  // For sudo-stdin mode
}

export async function executeServiceAction(
  action: ServiceAction,
  service: Service,
  options: ExecuteServiceActionOptions = {},
): Promise<DryRunResult> {
  const { dryRun = false, privilegeMode = "none", password } = options;
  
  // ... existing validation ...
  
  const needsRoot = shouldUseSudo(service.requiresRoot);
  
  if (!needsRoot || dryRun) {
    // Execute normally
    return execCommand(command[0], command.slice(1));
  }
  
  // Determine how to escalate
  const actualMode = privilegeMode !== "none" ? privilegeMode :
    await isSudoCached() ? "sudo" :
    isGuiContext() ? "osascript" : "sudo-stdin";
  
  switch (actualMode) {
    case "sudo":
      return execCommand("sudo", command);
      
    case "osascript":
      return execWithOsascript(command[0], command.slice(1));
      
    case "sudo-stdin":
      if (!password) {
        return {
          success: false,
          message: "Password required",
          error: "NEEDS_PASSWORD",
        };
      }
      return execWithSudoStdin(command[0], command.slice(1), password);
  }
}
```

**3.2 Update Store State**

Add to `AppState`:

```typescript
interface AppState {
  // ... existing ...
  
  // Password dialog state
  showPasswordDialog: boolean;
  passwordError: string | null;
  pendingPrivilegedAction: {
    action: ServiceAction;
    service: Service;
  } | null;
}
```

**3.3 Update Action Flow**

```typescript
// In useAppStore.ts
executeAction: async (action, service, options = {}) => {
  const needsRoot = shouldUseSudo(service.requiresRoot);
  
  if (needsRoot && !await isSudoCached() && !isGuiContext()) {
    // Need password input
    set({
      showPasswordDialog: true,
      pendingPrivilegedAction: { action, service },
      passwordError: null,
    });
    return { success: false, message: "Awaiting password" };
  }
  
  // ... proceed with execution ...
}

submitPassword: async (password: string) => {
  const { pendingPrivilegedAction } = get();
  if (!pendingPrivilegedAction) return;
  
  const result = await performServiceAction(
    pendingPrivilegedAction.action,
    pendingPrivilegedAction.service,
    { password }
  );
  
  if (result.error === "AUTH_FAILED") {
    set({ passwordError: "Incorrect password, try again" });
    return;
  }
  
  set({
    showPasswordDialog: false,
    pendingPrivilegedAction: null,
    passwordError: null,
  });
  
  // ... handle result ...
}
```

## Files to Create/Modify

### New Files
1. `src/services/launchctl/sudo.ts` - Privilege escalation utilities
2. `src/components/PasswordDialog.tsx` - Password input UI

### Modified Files
1. `src/services/launchctl/exec.ts` - Add privilege escalation support
2. `src/services/launchctl/index.ts` - Update `executeServiceAction`
3. `src/store/useAppStore.ts` - Add password dialog state and actions
4. `src/types/index.ts` - Add new types
5. `src/index.tsx` - Add `<PasswordDialog />` component
6. `src/hooks/useKeyboardShortcuts.tsx` - Handle password dialog keys

## Potential Issues & Mitigations

### 1. osascript in Certain Contexts
**Issue**: osascript may fail in some terminal environments.
**Mitigation**: Catch errors and fall back to password input.

### 2. Password Input Security
**Issue**: Password briefly in memory as string.
**Mitigation**: Clear password immediately after use; use `secureZeroMemory` if available.

### 3. @opentui Input Limitations
**Issue**: The `<input>` component may not support proper password masking.
**Mitigation**: May need to implement custom password input handling or submit PR to @opentui.

### 4. sudo Timeout
**Issue**: Long-running operations might exceed sudo's timeout.
**Mitigation**: Set appropriate timeouts; re-prompt if needed.

### 5. Error Message Parsing
**Issue**: Different macOS versions may have different error messages.
**Mitigation**: Test on multiple versions; use flexible string matching.

## Testing Plan

1. **Unit tests for `sudo.ts`**:
   - `isSudoCached()` detection
   - `isGuiContext()` detection
   - Command escaping in osascript

2. **Integration tests**:
   - Mock sudo cache scenarios
   - Test auth cancellation handling
   - Test auth failure handling

3. **Manual testing**:
   - Test in Terminal.app (GUI context)
   - Test over SSH (headless context)
   - Test with cached sudo credentials
   - Test cancel flow
   - Test wrong password → retry

## Dependencies

**No new dependencies required** - the implementation uses:
- Built-in Bun `spawn()`
- Built-in macOS `osascript`
- Existing @opentui components

## Estimated Effort

- Phase 1 (Core Infrastructure): ~2-3 hours
- Phase 2 (UI Components): ~2-3 hours  
- Phase 3 (Integration): ~3-4 hours
- Testing & Polish: ~2-3 hours

**Total: ~10-13 hours**
