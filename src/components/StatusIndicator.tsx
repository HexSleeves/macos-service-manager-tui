/**
 * Status Indicator Component
 * Visual indicators for service status
 */

import type { ServiceStatus, ProtectionStatus } from '../types';

interface StatusIndicatorProps {
  status: ServiceStatus;
  protection?: ProtectionStatus;
  compact?: boolean;
}

const STATUS_COLORS: Record<ServiceStatus, string> = {
  running: '#22c55e',     // Green
  stopped: '#6b7280',     // Gray
  disabled: '#eab308',    // Yellow
  error: '#ef4444',       // Red
  unknown: '#8b5cf6',     // Purple
};

const STATUS_SYMBOLS: Record<ServiceStatus, string> = {
  running: '●',
  stopped: '○',
  disabled: '◌',
  error: '✕',
  unknown: '?',
};

const PROTECTION_SYMBOLS: Record<ProtectionStatus, string> = {
  normal: '',
  'sip-protected': '🔒',
  'system-owned': '⚙',
  immutable: '🛡',
};

export function StatusIndicator({ status, protection, compact = false }: StatusIndicatorProps) {
  const color = STATUS_COLORS[status];
  const symbol = STATUS_SYMBOLS[status];
  const protectionSymbol = protection ? PROTECTION_SYMBOLS[protection] : '';
  
  if (compact) {
    return (
      <text fg={color}>
        {symbol}{protectionSymbol}
      </text>
    );
  }
  
  return (
    <box flexDirection="row" gap={1}>
      <text fg={color}>{symbol}</text>
      <text fg={color}>{status}</text>
      {protectionSymbol && <text>{protectionSymbol}</text>}
    </box>
  );
}

export function getStatusColor(status: ServiceStatus): string {
  return STATUS_COLORS[status];
}

export function getStatusSymbol(status: ServiceStatus): string {
  return STATUS_SYMBOLS[status];
}

export function getProtectionSymbol(protection: ProtectionStatus): string {
  return PROTECTION_SYMBOLS[protection];
}
