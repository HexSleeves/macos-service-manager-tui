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
 * Cache sudo credentials using osascript to prompt for password
 * This shows the native macOS auth dialog and then caches for regular sudo use
 */
async function cacheSudoViaOsascript(): Promise<{ success: boolean; cancelled: boolean }> {
	// Use osascript to run 'sudo -v' which validates/caches credentials
	const appleScript = `do shell script "sudo -v" with administrator privileges`;

	try {
		const proc = spawn(["osascript", "-e", appleScript], {
			stdout: "pipe",
			stderr: "pipe",
		});

		const [, stderr, exitCode] = await Promise.all([
			new Response(proc.stdout).text(),
			new Response(proc.stderr).text(),
			proc.exited,
		]);

		const cancelled =
			stderr.includes("User canceled") || stderr.includes("user canceled") || stderr.includes("-128");

		return {
			success: exitCode === 0,
			cancelled,
		};
	} catch {
		return { success: false, cancelled: false };
	}
}

/**
 * Execute command with osascript admin privileges (GUI context)
 * First caches sudo credentials via osascript, then uses regular sudo
 * This way subsequent commands can use cached credentials
 */
export async function execWithOsascript(command: string[]): Promise<PrivilegedResult> {
	// First, cache sudo credentials via osascript auth dialog
	const cacheResult = await cacheSudoViaOsascript();

	if (cacheResult.cancelled) {
		return {
			success: false,
			stdout: "",
			stderr: "User cancelled authentication",
			exitCode: 1,
			authCancelled: true,
		};
	}

	if (!cacheResult.success) {
		return {
			success: false,
			stdout: "",
			stderr: "Failed to authenticate",
			exitCode: 1,
			authFailed: true,
		};
	}

	// Now credentials are cached, use regular sudo
	return await execWithSudoCached(command);
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
