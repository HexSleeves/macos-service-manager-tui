/**
 * macOS launchctl command parsing and execution
 * Based on: https://rakhesh.com/mac/macos-launchctl-commands/
 */

import { spawn } from 'bun';
import type { Service, ServiceDomain, ServiceStatus, ProtectionStatus, ActionResult, ServiceAction } from '../types';

// Standard plist directories
export const PLIST_DIRECTORIES = {
  systemDaemons: '/Library/LaunchDaemons',
  systemAgents: '/Library/LaunchAgents',
  userAgents: '~/Library/LaunchAgents',
  appleDaemons: '/System/Library/LaunchDaemons',
  appleAgents: '/System/Library/LaunchAgents',
} as const;

/**
 * Execute a shell command and return stdout/stderr
 */
async function execCommand(command: string, args: string[]): Promise<{ stdout: string; stderr: string; exitCode: number }> {
  try {
    const proc = spawn([command, ...args], {
      stdout: 'pipe',
      stderr: 'pipe',
    });
    
    const stdout = await new Response(proc.stdout).text();
    const stderr = await new Response(proc.stderr).text();
    const exitCode = await proc.exited;
    
    return { stdout, stderr, exitCode };
  } catch (error) {
    return {
      stdout: '',
      stderr: error instanceof Error ? error.message : 'Unknown error',
      exitCode: 1,
    };
  }
}

/**
 * Parse the output of `launchctl list` command
 * Format: PID\tStatus\tLabel
 */
export function parseLaunchctlList(output: string): Array<{ pid: number | undefined; exitStatus: number | undefined; label: string }> {
  const lines = output.trim().split('\n');
  const services: Array<{ pid: number | undefined; exitStatus: number | undefined; label: string }> = [];
  
  // Skip header line
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    
    const parts = line.split('\t');
    if (parts.length >= 3) {
      const pid = parts[0] === '-' ? undefined : parseInt(parts[0], 10);
      const exitStatus = parts[1] === '-' ? undefined : parseInt(parts[1], 10);
      const label = parts[2];
      
      services.push({ pid, exitStatus, label });
    }
  }
  
  return services;
}

/**
 * Parse `launchctl print` output for detailed service info
 */
export function parseLaunchctlPrint(output: string): Record<string, string> {
  const info: Record<string, string> = {};
  const lines = output.split('\n');
  
  for (const line of lines) {
    const match = line.match(/^\s*([\w\s]+)\s*=\s*(.+)$/);
    if (match) {
      const key = match[1].trim().toLowerCase().replace(/\s+/g, '_');
      info[key] = match[2].trim();
    }
  }
  
  return info;
}

/**
 * Determine if a service is Apple/system owned
 */
export function isAppleService(label: string, plistPath?: string): boolean {
  if (label.startsWith('com.apple.')) return true;
  if (plistPath?.includes('/System/Library/')) return true;
  return false;
}

/**
 * Determine protection status
 */
export function getProtectionStatus(label: string, plistPath?: string): ProtectionStatus {
  // SIP protected paths
  if (plistPath?.startsWith('/System/')) return 'sip-protected';
  if (label.startsWith('com.apple.')) return 'system-owned';
  
  // Known immutable services
  const immutableServices = [
    'com.apple.SystemConfiguration',
    'com.apple.launchd',
    'com.apple.kextd',
  ];
  if (immutableServices.some(s => label.startsWith(s))) return 'immutable';
  
  return 'normal';
}

/**
 * Determine if root is required for an action
 */
export function requiresRoot(domain: ServiceDomain, plistPath?: string): boolean {
  if (domain === 'system') return true;
  if (plistPath?.startsWith('/Library/')) return true;
  if (plistPath?.startsWith('/System/')) return true;
  return false;
}

/**
 * Get service status from pid and exit status
 */
export function getServiceStatus(pid?: number, exitStatus?: number, enabled: boolean = true): ServiceStatus {
  if (!enabled) return 'disabled';
  if (pid !== undefined && pid > 0) return 'running';
  if (exitStatus !== undefined && exitStatus !== 0) return 'error';
  return 'stopped';
}

/**
 * List all services using launchctl
 * Uses different domains for comprehensive listing
 */
