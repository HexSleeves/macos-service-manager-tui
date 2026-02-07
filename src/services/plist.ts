/**
 * Plist file parsing for macOS service metadata
 * Uses plutil to convert both XML and binary plists to JSON
 */

import { spawn } from "bun";

/**
 * Parsed plist data structure for launchd services
 */
export interface PlistData {
	label?: string;
	program?: string;
	programArguments?: string[];
	runAtLoad?: boolean;
	keepAlive?: boolean | KeepAliveConfig;
	workingDirectory?: string;
	environmentVariables?: Record<string, string>;
	standardOutPath?: string;
	standardErrorPath?: string;
	startInterval?: number;
	startCalendarInterval?: CalendarInterval | CalendarInterval[];
	processType?: string;
	limitLoadToSessionType?: string | string[];
	username?: string;
	groupname?: string;
	umask?: number;
	nice?: number;
	timeout?: number;
	exitTimeout?: number;
	throttleInterval?: number;
	watchPaths?: string[];
	queueDirectories?: string[];
	sockets?: Record<string, unknown>;
	machServices?: Record<string, unknown>;
	inetdCompatibility?: { wait: boolean };
}

/**
 * KeepAlive can be a boolean or a complex config
 */
export interface KeepAliveConfig {
	successfulExit?: boolean;
	networkState?: boolean;
	pathState?: Record<string, boolean>;
	otherJobEnabled?: Record<string, boolean>;
	afterInitialDemand?: boolean;
	crasher?: boolean;
}

/**
 * Calendar interval for scheduled jobs
 */
export interface CalendarInterval {
	minute?: number;
	hour?: number;
	day?: number;
	weekday?: number;
	month?: number;
}

/**
 * Read and parse a plist file
 * Uses plutil to convert any plist format (binary or XML) to JSON
 */
export async function readPlist(path: string): Promise<PlistData | null> {
	try {
		const file = Bun.file(path);
		if (!(await file.exists())) {
			return null;
		}

		// plutil handles both binary and XML plists natively
		const proc = spawn(["plutil", "-convert", "json", "-o", "-", path], {
			stdout: "pipe",
			stderr: "pipe",
		});

		const stdout = await new Response(proc.stdout).text();
		const exitCode = await proc.exited;

		if (exitCode !== 0 || !stdout.trim()) {
			return null;
		}

		const raw = JSON.parse(stdout) as Record<string, unknown>;
		return mapToPlistData(raw);
	} catch {
		// plutil not available (non-macOS) or invalid plist
		return null;
	}
}

/**
 * Map raw parsed data to our PlistData structure
 */
