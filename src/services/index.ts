/**
 * Unified Service Discovery
 * Combines launchctl and systemextensionsctl services
 */

import type { ActionResult, FilterOptions, Service, ServiceAction, SortField, SortOptions } from "../types";
import { fuzzyMatchService } from "../utils/fuzzy";
import { executeServiceAction, listServices as listLaunchServices } from "./launchctl/index";
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
 * Throws if launchctl list fails (critical failure)
 */
export async function fetchAllServices(): Promise<Service[]> {
	if (!isMacOS()) {
		// Return mock data for non-macOS systems (development/testing)
		console.log("Not running on macOS - using mock data");
		return getMockServices();
	}

	try {
		// launchctl list is critical - if it fails, throw
		// systemextensions list is non-critical - return empty array on failure
		const [launchServices, systemExtensions] = await Promise.allSettled([
			listLaunchServices(),
			listSystemExtensions(),
		]);

		// If launchctl failed, throw the error
		if (launchServices.status === "rejected") {
			throw launchServices.reason;
		}

		// Combine services (system extensions may have failed, that's OK)
		const extensions = systemExtensions.status === "fulfilled" ? systemExtensions.value : [];

		const allServices = [...launchServices.value, ...extensions];

		// Sort by label by default
		return allServices.sort((a, b) => a.label.localeCompare(b.label));
	} catch (error) {
		// Re-throw with context
		throw new Error(`Failed to fetch services: ${error instanceof Error ? error.message : String(error)}`);
	}
}

/**
 * Result of fuzzy filtering with match metadata
 */
export interface FilteredService {
	service: Service;
	/** Fuzzy match score (higher is better) */
	matchScore: number;
	/** Which field matched (label, displayName, description) */
	matchField: "label" | "displayName" | "description";
	/** Indices of matched characters in the matched field */
	matchedIndices: number[];
}

/**
 * Filter services based on filter options with fuzzy search
 * Returns services sorted by match score when a search query is present
 */
export function filterServices(services: Service[], filter: FilterOptions, searchQuery: string): Service[] {
	const results = filterServicesWithScores(services, filter, searchQuery);
	return results.map((r) => r.service);
}

/**
 * Filter services and return full match metadata
 * Useful for highlighting matched characters
 */
export function filterServicesWithScores(
	services: Service[],
	filter: FilterOptions,
	searchQuery: string,
): FilteredService[] {
	const results: FilteredService[] = [];

	for (const service of services) {
		// Type filter
		if (filter.type !== "all" && service.type !== filter.type) {
			continue;
		}

		// Domain filter
		if (filter.domain !== "all" && service.domain !== filter.domain) {
			continue;
		}

		// Status filter
		if (filter.status !== "all" && service.status !== filter.status) {
			continue;
		}

		// Apple services filter
		if (!filter.showAppleServices && service.isAppleService) {
			continue;
		}

		// Protected services filter
		if (!filter.showProtected && service.protection !== "normal") {
			continue;
		}

		// Fuzzy search filter
		if (searchQuery) {
			const match = fuzzyMatchService(searchQuery, service);
			if (!match.matched) {
				continue;
			}
			results.push({
				service,
				matchScore: match.score,
				matchField: match.field,
				matchedIndices: match.matchedIndices,
			});
		} else {
			// No search query - include all with neutral score
			results.push({
				service,
				matchScore: 0,
				matchField: "label",
				matchedIndices: [],
			});
		}
	}

	// Sort by match score when searching (best matches first)
	if (searchQuery) {
		results.sort((a, b) => b.matchScore - a.matchScore);
	}

	return results;
}

/**
 * Sort services based on sort options
 */
export function sortServices(services: Service[], sort: SortOptions): Service[] {
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
			error: "Use System Preferences or the parent application to manage system extensions",
		};
	}

	return executeServiceAction(action, service, { dryRun });
}

// Re-export types and utilities
export {
	executeServiceAction,
	fetchServiceMetadata,
	findPlistPath,
	getCurrentUid,
	getMacOSVersion,
	getPlistMetadata,
	isRunningAsRoot,
	isValidServiceLabel,
	parseLaunchctlList,
	parseLaunchctlPrint,
	requiresRoot,
	setRetryLogger,
	shouldUseSudo,
} from "./launchctl/index";
export type { CalendarInterval, KeepAliveConfig, PlistData } from "./plist";
export { describePlistConfig, readPlist } from "./plist";
export { listSystemExtensions } from "./systemextensions";
