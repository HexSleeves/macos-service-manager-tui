/**
 * Password Input Dialog for sudo authentication
 * Used when running in SSH/headless context where osascript won't work
 */

import { COLORS } from "../constants";
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
				borderColor={COLORS.textAmber}
				backgroundColor={COLORS.bgSecondary}
				padding={2}
				flexDirection="column"
				gap={1}
			>
				{/* Title */}
				<text fg={COLORS.textAmber}>
					<strong>🔐 Administrator Password Required</strong>
				</text>

				{/* Action description */}
				<box marginTop={1}>
					<text fg={COLORS.textSecondary}>
						To <span fg={COLORS.textSuccess}>{actionName}</span> the service:
					</text>
				</box>

				{/* Service name */}
				<box padding={1} backgroundColor={COLORS.bgPrimary}>
					<text fg={COLORS.textTertiary}>{serviceName}</text>
				</box>

				{/* Error message if present */}
				{passwordDialogError && (
					<box marginTop={1} padding={1} backgroundColor={COLORS.bgWarning}>
						<text fg={COLORS.textWarningLight}>❌ {passwordDialogError}</text>
					</box>
				)}

				{/* Password prompt */}
				<box marginTop={1}>
					<text fg={COLORS.textTertiary}>Enter your password:</text>
				</box>

				{/* Password input field (masked) */}
				<box
					border
					borderColor={COLORS.borderMuted}
					backgroundColor={COLORS.bgPrimary}
					paddingLeft={1}
					paddingRight={1}
					height={3}
					alignItems="center"
				>
					<text fg={COLORS.textSecondary}>
						{maskedPassword}
						<span fg={COLORS.textAmber}>█</span>
					</text>
				</box>

				{/* Instructions */}
				<box flexDirection="row" gap={4} marginTop={2} justifyContent="center">
					<box backgroundColor={COLORS.textSuccess} paddingLeft={2} paddingRight={2}>
						<text fg={COLORS.textPrimary}>[Enter] Submit</text>
					</box>
					<box backgroundColor={COLORS.bgTertiary} paddingLeft={2} paddingRight={2}>
						<text fg={COLORS.textPrimary}>[ESC] Cancel</text>
					</box>
				</box>
			</box>
		</box>
	);
}
