/**
 * Plist file parsing for macOS service metadata
 * Supports both XML and binary plist formats
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
 * Handles both XML and binary formats using plutil for conversion
 */
export async function readPlist(path: string): Promise<PlistData | null> {
	try {
		const file = Bun.file(path);
		if (!(await file.exists())) {
			return null;
		}

		// Read the file content
		const content = await file.arrayBuffer();
		const bytes = new Uint8Array(content);

		// Check if it's binary plist (starts with "bplist")
		const isBinary =
			bytes[0] === 0x62 && // 'b'
			bytes[1] === 0x70 && // 'p'
			bytes[2] === 0x6c && // 'l'
			bytes[3] === 0x69 && // 'i'
			bytes[4] === 0x73 && // 's'
			bytes[5] === 0x74; // 't'

		let xmlContent: string;

		if (isBinary) {
			// Convert binary plist to XML using plutil
			const converted = await convertBinaryPlist(path);
			if (!converted) {
				return null;
			}
			xmlContent = converted;
		} else {
			xmlContent = new TextDecoder().decode(bytes);
		}

		return parseXmlPlist(xmlContent);
	} catch (error) {
		console.error(`Error reading plist ${path}:`, error);
		return null;
	}
}

/**
 * Convert binary plist to XML using plutil
 */
async function convertBinaryPlist(path: string): Promise<string | null> {
	try {
		const proc = spawn(["plutil", "-convert", "xml1", "-o", "-", path], {
			stdout: "pipe",
			stderr: "pipe",
		});

		const stdout = await new Response(proc.stdout).text();
		const exitCode = await proc.exited;

		if (exitCode !== 0) {
			return null;
		}

		return stdout;
	} catch {
		return null;
	}
}

/**
 * Parse XML plist content into PlistData
 * Simple XML parser for plist format
 */
function parseXmlPlist(xml: string): PlistData | null {
	try {
		// Extract the root dict content
		const dictMatch = xml.match(/<dict>([\s\S]*)<\/dict>/);
		if (!dictMatch) {
			return null;
		}

		const dictContent = dictMatch[1];
		if (!dictContent) {
			return null;
		}
		const rawData = parseDictContent(dictContent);

		// Map to our PlistData structure
		return mapToPlistData(rawData);
	} catch (error) {
		console.error("Error parsing plist XML:", error);
		return null;
	}
}

/**
 * Parse dict content into key-value pairs
 */
function parseDictContent(content: string): Record<string, unknown> {
	const result: Record<string, unknown> = {};

	// Match key-value pairs
	const keyRegex = /<key>([^<]+)<\/key>/g;
	const keys: { key: string; index: number }[] = [];

	let match: RegExpExecArray | null = keyRegex.exec(content);
	while (match !== null) {
		if (match[1]) {
			keys.push({ key: match[1], index: match.index + match[0].length });
		}
		match = keyRegex.exec(content);
	}

	for (let i = 0; i < keys.length; i++) {
		const keyInfo = keys[i];
		if (!keyInfo) continue;
		const { key, index } = keyInfo;
		const nextKeyIndex = keys[i + 1]?.index ?? content.length;
		const valueContent = content.slice(index, nextKeyIndex);

		result[key] = parseValue(valueContent);
	}

	return result;
}

/**
 * Parse a plist value (string, integer, boolean, array, dict)
 */
function parseValue(content: string): unknown {
	const trimmed = content.trim();

	// String
	const stringMatch = trimmed.match(/^<string>([^<]*)<\/string>/);
	if (stringMatch) {
		return decodeXmlEntities(stringMatch[1] || "");
	}

	// Integer
	const intMatch = trimmed.match(/^<integer>([^<]+)<\/integer>/);
	if (intMatch?.[1]) {
		return parseInt(intMatch[1], 10);
	}

	// Real/float
	const realMatch = trimmed.match(/^<real>([^<]+)<\/real>/);
	if (realMatch?.[1]) {
		return parseFloat(realMatch[1]);
	}

	// Boolean true
	if (trimmed.match(/^<true\s*\/>/) || trimmed.match(/^<true>/)) {
		return true;
	}

	// Boolean false
	if (trimmed.match(/^<false\s*\/>/) || trimmed.match(/^<false>/)) {
		return false;
	}

	// Array
	const arrayMatch = trimmed.match(/^<array>([\s\S]*?)<\/array>/);
	if (arrayMatch) {
		return parseArrayContent(arrayMatch[1] || "");
	}

	// Empty array
	if (trimmed.match(/^<array\s*\/>/)) {
		return [];
	}

	// Dict
	const dictMatch = trimmed.match(/^<dict>([\s\S]*?)<\/dict>/);
	if (dictMatch) {
		return parseDictContent(dictMatch[1] || "");
	}

	// Empty dict
	if (trimmed.match(/^<dict\s*\/>/)) {
		return {};
	}

	// Data (base64)
	const dataMatch = trimmed.match(/^<data>([^<]*)<\/data>/);
	if (dataMatch) {
		return `[base64 data: ${(dataMatch[1] || "").length} chars]`;
	}

	// Date
	const dateMatch = trimmed.match(/^<date>([^<]+)<\/date>/);
	if (dateMatch?.[1]) {
		return dateMatch[1];
	}

	return null;
}

/**
 * Parse array content
 */
function parseArrayContent(content: string): unknown[] {
	const result: unknown[] = [];

	// Match each element in the array
	const elementRegex =
		/<(string|integer|real|true|false|array|dict|data|date)(\s*\/|>[\s\S]*?<\/\1)>/g;

	let match: RegExpExecArray | null = elementRegex.exec(content);
	while (match !== null) {
		result.push(parseValue(match[0]));
		match = elementRegex.exec(content);
	}

	return result;
}

/**
 * Decode XML entities
 */
function decodeXmlEntities(str: string): string {
	return str
		.replace(/&lt;/g, "<")
		.replace(/&gt;/g, ">")
		.replace(/&amp;/g, "&")
		.replace(/&quot;/g, '"')
		.replace(/&apos;/g, "'");
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
		data.programArguments = raw.ProgramArguments.filter(
			(a): a is string => typeof a === "string",
		);
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

	if (
		typeof raw.EnvironmentVariables === "object" &&
		raw.EnvironmentVariables !== null
	) {
		data.environmentVariables = raw.EnvironmentVariables as Record<
			string,
			string
		>;
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
			data.startCalendarInterval =
				raw.StartCalendarInterval as CalendarInterval[];
		} else {
			data.startCalendarInterval =
				raw.StartCalendarInterval as CalendarInterval;
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
		data.watchPaths = raw.WatchPaths.filter(
			(p): p is string => typeof p === "string",
		);
	}

	if (Array.isArray(raw.QueueDirectories)) {
		data.queueDirectories = raw.QueueDirectories.filter(
			(p): p is string => typeof p === "string",
		);
	}

	if (typeof raw.Sockets === "object" && raw.Sockets !== null) {
		data.sockets = raw.Sockets as Record<string, unknown>;
	}

	if (typeof raw.MachServices === "object" && raw.MachServices !== null) {
		data.machServices = raw.MachServices as Record<string, unknown>;
	}

	if (
		typeof raw.inetdCompatibility === "object" &&
		raw.inetdCompatibility !== null
	) {
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
