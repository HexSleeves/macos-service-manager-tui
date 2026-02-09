import type { ActionResult, Service, ServiceAction } from "../../types";
import { parseErrorMessage } from "./errors";
import { execCommandWithRetry } from "./exec";
import { shouldUseSudo } from "./permissions";
import { executePrivileged } from "./sudo";
import { validateLabel } from "./validation";

export interface ExecuteServiceActionOptions {
	dryRun?: boolean;
	password?: string;
}

export interface DryRunResult extends ActionResult {
	command?: string;
}

/**
 * Execute a service action
 */
export async function executeServiceAction(
	action: ServiceAction,
	service: Service,
	options: ExecuteServiceActionOptions = {},
): Promise<DryRunResult> {
	const { dryRun = false } = options;

	try {
		validateLabel(service.label);
	} catch (error) {
		return {
			success: false,
			message: `Cannot ${action} service`,
			error: error instanceof Error ? error.message : "Invalid service label",
		};
	}

	if (service.protection === "sip-protected" || service.protection === "immutable") {
		return {
			success: false,
			message: `Cannot ${action} service`,
			error: "Service is protected by System Integrity Protection",
			sipProtected: true,
		};
	}

	const target =
		service.domain === "system"
			? `system/${service.label}`
			: `gui/${process.getuid?.() || 501}/${service.label}`;

	let command: string[];

	switch (action) {
		case "start":
			command = ["launchctl", "kickstart", "-k", target];
			break;
		case "stop":
			command = ["launchctl", "kill", "SIGTERM", target];
			break;
		case "enable":
			command = ["launchctl", "enable", target];
			break;
		case "disable":
			command = ["launchctl", "disable", target];
			break;
		case "unload":
			command = ["launchctl", "bootout", target];
			break;
		case "reload":
			command = ["launchctl", "kickstart", "-kp", target];
			break;
		default:
			return {
				success: false,
				message: `Unknown action: ${action}`,
				error: "Invalid action specified",
			};
	}

	const needsSudo = shouldUseSudo(service.requiresRoot);
	const commandString = needsSudo ? `sudo ${command.join(" ")}` : command.join(" ");

	if (dryRun) {
		return {
			success: true,
			message: `[DRY RUN] Would execute: ${commandString}`,
			command: commandString,
		};
	}

	// Execute with privilege escalation if needed
	if (needsSudo) {
		const result = await executePrivileged(command, options.password);

		if (result.needsPassword) {
			return {
				success: false,
				message: "Administrator password required",
				error: "NEEDS_PASSWORD",
			};
		}

		if (result.authCancelled) {
			return {
				success: false,
				message: "Authentication cancelled",
			};
		}

		if (result.authFailed) {
			return {
				success: false,
				message: "Authentication failed",
				error: "AUTH_FAILED",
			};
		}

		if (result.success) {
			return {
				success: true,
				message: `Successfully ${action}ed service: ${service.label}`,
			};
		}

		// Privileged execution failed
		const errorInfo = parseErrorMessage(result.stderr, result.exitCode);
		return {
			success: false,
			message: `Failed to ${action} service`,
			error: errorInfo.message,
			sipProtected: errorInfo.sipProtected,
		};
	}

	// Non-privileged execution
	const [cmd, ...args] = command;
	const result = await execCommandWithRetry(cmd as string, args);

	if (result.exitCode === 0) {
		const successMessage = result.retryInfo?.retried
			? `Successfully ${action}ed service: ${service.label} (after ${result.retryInfo.attempts} attempts)`
			: `Successfully ${action}ed service: ${service.label}`;
		return {
			success: true,
			message: successMessage,
			retryInfo: result.retryInfo,
		};
	}

	const errorInfo = parseErrorMessage(result.stderr, result.exitCode);
	const failureMessage = result.retryInfo?.retried
		? `Failed to ${action} service (after ${result.retryInfo.attempts} attempts)`
		: `Failed to ${action} service`;

	return {
		success: false,
		message: failureMessage,
		error: errorInfo.message,
		requiresRoot: errorInfo.requiresRoot && !service.requiresRoot,
		sipProtected: errorInfo.sipProtected,
		retryInfo: result.retryInfo,
	};
}
