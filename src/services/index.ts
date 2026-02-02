/**
 * Unified Service Discovery
 * Combines launchctl and systemextensionsctl services
 */

import type {
	ActionResult,
	FilterOptions,
	Service,
	ServiceAction,
	SortField,
	SortOptions,
} from "../types";
import {
	executeServiceAction,
	listServices as listLaunchServices,
} from "./launchctl";
import { getMockServices } from "./mock";
import { listSystemExtensions } from "./systemextensions";

/**
 * Check if running on macOS
 */
export function isMacOS(): boolean {
	return process.platform === "darwin";
}

/**
 * Fetch all services from the system
 */
export async function fetchAllServices(): Promise<Service[]> {
	if (!isMacOS()) {
		// Return mock data for non-macOS systems (development/testing)
		console.log("Not running on macOS - using mock data");
		return getMockServices();
	}

	const [launchServices, systemExtensions] = await Promise.all([
		listLaunchServices(),
		listSystemExtensions(),
	]);

	// Combine and deduplicate
	const allServices = [...launchServices, ...systemExtensions];

	// Sort by label by default
	return allServices.sort((a, b) => a.label.localeCompare(b.label));
}

/**
 * Filter services based on filter options
 */
export function filterServices(
	services: Service[],
	filter: FilterOptions,
	searchQuery: string,
): Service[] {
	return services.filter((service) => {
		// Search filter
		if (searchQuery) {
			const query = searchQuery.toLowerCase();
			const matchesSearch =
				service.label.toLowerCase().includes(query) ||
				service.displayName.toLowerCase().includes(query) ||
				(service.description?.toLowerCase().includes(query) ?? false);
			if (!matchesSearch) return false;
		}

		// Type filter
		if (filter.type !== "all" && service.type !== filter.type) {
			return false;
		}

		// Domain filter
		if (filter.domain !== "all" && service.domain !== filter.domain) {
			return false;
		}

		// Status filter
		if (filter.status !== "all" && service.status !== filter.status) {
			return false;
		}

		// Apple services filter
		if (!filter.showAppleServices && service.isAppleService) {
			return false;
		}

		// Protected services filter
		if (!filter.showProtected && service.protection !== "normal") {
			return false;
		}

		return true;
	});
}

/**
 * Sort services based on sort options
 */
export function sortServices(
	services: Service[],
	sort: SortOptions,
): Service[] {
	const sorted = [...services];

	sorted.sort((a, b) => {
		let comparison = 0;

		switch (sort.field) {
			case "label":
				comparison = a.label.localeCompare(b.label);
				break;
			case "status":
				comparison = a.status.localeCompare(b.status);
				break;
			case "type":
				comparison = a.type.localeCompare(b.type);
				break;
			case "domain":
				comparison = a.domain.localeCompare(b.domain);
				break;
			case "pid": {
				const pidA = a.pid ?? Infinity;
				const pidB = b.pid ?? Infinity;
				comparison = pidA - pidB;
				break;
			}
		}

		return sort.direction === "asc" ? comparison : -comparison;
	});

	return sorted;
}

/**
 * Get the next sort field in cycle
 */
export function getNextSortField(current: SortField): SortField {
	const fields: SortField[] = ["label", "status", "type", "domain", "pid"];
	const currentIndex = fields.indexOf(current);
	const nextIndex = (currentIndex + 1) % fields.length;
	return fields[nextIndex] ?? "label";
}

export interface PerformServiceActionOptions {
	dryRun?: boolean;
}

/**
 * Execute an action on a service
 */
export async function performServiceAction(
	action: ServiceAction,
	service: Service,
	options: PerformServiceActionOptions = {},
): Promise<ActionResult & { command?: string }> {
	const { dryRun = false } = options;

	if (!isMacOS()) {
		// Mock response for development
		const mockCommand = `launchctl ${action === "start" ? "kickstart -k" : action === "stop" ? "kill SIGTERM" : action} gui/${process.getuid?.() || 501}/${service.label}`;
		if (dryRun) {
			return {
				success: true,
				message: `[DRY RUN] Would execute: ${mockCommand}`,
				command: mockCommand,
			};
		}
		return {
			success: true,
			message: `[Mock] Would ${action} service: ${service.label}`,
		};
	}

	if (service.type === "SystemExtension") {
		return {
			success: false,
			message: "System extensions cannot be controlled directly",
			error:
				"Use System Preferences or the parent application to manage system extensions",
		};
	}

	return executeServiceAction(action, service, { dryRun });
}

// Re-export types and utilities
export { executeServiceAction, setRetryLogger, getPlistMetadata } from "./launchctl";
export { listSystemExtensions } from "./systemextensions";
export { readPlist, describePlistConfig } from "./plist";
export type { PlistData, KeepAliveConfig, CalendarInterval } from "./plist";
