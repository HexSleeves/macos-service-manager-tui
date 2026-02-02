/**
 * Command execution utilities for launchctl
 */

import { spawn } from "bun";
import { isTransientError, type RetryOptions, withRetry } from "../../utils/retry";
import type { CommandResult, CommandResultWithRetry } from "./types";
import { DEFAULT_TIMEOUT_MS } from "./types";

/** Retry callback for logging */
let retryLogger:
	| ((attempt: number, error: Error, delayMs: number) => void)
	| null = null;

/**
 * Set a callback to be called when retries occur
 */
export function setRetryLogger(
	logger: ((attempt: number, error: Error, delayMs: number) => void) | null,
): void {
	retryLogger = logger;
}

/**
 * Execute a shell command with timeout (single attempt)
 */
async function execCommandOnce(
	command: string,
	args: string[],
	timeoutMs: number = DEFAULT_TIMEOUT_MS,
): Promise<CommandResult> {
	const proc = spawn([command, ...args], {
		stdout: "pipe",
		stderr: "pipe",
	});

	const timeoutPromise = new Promise<never>((_, reject) => {
		setTimeout(() => {
			proc.kill();
			reject(new Error(`Command timed out after ${timeoutMs}ms`));
		}, timeoutMs);
	});

	const [stdout, stderr, exitCode] = await Promise.race([
		Promise.all([
			new Response(proc.stdout).text(),
			new Response(proc.stderr).text(),
			proc.exited,
		]),
		timeoutPromise,
	]);

	return { stdout, stderr, exitCode };
}

/**
 * Execute a shell command with timeout
 */
export async function execCommand(
	command: string,
	args: string[],
	timeoutMs: number = DEFAULT_TIMEOUT_MS,
): Promise<CommandResult> {
	try {
		return await execCommandOnce(command, args, timeoutMs);
	} catch (error) {
		return {
			stdout: "",
			stderr: error instanceof Error ? error.message : "Unknown error",
			exitCode: 1,
		};
	}
}

/**
 * Execute a shell command with automatic retry for transient failures
 */
export async function execCommandWithRetry(
	command: string,
	args: string[],
	timeoutMs: number = DEFAULT_TIMEOUT_MS,
	retryOptions?: RetryOptions,
): Promise<CommandResultWithRetry> {
	const options: RetryOptions = {
		maxRetries: 3,
		initialDelayMs: 1000,
		exponentialBackoff: true,
		maxDelayMs: 10000,
		onRetry: retryLogger ?? undefined,
		...retryOptions,
	};

	try {
		const result = await withRetry(async () => {
			const cmdResult = await execCommandOnce(command, args, timeoutMs);

			if (cmdResult.exitCode !== 0 && isTransientError(cmdResult.stderr)) {
				throw new Error(
					cmdResult.stderr ||
						`Command failed with exit code ${cmdResult.exitCode}`,
				);
			}

			return cmdResult;
		}, options);

		return {
			...result.value,
			retryInfo: result.retried
				? {
						attempts: result.attempts,
						retried: result.retried,
						retryErrors: result.retryErrors,
					}
				: undefined,
		};
	} catch (error) {
		return {
			stdout: "",
			stderr: error instanceof Error ? error.message : "Unknown error",
			exitCode: 1,
			retryInfo: {
				attempts: (options.maxRetries ?? 3) + 1,
				retried: true,
				retryErrors: [error instanceof Error ? error.message : "Unknown error"],
			},
		};
	}
}
