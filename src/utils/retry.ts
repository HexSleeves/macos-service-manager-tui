/**
 * Retry utility for transient failure handling
 */

export interface RetryOptions {
	/** Maximum number of retry attempts (default: 3) */
	maxRetries?: number;
	/** Initial delay between retries in ms (default: 1000) */
	initialDelayMs?: number;
	/** Use exponential backoff (default: true) */
	exponentialBackoff?: boolean;
	/** Maximum delay between retries in ms (default: 10000) */
	maxDelayMs?: number;
	/** Callback when a retry is attempted */
	onRetry?: (attempt: number, error: Error, delayMs: number) => void;
}

export interface RetryResult<T> {
	/** The result value if successful */
	value: T;
	/** Total number of attempts made (1 = no retries) */
	attempts: number;
	/** Whether retries were needed */
	retried: boolean;
	/** Errors encountered during retries (not including final success/failure) */
	retryErrors?: string[];
}

const DEFAULT_OPTIONS: Required<Omit<RetryOptions, "onRetry">> = {
	maxRetries: 3,
	initialDelayMs: 1000,
	exponentialBackoff: true,
	maxDelayMs: 10000,
};

/**
 * List of error patterns that are considered transient and should be retried
 */
const TRANSIENT_ERROR_PATTERNS = [
	/timed? ?out/i,
	/timeout/i,
	/EAGAIN/i,
	/EBUSY/i,
	/ETIMEDOUT/i,
	/ECONNRESET/i,
	/ECONNREFUSED/i,
	/resource temporarily unavailable/i,
	/temporary failure/i,
	/try again/i,
	/service unavailable/i,
	/could not communicate/i,
];

/**
 * List of error patterns that should NOT be retried (permanent failures)
 */
const PERMANENT_ERROR_PATTERNS = [
	/permission denied/i,
	/operation not permitted/i,
	/system integrity protection/i,
	/sip/i,
	/invalid.*label/i,
	/no such service/i,
	/service not found/i,
	/could not find service/i,
	/not running/i,
	/already running/i,
	/already bootstrapped/i,
	/no such process/i,
	/invalid argument/i,
	/EACCES/i,
	/EPERM/i,
	/ENOENT/i,
];

/**
 * Determine if an error is transient and should be retried
 */
export function isTransientError(error: Error | string): boolean {
	const errorMessage = typeof error === "string" ? error : error.message;

	// First check if it matches any permanent error patterns
	for (const pattern of PERMANENT_ERROR_PATTERNS) {
		if (pattern.test(errorMessage)) {
			return false;
		}
	}

	// Then check if it matches transient error patterns
	for (const pattern of TRANSIENT_ERROR_PATTERNS) {
		if (pattern.test(errorMessage)) {
			return true;
		}
	}

	// Default: don't retry unknown errors
	return false;
}

/**
 * Calculate delay for a given attempt number with optional exponential backoff
 */
export function calculateDelay(
	attempt: number,
	initialDelayMs: number,
	exponentialBackoff: boolean,
	maxDelayMs: number,
): number {
	if (!exponentialBackoff) {
		return Math.min(initialDelayMs, maxDelayMs);
	}
	// Exponential backoff: delay = initialDelay * 2^(attempt-1)
	const delay = initialDelayMs * 2 ** (attempt - 1);
	return Math.min(delay, maxDelayMs);
}

/**
 * Sleep for a given number of milliseconds
 */
function sleep(ms: number): Promise<void> {
	return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Wrap an async operation with retry logic for transient failures
 *
 * @param operation - The async operation to execute
 * @param options - Retry configuration options
 * @returns RetryResult containing the value and retry metadata
 * @throws The last error if all retries are exhausted
 */
export async function withRetry<T>(
	operation: () => Promise<T>,
	options: RetryOptions = {},
): Promise<RetryResult<T>> {
	const opts = { ...DEFAULT_OPTIONS, ...options };
	const {
		maxRetries,
		initialDelayMs,
		exponentialBackoff,
		maxDelayMs,
		onRetry,
	} = opts;

	let lastError: Error | null = null;
	const retryErrors: string[] = [];

	for (let attempt = 1; attempt <= maxRetries + 1; attempt++) {
		try {
			const value = await operation();
			return {
				value,
				attempts: attempt,
				retried: attempt > 1,
				retryErrors: retryErrors.length > 0 ? retryErrors : undefined,
			};
		} catch (error) {
			lastError = error instanceof Error ? error : new Error(String(error));

			// Check if this is the last attempt
			if (attempt > maxRetries) {
				break;
			}

			// Check if error is transient and should be retried
			if (!isTransientError(lastError)) {
				// Permanent error, don't retry
				break;
			}

			// Record the retry error
			retryErrors.push(lastError.message);

			// Calculate delay before next attempt
			const delayMs = calculateDelay(
				attempt,
				initialDelayMs,
				exponentialBackoff,
				maxDelayMs,
			);

			// Call retry callback if provided
			if (onRetry) {
				onRetry(attempt, lastError, delayMs);
			}

			// Wait before retrying
			await sleep(delayMs);
		}
	}

	// All retries exhausted, throw the last error
	throw lastError;
}

/**
 * Wrap an async operation that returns a result object (not throwing)
 * with retry logic. Useful for operations that return success/failure in the result.
 *
 * @param operation - The async operation to execute
 * @param shouldRetry - Function to determine if the result should trigger a retry
 * @param options - Retry configuration options
 * @returns RetryResult containing the final result and retry metadata
 */
export async function withRetryResult<T>(
	operation: () => Promise<T>,
	shouldRetry: (result: T) => boolean,
	options: RetryOptions = {},
): Promise<RetryResult<T>> {
	const opts = { ...DEFAULT_OPTIONS, ...options };
	const {
		maxRetries,
		initialDelayMs,
		exponentialBackoff,
		maxDelayMs,
		onRetry,
	} = opts;

	let lastResult: T | null = null;
	const retryErrors: string[] = [];

	for (let attempt = 1; attempt <= maxRetries + 1; attempt++) {
		try {
			const result = await operation();
			lastResult = result;

			// Check if we should retry based on the result
			if (!shouldRetry(result) || attempt > maxRetries) {
				return {
					value: result,
					attempts: attempt,
					retried: attempt > 1,
					retryErrors: retryErrors.length > 0 ? retryErrors : undefined,
				};
			}

			// Record that we're retrying
			retryErrors.push(`Attempt ${attempt} failed, retrying...`);

			// Calculate delay before next attempt
			const delayMs = calculateDelay(
				attempt,
				initialDelayMs,
				exponentialBackoff,
				maxDelayMs,
			);

			// Call retry callback if provided
			if (onRetry) {
				onRetry(attempt, new Error("Retry triggered by result check"), delayMs);
			}

			// Wait before retrying
			await sleep(delayMs);
		} catch (error) {
			// If the operation throws, wrap it and continue
			const err = error instanceof Error ? error : new Error(String(error));
			retryErrors.push(err.message);

			if (attempt > maxRetries || !isTransientError(err)) {
				throw err;
			}

			const delayMs = calculateDelay(
				attempt,
				initialDelayMs,
				exponentialBackoff,
				maxDelayMs,
			);
			if (onRetry) {
				onRetry(attempt, err, delayMs);
			}
			await sleep(delayMs);
		}
	}

	// Return the last result if we have one
	if (lastResult !== null) {
		return {
			value: lastResult,
			attempts: maxRetries + 1,
			retried: true,
			retryErrors: retryErrors.length > 0 ? retryErrors : undefined,
		};
	}

	throw new Error("Operation failed after all retries");
}
