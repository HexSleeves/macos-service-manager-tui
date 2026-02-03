/**
 * Password Input Dialog for sudo authentication
 * Used when running in SSH/headless context where osascript won't work
 */

import { useAppStore } from "../store/useAppStore";

export function PasswordDialog() {
	const showPasswordDialog = useAppStore((state) => state.showPasswordDialog);
	const passwordDialogError = useAppStore((state) => state.passwordDialogError);
	const pendingPrivilegedAction = useAppStore((state) => state.pendingPrivilegedAction);
	const passwordInput = useAppStore((state) => state.passwordInput);

	// Render nothing if not visible
	if (!showPasswordDialog) {
		return null;
	}

	// Get action description
	const actionName = pendingPrivilegedAction?.action ?? "perform action";
	const serviceName = pendingPrivilegedAction?.service?.label ?? "service";

	// Mask password with dots
	const maskedPassword = "•".repeat(passwordInput.length);

	return (
		<box
			position="absolute"
			left={0}
			top={0}
			right={0}
			bottom={0}
			justifyContent="center"
			alignItems="center"
		>
			<box
				width={60}
				border
				borderColor="#f59e0b"
				backgroundColor="#1f2937"
				padding={2}
				flexDirection="column"
				gap={1}
			>
				{/* Title */}
				<text fg="#f59e0b">
					<strong>🔐 Administrator Password Required</strong>
				</text>

				{/* Action description */}
				<box marginTop={1}>
					<text fg="#e5e7eb">
						To <span fg="#22c55e">{actionName}</span> the service:
					</text>
				</box>

				{/* Service name */}
				<box padding={1} backgroundColor="#111827">
					<text fg="#9ca3af">{serviceName}</text>
				</box>

				{/* Error message if present */}
				{passwordDialogError && (
					<box marginTop={1} padding={1} backgroundColor="#7f1d1d">
						<text fg="#fca5a5">❌ {passwordDialogError}</text>
					</box>
				)}

				{/* Password prompt */}
				<box marginTop={1}>
					<text fg="#9ca3af">Enter your password:</text>
				</box>

				{/* Password input field (masked) */}
				<box
					border
					borderColor="#4b5563"
					backgroundColor="#111827"
					paddingLeft={1}
					paddingRight={1}
					height={3}
					alignItems="center"
				>
					<text fg="#e5e7eb">
						{maskedPassword}
						<span fg="#f59e0b">█</span>
					</text>
				</box>

				{/* Instructions */}
				<box flexDirection="row" gap={4} marginTop={2} justifyContent="center">
					<box backgroundColor="#22c55e" paddingLeft={2} paddingRight={2}>
						<text fg="#ffffff">[Enter] Submit</text>
					</box>
					<box backgroundColor="#374151" paddingLeft={2} paddingRight={2}>
						<text fg="#ffffff">[ESC] Cancel</text>
					</box>
				</box>
			</box>
		</box>
	);
}
