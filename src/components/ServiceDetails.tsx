/**
 * Service Details Component
 * Shows detailed information about the selected service
 */

import { useAppState } from "../hooks/useAppState";
import type { SystemExtension } from "../types";
import { StatusIndicator } from "./StatusIndicator";

function DetailRow({
	label,
	value,
	color,
}: {
	label: string;
	value?: string | number;
	color?: string;
}) {
	if (value === undefined || value === null) return null;

	return (
		<box flexDirection="row" paddingLeft={1}>
			<box width={14}>
				<text fg="#6b7280">{label}:</text>
			</box>
			<box flexGrow={1}>
				<text fg={color || "#e5e7eb"}>{String(value)}</text>
			</box>
		</box>
	);
}

function ActionButton({
	label,
	shortcut,
	disabled,
	warning,
}: {
	label: string;
	shortcut: string;
	disabled?: boolean;
	warning?: boolean;
}) {
	const bgColor = disabled ? "#374151" : warning ? "#7f1d1d" : "#1e40af";
	const fgColor = disabled ? "#6b7280" : "#ffffff";

	return (
		<box backgroundColor={bgColor} paddingLeft={1} paddingRight={1}>
			<text fg={fgColor}>
				[{shortcut}] {label}
			</text>
		</box>
	);
}

export function ServiceDetails() {
	const { state, selectedService } = useAppState();

	if (!selectedService) {
		return (
			<box
				width={40}
				border
				borderColor="#374151"
				padding={1}
				justifyContent="center"
				alignItems="center"
			>
				<text fg="#6b7280">No service selected</text>
			</box>
		);
	}

	const service = selectedService;
	const isProtected = service.protection !== "normal";
	const isRunning = service.status === "running";
	const isSystemExt = service.type === "SystemExtension";

	// Cast for system extension properties
	const sysExt =
		service.type === "SystemExtension" ? (service as SystemExtension) : null;

	return (
		<box
			width={45}
			border
			borderColor={state.focusedPanel === "details" ? "#3b82f6" : "#374151"}
			flexDirection="column"
		>
			{/* Header */}
			<box
				backgroundColor="#1e3a5f"
				paddingLeft={1}
				paddingRight={1}
				height={1}
			>
				<text fg="#60a5fa">
					<strong>Service Details</strong>
				</text>
			</box>

			{/* Service name */}
			<box paddingLeft={1} paddingTop={1}>
				<text fg="#ffffff">
					<strong>{service.displayName}</strong>
				</text>
			</box>

			{/* Status */}
			<box paddingLeft={1} paddingTop={1}>
				<StatusIndicator
					status={service.status}
					protection={service.protection}
				/>
			</box>

			{/* Basic info */}
			<box flexDirection="column" paddingTop={1}>
				<DetailRow label="Label" value={service.label} />
				<DetailRow label="Type" value={service.type} />
				<DetailRow label="Domain" value={service.domain} />
				<DetailRow label="PID" value={service.pid} color="#22c55e" />
				<DetailRow
					label="Exit Status"
					value={service.exitStatus}
					color={service.exitStatus !== 0 ? "#ef4444" : undefined}
				/>
				<DetailRow
					label="Enabled"
					value={service.enabled ? "Yes" : "No"}
					color={service.enabled ? "#22c55e" : "#ef4444"}
				/>
				<DetailRow label="Plist Path" value={service.plistPath} />
				<DetailRow label="Description" value={service.description} />
				{service.lastError && (
					<DetailRow
						label="Last Error"
						value={service.lastError}
						color="#ef4444"
					/>
				)}

				{/* System Extension specific */}
				{sysExt && (
					<>
						<DetailRow label="Bundle ID" value={sysExt.bundleId} />
						<DetailRow label="Team ID" value={sysExt.teamId} />
						<DetailRow label="Version" value={sysExt.version} />
						<DetailRow label="State" value={sysExt.state} />
						<DetailRow
							label="Categories"
							value={sysExt.categories?.join(", ")}
						/>
					</>
				)}
			</box>

			{/* Protection notice */}
			{isProtected && (
				<box
					marginTop={1}
					marginLeft={1}
					marginRight={1}
					padding={1}
					backgroundColor="#7f1d1d"
				>
					<text fg="#fca5a5">
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
				<box
					marginTop={1}
					marginLeft={1}
					marginRight={1}
					padding={1}
					backgroundColor="#78350f"
				>
					<text fg="#fcd34d">🔑 Requires administrator privileges</text>
				</box>
			)}

			{/* Actions */}
			{!isSystemExt && (
				<box
					flexDirection="column"
					gap={1}
					paddingTop={1}
					paddingLeft={1}
					paddingBottom={1}
				>
					<text fg="#9ca3af">Actions:</text>
					<box flexDirection="row" flexWrap="wrap" gap={1}>
						{!isRunning && (
							<ActionButton label="Start" shortcut="s" disabled={isProtected} />
						)}
						{isRunning && (
							<ActionButton
								label="Stop"
								shortcut="x"
								disabled={isProtected}
								warning
							/>
						)}
						{isRunning && (
							<ActionButton
								label="Reload"
								shortcut="r"
								disabled={isProtected}
							/>
						)}
						<ActionButton
							label={service.enabled ? "Disable" : "Enable"}
							shortcut="d"
							disabled={isProtected}
						/>
						<ActionButton
							label="Unload"
							shortcut="u"
							disabled={isProtected}
							warning
						/>
					</box>
				</box>
			)}

			{isSystemExt && (
				<box padding={1}>
					<text fg="#6b7280">
						System extensions are managed through System Preferences or the
						parent application.
					</text>
				</box>
			)}
		</box>
	);
}