export async function listServices(): Promise<Service[]> {
  const services: Service[] = [];
  const domains: Array<{ domain: ServiceDomain; target: string; type: 'LaunchDaemon' | 'LaunchAgent' }> = [
    { domain: 'system', target: 'system', type: 'LaunchDaemon' },
    { domain: 'user', target: `user/${process.getuid?.() || 501}`, type: 'LaunchAgent' },
    { domain: 'gui', target: `gui/${process.getuid?.() || 501}`, type: 'LaunchAgent' },
  ];

  for (const { domain, target, type } of domains) {
    // Modern launchctl: launchctl print <domain>
    const result = await execCommand('launchctl', ['print', target]);
    
    if (result.exitCode === 0) {
      // Parse services from print output
      const serviceMatches = result.stdout.matchAll(/services\s*=\s*\{([^}]+)\}/gs);
      for (const match of serviceMatches) {
        const serviceBlock = match[1];
        const labelMatches = serviceBlock.matchAll(/"([^"]+)"\s*=>/g);
        
        for (const labelMatch of labelMatches) {
          const label = labelMatch[1];
          const service = await getServiceInfo(label, domain, type);
          if (service) {
            services.push(service);
          }
        }
      }
    } else {
      // Fallback to legacy list command
      const listResult = await execCommand('launchctl', ['list']);
      if (listResult.exitCode === 0) {
        const parsed = parseLaunchctlList(listResult.stdout);
        for (const { pid, exitStatus, label } of parsed) {
          const plistPath = await findPlistPath(label);
          const protection = getProtectionStatus(label, plistPath);
          const apple = isAppleService(label, plistPath);
          const needsRoot = requiresRoot(domain, plistPath);
          
          services.push({
            id: `${domain}-${label}`,
            label,
            displayName: label.split('.').pop() || label,
            type,
            domain,
            status: getServiceStatus(pid, exitStatus),
            pid,
            exitStatus,
            protection,
            plistPath,
            enabled: true,
            isAppleService: apple,
            requiresRoot: needsRoot,
          });
        }
      }
    }
  }

  return services;
}

/**
 * Get detailed info for a specific service
 */
export async function getServiceInfo(label: string, domain: ServiceDomain, type: 'LaunchDaemon' | 'LaunchAgent'): Promise<Service | null> {
  const target = domain === 'system' ? 'system' : `user/${process.getuid?.() || 501}`;
  const result = await execCommand('launchctl', ['print', `${target}/${label}`]);
  
  if (result.exitCode !== 0) {
    return null;
  }
  
  const info = parseLaunchctlPrint(result.stdout);
  const plistPath = info.path || await findPlistPath(label);
  const protection = getProtectionStatus(label, plistPath);
  const apple = isAppleService(label, plistPath);
  const needsRoot = requiresRoot(domain, plistPath);
  
  const pid = info.pid ? parseInt(info.pid, 10) : undefined;
  const exitStatus = info.last_exit_status ? parseInt(info.last_exit_status, 10) : undefined;
  const enabled = info.state !== 'disabled';
  
  return {
    id: `${domain}-${label}`,
    label,
    displayName: label.split('.').pop() || label,
    type,
    domain,
    status: getServiceStatus(pid, exitStatus, enabled),
    pid,
    exitStatus,
    protection,
    plistPath,
    enabled,
    isAppleService: apple,
    requiresRoot: needsRoot,
  };
}

/**
 * Find plist path for a service
 */
async function findPlistPath(label: string): Promise<string | undefined> {
  const searchDirs = [
    '/System/Library/LaunchDaemons',
    '/System/Library/LaunchAgents',
    '/Library/LaunchDaemons',
    '/Library/LaunchAgents',
    `${process.env.HOME}/Library/LaunchAgents`,
  ];
  
  for (const dir of searchDirs) {
    const path = `${dir}/${label}.plist`;
    try {
      const file = Bun.file(path);
      if (await file.exists()) {
        return path;
      }
    } catch {
      continue;
    }
  }
  
  return undefined;
}

/**
 * Execute a service action
 */
export async function executeServiceAction(
  action: ServiceAction,
  service: Service
): Promise<ActionResult> {
  // Check protection
  if (service.protection === 'sip-protected' || service.protection === 'immutable') {
    return {
      success: false,
      message: `Cannot ${action} service`,
      error: `Service is protected by System Integrity Protection`,
      sipProtected: true,
    };
  }
  
  const target = service.domain === 'system' 
    ? `system/${service.label}`
    : `gui/${process.getuid?.() || 501}/${service.label}`;
  
  let command: string[];
  
  switch (action) {
    case 'start':
      // kickstart with -k to force start
      command = ['launchctl', 'kickstart', '-k', target];
      break;
    case 'stop':
      // kill to stop
      command = ['launchctl', 'kill', 'SIGTERM', target];
      break;
    case 'enable':
      // enable service
      command = ['launchctl', 'enable', target];
      break;
    case 'disable':
      // disable service
      command = ['launchctl', 'disable', target];
      break;
    case 'unload':
      // bootout to unload
      command = ['launchctl', 'bootout', target];
      break;
    case 'reload':
      // kickstart with -k for reload behavior
      command = ['launchctl', 'kickstart', '-kp', target];
      break;
    default:
      return {
        success: false,
        message: `Unknown action: ${action}`,
        error: 'Invalid action specified',
      };
  }
  
  // Check if we need sudo
  if (service.requiresRoot) {
    // Insert sudo at the beginning
    command = ['sudo', ...command];
  }
  
  const result = await execCommand(command[0], command.slice(1));
  
  if (result.exitCode === 0) {
    return {
      success: true,
      message: `Successfully ${action}ed service: ${service.label}`,
    };
  } else {
    // Check for permission errors
    const isPermissionError = result.stderr.includes('Operation not permitted') ||
                              result.stderr.includes('Permission denied') ||
                              result.exitCode === 1;
    
    return {
      success: false,
      message: `Failed to ${action} service`,
      error: result.stderr || 'Unknown error',
      requiresRoot: isPermissionError && !service.requiresRoot,
    };
  }
}
