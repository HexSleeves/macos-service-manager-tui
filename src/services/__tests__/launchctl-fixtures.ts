/**
 * Test fixtures for launchctl output parsing across macOS versions
 * 
 * These fixtures represent the various output formats observed across:
 * - macOS 10.14 Mojave
 * - macOS 10.15 Catalina
 * - macOS 11 Big Sur
 * - macOS 12 Monterey
 * - macOS 13 Ventura
 * - macOS 14 Sonoma
 * - macOS 15 Sequoia
 */

// ============================================================================
// launchctl list output fixtures
// ============================================================================

/** Standard modern format (macOS 10.10+) with tabs */
export const LIST_STANDARD = `PID\tStatus\tLabel
-\t0\tcom.apple.syslogd
1234\t0\tcom.example.running
-\t78\tcom.example.error
-\t-\tcom.example.disabled
56789\t0\tcom.apple.mDNSResponder
`;

/** Format with extra whitespace (seen in some versions) */
export const LIST_EXTRA_WHITESPACE = `PID\t\tStatus\t\tLabel
  -  \t  0  \t  com.apple.syslogd  
  1234  \t  0  \t  com.example.running  
`;

/** Format using spaces instead of tabs (legacy/terminal variation) */
export const LIST_SPACE_SEPARATED = `PID     Status  Label
-       0       com.apple.syslogd
1234    0       com.example.running
-       78      com.example.error
`;

/** Mixed tabs and spaces (edge case from some terminals) */
export const LIST_MIXED_SEPARATORS = `PID\tStatus\tLabel
-\t0\tcom.apple.syslogd
1234    0       com.example.running
-\t78\tcom.example.error
`;

/** No header (some older versions or raw pipe output) */
export const LIST_NO_HEADER = `-\t0\tcom.apple.syslogd
1234\t0\tcom.example.running
-\t78\tcom.example.error
`;

/** Empty output */
export const LIST_EMPTY = ``;

/** Only header, no services */
export const LIST_HEADER_ONLY = `PID\tStatus\tLabel
`;

/** Output with error message mixed in */
export const LIST_WITH_ERROR = `PID\tStatus\tLabel
Could not contact daemon.
-\t0\tcom.apple.syslogd
1234\t0\tcom.example.running
`;

/** Large PIDs (seen on long-running systems) */
export const LIST_LARGE_PIDS = `PID\tStatus\tLabel
99999\t0\tcom.example.large
1234567\t0\tcom.example.verylarge
-\t-1\tcom.example.negative
`;

/** Labels with unusual characters */
export const LIST_UNUSUAL_LABELS = `PID\tStatus\tLabel
-\t0\tcom.example.with-dash
-\t0\tcom.example.with_underscore
-\t0\tcom.example.with.many.dots
-\t0\t0com.starts.with.number
`;

/** Catalina-specific format (slightly different header casing sometimes) */
export const LIST_CATALINA = `PID\tStatus\tLabel
-\t0\tcom.apple.cloudpaird
145\t0\tcom.apple.Spotlight
-\t0\tcom.apple.imfoundation.IMRemoteURLConnectionAgent
`;

/** Format seen in Sequoia with potential new fields (hypothetical) */
export const LIST_SEQUOIA = `PID\tStatus\tLabel\tPath
-\t0\tcom.apple.syslogd\t/System/Library/LaunchDaemons/com.apple.syslogd.plist
1234\t0\tcom.example.running\t/Library/LaunchDaemons/com.example.running.plist
`;

// ============================================================================
// launchctl print output fixtures
// ============================================================================

/** Modern format (macOS 10.10+) */
export const PRINT_MODERN = `com.example.myservice = {
\tpath = /Library/LaunchDaemons/com.example.myservice.plist
\tstate = running
\tprogram = /usr/local/bin/myservice
\tpid = 1234
\tlast exit code = 0
\tspawn type = daemon
\tondemand = false
\tactive count = 1
\truns = 5
}
`;

/** Stopped service */
export const PRINT_STOPPED = `com.example.stopped = {
\tpath = /Library/LaunchDaemons/com.example.stopped.plist
\tstate = not running
\tprogram = /usr/local/bin/stopped
\tlast exit code = 0
\tondemand = true
}
`;

/** Service with error */
export const PRINT_ERROR = `com.example.failing = {
\tpath = /Library/LaunchAgents/com.example.failing.plist
\tstate = not running
\tprogram = /usr/local/bin/failing
\tlast exit code = 78
\tlast spawn error = EPERM
}
`;

/** Disabled service */
export const PRINT_DISABLED = `com.example.disabled = {
\tpath = /Library/LaunchDaemons/com.example.disabled.plist
\tstate = disabled
\tprogram = /usr/local/bin/disabled
\tondemand = true
}
`;

