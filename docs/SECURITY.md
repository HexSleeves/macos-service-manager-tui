# Security & Permissions

## System Integrity Protection (SIP)

macOS System Integrity Protection prevents modification of protected system files and services.

### Protected Paths

```
/System/Library/LaunchDaemons/
/System/Library/LaunchAgents/
/System/Library/Extensions/
```

### Impact on This Tool

1. **Cannot start/stop/modify** services with plists in `/System/`
2. **Cannot unload** Apple system services
3. **Read-only access** to service metadata

### UI Indicators

- 🔒 **SIP Protected**: Service plist is in System directory
- 🛡 **Immutable**: Critical system service that cannot be modified
- ⚙ **System-owned**: Apple service (may have restrictions)

## Privilege Levels

### User-Level Operations (No sudo)

```bash
# User LaunchAgents in ~/Library/LaunchAgents/
launchctl load ~/Library/LaunchAgents/com.user.myservice.plist
launchctl unload ~/Library/LaunchAgents/com.user.myservice.plist
```

### System-Level Operations (Requires sudo)

```bash
# System LaunchDaemons in /Library/LaunchDaemons/
sudo launchctl load /Library/LaunchDaemons/com.example.daemon.plist
sudo launchctl unload /Library/LaunchDaemons/com.example.daemon.plist
```

### Domain Reference

| Domain | Description | Requires Root |
|--------|-------------|---------------|
| `system` | System-wide daemons | Yes |
| `user/<uid>` | Per-user agents | No (if own user) |
| `gui/<uid>` | Per-login-session agents | No (if own session) |

## System Extensions Security

### About System Extensions

System Extensions (introduced in macOS 10.15) replace kernel extensions with user-space alternatives:

- **Network Extensions**: VPNs, content filters
- **Endpoint Security**: Antivirus, EDR
- **Driver Extensions**: USB, storage drivers

### Security Model

1. **User Approval Required**: System Preferences > Security & Privacy
2. **Team ID Validation**: Must be signed by valid Developer ID
3. **Cannot be loaded directly**: Must be installed through parent app

### Management

```bash
# List system extensions (read-only)
systemextensionsctl list

# Uninstall (requires app or System Preferences)
# Cannot be done directly via command line
```

### UI Behavior

This tool:
- ✅ Lists all installed system extensions
- ✅ Shows status, team ID, version
- ❌ Does NOT provide start/stop/unload actions
- ❌ Does NOT bypass user approval requirements

## Permission Error Handling

### Common Errors

| Error | Meaning | Resolution |
|-------|---------|------------|
| `Operation not permitted` | Root required or SIP blocked | Use sudo or accept limitation |
| `Permission denied` | Insufficient privileges | Check file permissions |
| `Could not find specified service` | Service not loaded | Load the service first |
| `Service cannot be stopped` | Running on demand | Stop requesting processes |

### Error Recovery

```typescript
async function handleActionError(error: string): ActionResult {
  if (error.includes('Operation not permitted')) {
    return {
      success: false,
      message: 'Operation blocked',
      error: 'This service is protected by SIP or requires root privileges',
      sipProtected: true,
    };
  }
  
  if (error.includes('Could not find')) {
    return {
      success: false,
      message: 'Service not found',
      error: 'The service may have been unloaded or the plist removed',
    };
  }
  
  return {
    success: false,
    message: 'Action failed',
    error: error,
  };
}
```

## Best Practices

### For Users

1. **Understand what you're modifying**: Research unfamiliar services before stopping
2. **Start with user services**: Test changes on user agents before system daemons
3. **Keep backups**: Copy plist files before unloading
4. **Check dependencies**: Some apps require their daemons to function

### For Developers

1. **Never attempt SIP bypass**: It won't work and shouldn't work
2. **Fail gracefully**: Provide clear error messages
3. **Confirm destructive actions**: Always prompt before stop/unload
4. **Respect user intent**: Don't auto-modify without explicit request

## Limitations

### What This Tool Cannot Do

1. **Modify SIP-protected services** - By design
2. **Install system extensions** - Requires app bundle
3. **Bypass authentication** - Respects macOS security
4. **Access other users' services** - Only current user domain

### Known Edge Cases

1. **On-demand services**: May restart automatically after stop
2. **Dependent services**: Stopping one may affect others
3. **KeepAlive services**: Will restart immediately unless disabled
4. **Socket-activated services**: Start when socket receives connection
