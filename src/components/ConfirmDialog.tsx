/**
 * Confirmation Dialog Component
 * For confirming destructive actions
 */

import { useAppState } from "../hooks/useAppState";

export function ConfirmDialog() {
	const { state, selectedService } = useAppState();

	// Show executing overlay
	if (state.executingAction && state.pendingAction && selectedService) {
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
					width={50}
					border
					borderColor="#60a5fa"
					backgroundColor="#1f2937"
					padding={2}
					flexDirection="column"
					alignItems="center"
					gap={1}
				>
					<text fg="#60a5fa">
						<strong>⏳ Executing...</strong>
					</text>
					<box marginTop={1}>
						<text fg="#9ca3af">
							{state.pendingAction} → {selectedService.label}
						</text>
					</box>
					<box marginTop={1}>
						<text fg="#6b7280">Please wait...</text>
					</box>
				</box>
			</box>
		);
	}

	if (!state.showConfirm || !state.pendingAction || !selectedService) {
		return null;
	}

	const action = state.pendingAction;
	const service = selectedService;
	const isDestructive = ["stop", "unload", "disable"].includes(action);
	const isDryRun = state.dryRun;

	// Determine border color: orange for dry-run, red for destructive, blue otherwise
	const borderColor = isDryRun
		? "#f97316"
		: isDestructive
			? "#ef4444"
			: "#3b82f6";
	const titleColor = isDryRun
		? "#f97316"
		: isDestructive
			? "#ef4444"
			: "#60a5fa";

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
				width={70}
				border
				borderColor={borderColor}
				backgroundColor="#1f2937"
				padding={2}
				flexDirection="column"
				gap={1}
			>
				<text fg={titleColor}>
					<strong>
						{isDryRun ? "🔍 DRY RUN - Preview Action" : "⚠ Confirm Action"}
					</strong>
				</text>

				{isDryRun && (
					<box marginTop={1} padding={1} backgroundColor="#78350f">
						<text fg="#fbbf24">
							Dry-run mode: This will show the command without executing it
						</text>
					</box>
				)}

				<box marginTop={1}>
					<text fg="#e5e7eb">
						{isDryRun ? "Preview" : "Are you sure you want to"}{" "}
						<span fg={isDestructive ? "#ef4444" : "#22c55e"}>{action}</span>
						{isDryRun ? " for this service:" : " this service?"}
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

				{isDestructive && !isDryRun && (
					<box marginTop={1}>
						<text fg="#f87171">
							This may affect system stability or running applications.
						</text>
					</box>
				)}

				<box flexDirection="row" gap={4} marginTop={2} justifyContent="center">
					<box
						backgroundColor={isDryRun ? "#b45309" : "#22c55e"}
						paddingLeft={2}
						paddingRight={2}
					>
						<text fg="#ffffff">
							[Enter] {isDryRun ? "Show Command" : "Confirm"}
						</text>
					</box>
					<box backgroundColor="#374151" paddingLeft={2} paddingRight={2}>
						<text fg="#ffffff">[ESC] Cancel</text>
					</box>
				</box>
			</box>
		</box>
	);
}
