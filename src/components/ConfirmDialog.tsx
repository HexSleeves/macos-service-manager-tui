/**
 * Confirmation Dialog Component
 * For confirming destructive actions
 */

import { useAppState } from "../hooks/useAppState";

export function ConfirmDialog() {
	const { state, selectedService } = useAppState();

	if (!state.showConfirm || !state.pendingAction || !selectedService) {
		return null;
	}

	const action = state.pendingAction;
	const service = selectedService;
	const isDestructive = ["stop", "unload", "disable"].includes(action);

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
				borderColor={isDestructive ? "#ef4444" : "#3b82f6"}
				backgroundColor="#1f2937"
				padding={2}
				flexDirection="column"
				gap={1}
			>
				<text fg={isDestructive ? "#ef4444" : "#60a5fa"}>
					<strong>⚠ Confirm Action</strong>
				</text>

				<box marginTop={1}>
					<text fg="#e5e7eb">
						Are you sure you want to{" "}
						<span fg={isDestructive ? "#ef4444" : "#22c55e"}>{action}</span> this
						service?
					</text>
				</box>

				<box marginTop={1} padding={1} backgroundColor="#111827">
					<text fg="#9ca3af">{service.label}</text>
				</box>

				{service.requiresRoot && (
					<box marginTop={1}>
						<text fg="#fbbf24">
							🔑 This action requires administrator privileges.
						</text>
					</box>
				)}

				{isDestructive && (
					<box marginTop={1}>
						<text fg="#f87171">
							This may affect system stability or running applications.
						</text>
					</box>
				)}

				<box flexDirection="row" gap={4} marginTop={2} justifyContent="center">
					<box backgroundColor="#22c55e" paddingLeft={2} paddingRight={2}>
						<text fg="#ffffff">[Enter] Confirm</text>
					</box>
					<box backgroundColor="#374151" paddingLeft={2} paddingRight={2}>
						<text fg="#ffffff">[ESC] Cancel</text>
					</box>
				</box>
			</box>
		</box>
	);
}