/** Ventura/Sonoma format with additional fields */
export const PRINT_VENTURA = `com.apple.sharingd = {
\tpath = /System/Library/LaunchAgents/com.apple.sharingd.plist
\tstate = running
\tprogram = /usr/libexec/sharingd
\targuments = {
\t\t/usr/libexec/sharingd
\t}
\tpid = 456
\tlast exit code = 0
\tenabled = true
\trun state = running
\tpriority = 50
\tprocesstype = Background
}
`;

/** Catalina format (slightly different key names) */
export const PRINT_CATALINA = `com.example.service = {
\tpath = /Library/LaunchDaemons/com.example.service.plist
\tstatus = 0
\tPID = 789
\tprogram = /usr/bin/service
\tenabled = 1
\tlastExitStatus = 0
}
`;

/** Big Sur format */
export const PRINT_BIG_SUR = `com.example.bigsur = {
\tpath = /Library/LaunchDaemons/com.example.bigsur.plist
\tstate = running
\tpid = 321
\tprogram = /usr/bin/bigsur
\tlast exit status = 0
\tenabled = true
}
`;

/** Older format (pre-10.10 style, flat key-value) */
export const PRINT_LEGACY = `"Label" = "com.example.legacy";
"Program" = "/usr/bin/legacy";
"PID" = 555;
"LastExitStatus" = 0;
"OnDemand" = true;
`;

/** Output with hierarchical nested structures */
export const PRINT_NESTED = `com.apple.complex = {
\tpath = /System/Library/LaunchDaemons/com.apple.complex.plist
\tstate = running
\tpid = 111
\tprogram = /usr/libexec/complex
\tenvironment = {
\t\tPATH = /usr/bin:/bin
\t\tHOME = /var/root
\t}
\tmach ports = {
\t\tcom.apple.complex.port = 0x1234
\t}
\tendpoints = {
\t\tcom.apple.complex.xpc = {
\t\t\tactive = 1
\t\t}
\t}
}
`;

/** Empty/minimal output */
export const PRINT_EMPTY = ``;

/** Error output (service not found) */
export const PRINT_NOT_FOUND = `Could not find service "com.example.notfound" in domain for system
`;

/** Output with error message followed by partial data */
export const PRINT_PARTIAL_ERROR = `Warning: Reading from launchd may take a while.
com.example.partial = {
\tpath = /Library/LaunchDaemons/com.example.partial.plist
\tstate = running
}
`;

/** Sequoia format (hypothetical newer format) */
export const PRINT_SEQUOIA = `service: com.example.sequoia
path: /Library/LaunchDaemons/com.example.sequoia.plist
state: running
pid: 9999
program: /usr/local/bin/sequoia
last-exit-code: 0
enabled: true
type: daemon
process-type: background
`;

/** Output with hex values */
export const PRINT_HEX_VALUES = `com.example.hex = {
\tpath = /Library/LaunchDaemons/com.example.hex.plist
\tstate = running
\tpid = 0x1a2b
\tlast exit code = 0x0
\tmach port = 0xdeadbeef
}
`;

// ============================================================================
// Expected parse results
// ============================================================================

export const EXPECTED_LIST_STANDARD = [
	{ pid: undefined, exitStatus: 0, label: "com.apple.syslogd" },
	{ pid: 1234, exitStatus: 0, label: "com.example.running" },
	{ pid: undefined, exitStatus: 78, label: "com.example.error" },
	{ pid: undefined, exitStatus: undefined, label: "com.example.disabled" },
	{ pid: 56789, exitStatus: 0, label: "com.apple.mDNSResponder" },
];

export const EXPECTED_LIST_NO_HEADER = [
	{ pid: undefined, exitStatus: 0, label: "com.apple.syslogd" },
	{ pid: 1234, exitStatus: 0, label: "com.example.running" },
	{ pid: undefined, exitStatus: 78, label: "com.example.error" },
];

export const EXPECTED_PRINT_MODERN = {
	path: "/Library/LaunchDaemons/com.example.myservice.plist",
	state: "running",
	program: "/usr/local/bin/myservice",
	pid: "1234",
	last_exit_code: "0",
	spawn_type: "daemon",
	ondemand: "false",
	active_count: "1",
	runs: "5",
};

export const EXPECTED_PRINT_VENTURA = {
	path: "/System/Library/LaunchAgents/com.apple.sharingd.plist",
	state: "running",
	program: "/usr/libexec/sharingd",
	pid: "456",
	last_exit_code: "0",
	enabled: "true",
	run_state: "running",
	priority: "50",
	processtype: "Background",
};
