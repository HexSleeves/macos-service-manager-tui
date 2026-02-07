/**
 * Editor utilities for opening files in external editors
 */

import { existsSync } from "node:fs";
import { spawn } from "bun";

/**
 * Get the user's preferred editor
 * Priority: $VISUAL → $EDITOR → nano (POSIX convention: VISUAL for full-screen editors)
 */
export function getPreferredEditor(): string {
	const editor = process.env.VISUAL || process.env.EDITOR;
	if (editor) return editor;

	// Default to nano which is available on macOS
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
 * Check if a plist file exists
 */
export function plistExists(filePath: string): boolean {
	return existsSync(filePath);
}

/**
 * Open a file in the preferred editor
 * Returns a promise that resolves when the editor closes
 *
 * @param filePath - Path to the file to edit
 * @param options.useRoot - Whether to use sudo
 */
export async function openInEditor(
	filePath: string,
	options: {
		useRoot?: boolean;
	} = {},
): Promise<{ success: boolean; error?: string }> {
	const { useRoot = false } = options;

	const editor = getPreferredEditor();

	// Build command
	const command = useRoot ? ["sudo", editor, filePath] : [editor, filePath];

	try {
		// Spawn editor with inherited stdio (takes over terminal)
		const proc = spawn(command, {
			stdin: "inherit",
			stdout: "inherit",
			stderr: "inherit",
		});

		// Wait for editor to close
		const exitCode = await proc.exited;

		return {
			success: exitCode === 0,
			error: exitCode !== 0 ? `Editor exited with code ${exitCode}` : undefined,
		};
	} catch (error) {
		return {
			success: false,
			error: error instanceof Error ? error.message : "Failed to open editor",
		};
	}
}
