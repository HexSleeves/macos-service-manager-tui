/**
 * Sudo and privilege escalation utilities
 */

import { spawn } from "bun";

/** Result of a privileged command execution */
export interface PrivilegedResult {
	success: boolean;
	stdout: string;
	stderr: string;
	exitCode: number;
	authCancelled?: boolean; // User cancelled auth dialog
	authFailed?: boolean; // Wrong password
}

/**
 * Check if sudo credentials are currently cached
 * Returns true if sudo can run without password prompt
 */
export async function isSudoCached(): Promise<boolean> {
	try {
		// sudo -n (non-interactive) returns 0 if credentials are cached
		const proc = spawn(["sudo", "-n", "true"], {
			stdout: "pipe",
			stderr: "pipe",
		});

		const exitCode = await proc.exited;
		return exitCode === 0;
	} catch {
		return false;
	}
}

/**
 * Detect if running in a GUI context (vs SSH/headless)
 * Check SSH_CONNECTION, SSH_TTY, TERM_PROGRAM env vars
 */
export function isGuiContext(): boolean {
	const env = process.env;

	// If connected via SSH, not a GUI context
	if (env.SSH_CONNECTION || env.SSH_TTY || env.SSH_CLIENT) {
		return false;
	}

	// If running in a known terminal emulator app, it's GUI
	const termProgram = env.TERM_PROGRAM;
	if (termProgram) {
		// Known macOS terminal apps
		const guiTerminals = [
			"Apple_Terminal",
			"iTerm.app",
			"vscode",
			"Hyper",
			"Alacritty",
			"kitty",
			"WarpTerminal",
		];
		if (guiTerminals.some((t) => termProgram.includes(t))) {
			return true;
		}
	}

	// Check for DISPLAY (X11) or macOS-specific indicators
	if (env.DISPLAY || env.__CFBundleIdentifier) {
		return true;
	}

	// Default: assume GUI on macOS if not SSH
	return process.platform === "darwin";
}

/**
 * Escape a string for use inside AppleScript double-quoted string
 * Escapes backslashes and double quotes
 */
function escapeForAppleScript(str: string): string {
	return str.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}

/**
 * Build a shell command string from an array of arguments
 * Properly quotes arguments that need it
 */
function buildShellCommand(command: string[]): string {
	return command
		.map((arg) => {
			// If arg contains special characters, quote it
			if (/[\s"'\\$`!*?#~<>|;&()[\]{}]/.test(arg)) {
				// Use single quotes and escape any single quotes within
				return `'${arg.replace(/'/g, "'\\''")}'"`;
			}
			return arg;
		})
		.join(" ");
}

/**
 * Execute command with osascript admin privileges (GUI context)
 * Shows native macOS authentication dialog
 * Properly escape the command for AppleScript
 */
export async function execWithOsascript(command: string[]): Promise<PrivilegedResult> {
	// Build the shell command
	const shellCmd = buildShellCommand(command);

	// Escape for AppleScript
	const escapedCmd = escapeForAppleScript(shellCmd);

	// Build the AppleScript command
	const appleScript = `do shell script "${escapedCmd}" with administrator privileges`;

	try {
		const proc = spawn(["osascript", "-e", appleScript], {
			stdout: "pipe",
			stderr: "pipe",
		});

		const [stdout, stderr, exitCode] = await Promise.all([
			new Response(proc.stdout).text(),
			new Response(proc.stderr).text(),
			proc.exited,
		]);

		// Check for user cancellation
		const authCancelled =
			stderr.includes("User canceled") || stderr.includes("user canceled") || stderr.includes("-128");

		return {
			success: exitCode === 0,
			stdout: stdout.trim(),
			stderr: stderr.trim(),
			exitCode,
			authCancelled,
		};
	} catch (error) {
		const message = error instanceof Error ? error.message : "Unknown error";
		return {
			success: false,
			stdout: "",
			stderr: message,
			exitCode: 1,
		};
	}
}

/**
 * Execute command with sudo -S (reads password from stdin)
 * Used for SSH/headless context
 */
export async function execWithSudoStdin(command: string[], password: string): Promise<PrivilegedResult> {
	try {
		const proc = spawn(["sudo", "-S", ...command], {
			stdin: "pipe",
			stdout: "pipe",
			stderr: "pipe",
		});

		// Write password to stdin followed by newline
		// FileSink has write() and end() methods
		proc.stdin.write(`${password}\n`);
		proc.stdin.end();

		const [stdout, stderr, exitCode] = await Promise.all([
			new Response(proc.stdout).text(),
			new Response(proc.stderr).text(),
			proc.exited,
		]);

		// Check for auth failure
		const authFailed =
			stderr.includes("Sorry, try again") ||
			stderr.includes("incorrect password") ||
			stderr.includes("Authentication failed");

		return {
			success: exitCode === 0,
			stdout: stdout.trim(),
			stderr: stderr.trim(),
			exitCode,
			authFailed,
		};
	} catch (error) {
		const message = error instanceof Error ? error.message : "Unknown error";
		return {
			success: false,
			stdout: "",
			stderr: message,
			exitCode: 1,
		};
	}
}

/**
 * Execute a command with sudo using cached credentials
 */
async function execWithSudoCached(command: string[]): Promise<PrivilegedResult> {
	try {
		const proc = spawn(["sudo", ...command], {
			stdout: "pipe",
			stderr: "pipe",
		});

		const [stdout, stderr, exitCode] = await Promise.all([
			new Response(proc.stdout).text(),
			new Response(proc.stderr).text(),
			proc.exited,
		]);

		return {
			success: exitCode === 0,
			stdout: stdout.trim(),
			stderr: stderr.trim(),
			exitCode,
		};
	} catch (error) {
		const message = error instanceof Error ? error.message : "Unknown error";
		return {
			success: false,
			stdout: "",
			stderr: message,
			exitCode: 1,
		};
	}
}

/**
 * Main entry point - execute privileged command with appropriate method
 * 1. Check if sudo cached -> use regular sudo
 * 2. GUI context -> use osascript
 * 3. SSH/headless -> return needs_password indicator or use provided password
 */
export async function executePrivileged(
	command: string[],
	password?: string,
): Promise<PrivilegedResult & { needsPassword?: boolean }> {
	// First, check if sudo credentials are cached
	const cached = await isSudoCached();
	if (cached) {
		return await execWithSudoCached(command);
	}

	// If in GUI context, use osascript for native auth dialog
	if (isGuiContext()) {
		return await execWithOsascript(command);
	}

	// SSH/headless context - need password
	if (password) {
		return await execWithSudoStdin(command, password);
	}

	// No password provided in headless context
	return {
		success: false,
		stdout: "",
		stderr: "Password required for privileged operation in headless context",
		exitCode: 1,
		needsPassword: true,
	};
}
