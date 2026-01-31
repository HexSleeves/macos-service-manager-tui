/**
 * Help Panel Component
 * Shows keyboard shortcuts and usage information
 */

import { useAppState } from '../hooks/useAppState';

interface ShortcutGroup {
  title: string;
  shortcuts: Array<{ key: string; description: string }>;
}

const SHORTCUT_GROUPS: ShortcutGroup[] = [
  {
    title: 'Navigation',
    shortcuts: [
      { key: '↑/k', description: 'Move selection up' },
      { key: '↓/j', description: 'Move selection down' },
      { key: 'g', description: 'Go to first service' },
      { key: 'G', description: 'Go to last service' },
      { key: 'Tab', description: 'Switch panel focus' },
    ],
  },
  {
    title: 'Search & Filter',
    shortcuts: [
      { key: '/', description: 'Focus search' },
      { key: 'ESC', description: 'Clear search / Cancel' },
      { key: 'f', description: 'Toggle filter panel' },
      { key: '1-4', description: 'Filter by type' },
      { key: 'a', description: 'Toggle Apple services' },
      { key: 'p', description: 'Toggle protected services' },
    ],
  },
  {
    title: 'Sorting',
    shortcuts: [
      { key: 's', description: 'Cycle sort field' },
      { key: 'S', description: 'Toggle sort direction' },
    ],
  },
  {
    title: 'Service Actions',
    shortcuts: [
      { key: 'Enter', description: 'Start service (if stopped)' },
      { key: 'x', description: 'Stop service' },
      { key: 'r', description: 'Reload service' },
      { key: 'd', description: 'Toggle enable/disable' },
      { key: 'u', description: 'Unload service' },
    ],
  },
  {
    title: 'General',
    shortcuts: [
      { key: 'R', description: 'Refresh service list' },
      { key: '?', description: 'Toggle this help' },
      { key: 'q/Ctrl+C', description: 'Quit' },
    ],
  },
];

export function HelpPanel() {
  const { state } = useAppState();
  
  if (!state.showHelp) {
    return null;
  }
  
  return (
    <box
      position="absolute"
      left={5}
      top={4}
      width={70}
      height={28}
      border
      borderColor="#3b82f6"
      backgroundColor="#111827"
      flexDirection="column"
    >
      {/* Header */}
      <box
        backgroundColor="#1e3a5f"
        paddingLeft={2}
        paddingRight={2}
        height={1}
        justifyContent="space-between"
        flexDirection="row"
      >
        <text fg="#60a5fa">
          <strong>Keyboard Shortcuts</strong>
        </text>
        <text fg="#6b7280">[?] to close</text>
      </box>
      
      {/* Shortcuts content */}
      <scrollbox flexGrow={1} padding={1}>
        {SHORTCUT_GROUPS.map((group, gi) => (
          <box key={group.title} flexDirection="column" marginBottom={1}>
            <text fg="#fbbf24">
              <strong>{group.title}</strong>
            </text>
            {group.shortcuts.map(({ key, description }, si) => (
              <box key={`${gi}-${si}`} flexDirection="row" paddingLeft={2}>
                <box width={12}>
                  <text fg="#60a5fa">{key}</text>
                </box>
                <text fg="#9ca3af">{description}</text>
              </box>
            ))}
          </box>
        ))}
        
        {/* Status legend */}
        <box flexDirection="column" marginTop={1}>
          <text fg="#fbbf24">
            <strong>Status Indicators</strong>
          </text>
          <box flexDirection="row" paddingLeft={2} gap={3}>
            <text><span fg="#22c55e">●</span> Running</text>
            <text><span fg="#6b7280">○</span> Stopped</text>
            <text><span fg="#eab308">◌</span> Disabled</text>
            <text><span fg="#ef4444">✕</span> Error</text>
          </box>
        </box>
        
        {/* Protection legend */}
        <box flexDirection="column" marginTop={1}>
          <text fg="#fbbf24">
            <strong>Protection Indicators</strong>
          </text>
          <box flexDirection="row" paddingLeft={2} gap={3}>
            <text>🔒 SIP Protected</text>
            <text>⚙ System-owned</text>
            <text>🛡 Immutable</text>
          </box>
        </box>
        
        {/* Info */}
        <box marginTop={2} padding={1} backgroundColor="#1f2937">
          <text fg="#9ca3af">
            Note: Actions on protected services are blocked by macOS security.
            System extensions must be managed through System Preferences.
          </text>
        </box>
      </scrollbox>
    </box>
  );
}