function mapToPlistData(raw: Record<string, unknown>): PlistData {
	const data: PlistData = {};

	if (typeof raw.Label === "string") {
		data.label = raw.Label;
	}

	if (typeof raw.Program === "string") {
		data.program = raw.Program;
	}

	if (Array.isArray(raw.ProgramArguments)) {
		data.programArguments = raw.ProgramArguments.filter((a): a is string => typeof a === "string");
	}

	if (typeof raw.RunAtLoad === "boolean") {
		data.runAtLoad = raw.RunAtLoad;
	}

	if (typeof raw.KeepAlive === "boolean") {
		data.keepAlive = raw.KeepAlive;
	} else if (typeof raw.KeepAlive === "object" && raw.KeepAlive !== null) {
		data.keepAlive = raw.KeepAlive as KeepAliveConfig;
	}

	if (typeof raw.WorkingDirectory === "string") {
		data.workingDirectory = raw.WorkingDirectory;
	}

	if (typeof raw.EnvironmentVariables === "object" && raw.EnvironmentVariables !== null) {
		data.environmentVariables = raw.EnvironmentVariables as Record<string, string>;
	}

	if (typeof raw.StandardOutPath === "string") {
		data.standardOutPath = raw.StandardOutPath;
	}

	if (typeof raw.StandardErrorPath === "string") {
		data.standardErrorPath = raw.StandardErrorPath;
	}

	if (typeof raw.StartInterval === "number") {
		data.startInterval = raw.StartInterval;
	}

	if (raw.StartCalendarInterval) {
		if (Array.isArray(raw.StartCalendarInterval)) {
			data.startCalendarInterval = raw.StartCalendarInterval as CalendarInterval[];
		} else {
			data.startCalendarInterval = raw.StartCalendarInterval as CalendarInterval;
		}
	}

	if (typeof raw.ProcessType === "string") {
		data.processType = raw.ProcessType;
	}

	if (typeof raw.LimitLoadToSessionType === "string") {
		data.limitLoadToSessionType = raw.LimitLoadToSessionType;
	} else if (Array.isArray(raw.LimitLoadToSessionType)) {
		data.limitLoadToSessionType = raw.LimitLoadToSessionType.filter(
			(s): s is string => typeof s === "string",
		);
	}

	if (typeof raw.UserName === "string") {
		data.username = raw.UserName;
	}

	if (typeof raw.GroupName === "string") {
		data.groupname = raw.GroupName;
	}

	if (typeof raw.Umask === "number") {
		data.umask = raw.Umask;
	}

	if (typeof raw.Nice === "number") {
		data.nice = raw.Nice;
	}

	if (typeof raw.TimeOut === "number") {
		data.timeout = raw.TimeOut;
	}

	if (typeof raw.ExitTimeOut === "number") {
		data.exitTimeout = raw.ExitTimeOut;
	}

	if (typeof raw.ThrottleInterval === "number") {
		data.throttleInterval = raw.ThrottleInterval;
	}

	if (Array.isArray(raw.WatchPaths)) {
		data.watchPaths = raw.WatchPaths.filter((p): p is string => typeof p === "string");
	}

	if (Array.isArray(raw.QueueDirectories)) {
		data.queueDirectories = raw.QueueDirectories.filter((p): p is string => typeof p === "string");
	}

	if (typeof raw.Sockets === "object" && raw.Sockets !== null) {
		data.sockets = raw.Sockets as Record<string, unknown>;
	}

	if (typeof raw.MachServices === "object" && raw.MachServices !== null) {
		data.machServices = raw.MachServices as Record<string, unknown>;
	}

	if (typeof raw.inetdCompatibility === "object" && raw.inetdCompatibility !== null) {
		data.inetdCompatibility = raw.inetdCompatibility as { wait: boolean };
	}

	return data;
}

/**
 * Get a human-readable description of the plist configuration
 */
export function describePlistConfig(plist: PlistData): string {
	const parts: string[] = [];

	if (plist.runAtLoad) {
		parts.push("Runs at load");
	}

	if (plist.keepAlive === true) {
		parts.push("Always kept alive");
	} else if (typeof plist.keepAlive === "object") {
		parts.push("Conditional keep-alive");
	}

	if (plist.startInterval) {
		const interval = plist.startInterval;
		if (interval < 60) {
			parts.push(`Runs every ${interval}s`);
		} else if (interval < 3600) {
			parts.push(`Runs every ${Math.round(interval / 60)}m`);
		} else {
			parts.push(`Runs every ${Math.round(interval / 3600)}h`);
		}
	}

	if (plist.startCalendarInterval) {
		parts.push("Scheduled");
	}

	if (plist.watchPaths?.length) {
		parts.push(`Watches ${plist.watchPaths.length} path(s)`);
	}

	if (plist.queueDirectories?.length) {
		parts.push(`Queue dirs: ${plist.queueDirectories.length}`);
	}

	if (plist.sockets && Object.keys(plist.sockets).length > 0) {
		parts.push("Socket-activated");
	}

	if (plist.machServices && Object.keys(plist.machServices).length > 0) {
		parts.push("Mach service");
	}

	return parts.join(", ") || "On-demand";
}
