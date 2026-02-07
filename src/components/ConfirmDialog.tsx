/**
 * Confirmation Dialog Component
 * For confirming destructive actions
 */

import { COLORS } from "../constants";
import { useAppStore } from "../store/useAppStore";
import { useFilteredServices, useSelectedService } from "../store/useDerivedState";

export function ConfirmDialog() {
	const { filteredServices } = useFilteredServices();
	const selectedService = useSelectedService(filteredServices);
	const executingAction = useAppStore((state) => state.executingAction);
	const showConfirm = useAppStore((state) => state.showConfirm);
	const pendingAction = useAppStore((state) => state.pendingAction);
	const dryRun = useAppStore((state) => state.dryRun);

	// Show executing overlay
	if (executingAction && pendingAction && selectedService) {
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
					borderColor={COLORS.textAccent}
					backgroundColor={COLORS.bgSecondary}
					padding={2}
					flexDirection="column"
					alignItems="center"
					gap={1}
				>
					<text fg={COLORS.textAccent}>
						<strong>⏳ Executing...</strong>
					</text>
					<box marginTop={1}>
						<text fg={COLORS.textTertiary}>
							{pendingAction} → {selectedService.label}
						</text>
					</box>
					<box marginTop={1}>
						<text fg={COLORS.textMuted}>Please wait...</text>
					</box>
				</box>
			</box>
		);
	}

	if (!showConfirm || !pendingAction || !selectedService) {
		return null;
	}

	const action = pendingAction;
	const service = selectedService;
	const isDestructive = ["stop", "unload", "disable"].includes(action);
	const isDryRun = dryRun;

	// Determine border color: orange for dry-run, red for destructive, blue otherwise
	const borderColor = isDryRun ? COLORS.textOrange : isDestructive ? COLORS.textError : COLORS.bgFocus;
	const titleColor = isDryRun ? COLORS.textOrange : isDestructive ? COLORS.textError : COLORS.textAccent;

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
				backgroundColor={COLORS.bgSecondary}
				padding={2}
				flexDirection="column"
				gap={1}
			>
				<text fg={titleColor}>
					<strong>{isDryRun ? "🔍 DRY RUN - Preview Action" : "⚠ Confirm Action"}</strong>
				</text>

				{isDryRun && (
					<box marginTop={1} padding={1} backgroundColor={COLORS.bgWarningLight}>
						<text fg={COLORS.textWarning}>Dry-run mode: This will show the command without executing it</text>
					</box>
				)}

				<box marginTop={1}>
					<text fg={COLORS.textSecondary}>
						{isDryRun ? "Preview" : "Are you sure you want to"}{" "}
						<span fg={isDestructive ? COLORS.textError : COLORS.textSuccess}>{action}</span>
						{isDryRun ? " for this service:" : " this service?"}
					</text>
				</box>

				<box marginTop={1} padding={1} backgroundColor={COLORS.bgPrimary}>
					<text fg={COLORS.textTertiary}>{service.label}</text>
				</box>

				{service.requiresRoot && (
					<box marginTop={1}>
						<text fg={COLORS.textWarning}>🔑 This action requires administrator privileges.</text>
					</box>
				)}

				{isDestructive && !isDryRun && (
					<box marginTop={1}>
						<text fg={COLORS.textDanger}>This may affect system stability or running applications.</text>
					</box>
				)}

				<box flexDirection="row" gap={4} marginTop={2} justifyContent="center">
					<box
						backgroundColor={isDryRun ? COLORS.bgAmber : COLORS.textSuccess}
						paddingLeft={2}
						paddingRight={2}
					>
						<text fg={COLORS.textPrimary}>[Enter] {isDryRun ? "Show Command" : "Confirm"}</text>
					</box>
					<box backgroundColor={COLORS.bgTertiary} paddingLeft={2} paddingRight={2}>
						<text fg={COLORS.textPrimary}>[ESC] Cancel</text>
					</box>
				</box>
			</box>
		</box>
	);
}
