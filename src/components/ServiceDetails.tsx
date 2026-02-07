/**
 * Service Details Component
 * Shows detailed information about the selected service
 */

import { COLORS } from "../constants";
import { useAppStore } from "../store/useAppStore";
import { useFilteredServices, useSelectedService } from "../store/useDerivedState";
import type { SystemExtension } from "../types";
import { StatusIndicator } from "./StatusIndicator";

function DetailRow({ label, value, color }: { label: string; value?: string | number; color?: string }) {
	if (value === undefined || value === null) return null;

	return (
		<box flexDirection="row" paddingLeft={1}>
			<box width={14}>
				<text fg={COLORS.textMuted}>{label}:</text>
			</box>
			<box flexGrow={1}>
				<text fg={color || COLORS.textSecondary}>{String(value)}</text>
			</box>
		</box>
	);
}

function ActionButton({
	label,
	shortcut,
	disabled,
	warning,
	offline,
}: {
	label: string;
	shortcut: string;
	disabled?: boolean;
	warning?: boolean;
	offline?: boolean;
}) {
	const isDisabled = disabled || offline;
	const bgColor = isDisabled ? COLORS.bgTertiary : warning ? COLORS.bgWarning : COLORS.bgAction;
	const fgColor = isDisabled ? COLORS.textMuted : COLORS.textPrimary;

	return (
		<box backgroundColor={bgColor} paddingLeft={1} paddingRight={1}>
			<text fg={fgColor}>
				[{shortcut}] {label}
				{offline && !disabled ? " (offline)" : ""}
			</text>
		</box>
	);
}

export function ServiceDetails() {
	const { filteredServices } = useFilteredServices();
	const selectedService = useSelectedService(filteredServices);
	const focusedPanel = useAppStore((state) => state.focusedPanel);
	const offline = useAppStore((state) => state.offline);
	const metadataLoading = useAppStore((state) => state.metadataLoading);

	if (!selectedService) {
		return (
			<box
				width={40}
				border
				borderColor={COLORS.bgTertiary}
				padding={1}
				justifyContent="center"
				alignItems="center"
			>
				<text fg={COLORS.textMuted}>No service selected</text>
			</box>
		);
	}

	const service = selectedService;
	const isProtected = service.protection !== "normal";
	const isRunning = service.status === "running";
	const isSystemExt = service.type === "SystemExtension";
	const isOffline = offline.isOffline;

	// Check if metadata is loading
	const metadataState = metadataLoading[service.id];
	const isLoadingMetadata = metadataState?.loading ?? false;
	const metadataError = metadataState?.error;

	// Cast for system extension properties
	const sysExt = service.type === "SystemExtension" ? (service as SystemExtension) : null;

	return (
		<box
			width={45}
			border
			borderColor={focusedPanel === "details" ? COLORS.bgFocus : COLORS.bgTertiary}
			flexDirection="column"
		>
			{/* Header */}
			<box backgroundColor={COLORS.bgHeader} paddingLeft={1} paddingRight={1} height={1}>
				<text fg={COLORS.textAccent}>
					{focusedPanel === "details" && <span fg={COLORS.bgFocus}>▶ </span>}
					<strong>Service Details</strong>
				</text>
			</box>

			{/* Service name */}
			<box paddingLeft={1} paddingTop={1}>
				<text fg={COLORS.textPrimary}>
					<strong>{service.displayName}</strong>
				</text>
			</box>

			{/* Status */}
			<box paddingLeft={1} paddingTop={1}>
				<StatusIndicator status={service.status} protection={service.protection} />
			</box>

			{/* Basic info */}
			<box flexDirection="column" paddingTop={1}>
				<DetailRow label="Label" value={service.label} />
				<DetailRow label="Type" value={service.type} />
				<DetailRow label="Domain" value={service.domain} />
				<DetailRow label="PID" value={service.pid} color={COLORS.textSuccess} />
				<DetailRow
					label="Exit Status"
					value={service.exitStatus}
					color={service.exitStatus !== 0 ? COLORS.textError : undefined}
				/>
				<DetailRow
					label="Enabled"
					value={service.enabled ? "Yes" : "No"}
					color={service.enabled ? COLORS.textSuccess : COLORS.textError}
				/>
				{isLoadingMetadata && (
					<box paddingLeft={1}>
						<text fg={COLORS.textMuted}>Loading metadata...</text>
					</box>
				)}
				{metadataError && (
					<box paddingLeft={1}>
						<text fg={COLORS.textError}>Failed to load metadata: {metadataError}</text>
					</box>
				)}
				<DetailRow label="Plist Path" value={service.plistPath} />
				<DetailRow label="Description" value={service.description} />
				{service.lastError && (
					<DetailRow label="Last Error" value={service.lastError} color={COLORS.textError} />
				)}

				{/* System Extension specific */}
				{sysExt && (
					<>
						<DetailRow label="Bundle ID" value={sysExt.bundleId} />
						<DetailRow label="Team ID" value={sysExt.teamId} />
						<DetailRow label="Version" value={sysExt.version} />
						<DetailRow label="State" value={sysExt.state} />
						<DetailRow label="Categories" value={sysExt.categories?.join(", ")} />
					</>
				)}
			</box>

			{/* Protection notice */}
			{isProtected && (
				<box marginTop={1} marginLeft={1} marginRight={1} padding={1} backgroundColor={COLORS.bgWarning}>
					<text fg={COLORS.textWarningLight}>
						⚠{" "}
						{service.protection === "sip-protected"
							? "Protected by System Integrity Protection"
							: service.protection === "immutable"
								? "This service cannot be modified"
								: "System-owned service"}
					</text>
				</box>
			)}

			{/* Root notice */}
			{service.requiresRoot && !isProtected && (
				<box marginTop={1} marginLeft={1} marginRight={1} padding={1} backgroundColor={COLORS.bgWarningLight}>
					<text fg={COLORS.textWarningYellow}>🔑 Requires administrator privileges</text>
				</box>
			)}

			{/* Offline notice */}
			{isOffline && !isSystemExt && (
				<box marginTop={1} marginLeft={1} marginRight={1} padding={1} backgroundColor={COLORS.bgTertiary}>
					<text fg={COLORS.textTertiary}>⚡ Actions unavailable - offline mode</text>
				</box>
			)}

			{/* Actions */}
			{!isSystemExt && (
				<box flexDirection="column" gap={1} paddingTop={1} paddingLeft={1} paddingBottom={1}>
					<text fg={COLORS.textTertiary}>Actions:</text>
					<box flexDirection="row" flexWrap="wrap" gap={1}>
						{!isRunning && (
							<ActionButton label="Start" shortcut="Enter" disabled={isProtected} offline={isOffline} />
						)}
						{isRunning && (
							<ActionButton label="Stop" shortcut="x" disabled={isProtected} offline={isOffline} warning />
						)}
						{isRunning && (
							<ActionButton label="Reload" shortcut="r" disabled={isProtected} offline={isOffline} />
						)}
						<ActionButton
							label={service.enabled ? "Disable" : "Enable"}
							shortcut="d"
							disabled={isProtected}
							offline={isOffline}
						/>
						<ActionButton label="Unload" shortcut="u" disabled={isProtected} offline={isOffline} warning />
						{service.plistPath && <ActionButton label="Edit" shortcut="e" disabled={false} />}
					</box>
				</box>
			)}

			{isSystemExt && (
				<box padding={1}>
					<text fg={COLORS.textMuted}>
						System extensions are managed through System Preferences or the parent application.
					</text>
				</box>
			)}
		</box>
	);
}
