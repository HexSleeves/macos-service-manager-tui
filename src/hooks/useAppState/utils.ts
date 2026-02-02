/**
 * Utility functions for state management
 */

import type { Service } from "../../types";

/**
 * Check if a service has changed (for smart updates)
 */
export function hasServiceChanged(oldService: Service, newService: Service): boolean {
	return (
		oldService.status !== newService.status ||
		oldService.pid !== newService.pid ||
		oldService.enabled !== newService.enabled ||
		oldService.exitStatus !== newService.exitStatus ||
		oldService.lastError !== newService.lastError
	);
}

/**
 * Merge services, only updating those that changed
 * Returns null if nothing changed, otherwise returns the updated array
 */
export function mergeServices(oldServices: Service[], newServices: Service[]): Service[] | null {
	// Build a map of new services by id
	const newServiceMap = new Map(newServices.map((s) => [s.id, s]));
	const _oldServiceMap = new Map(oldServices.map((s) => [s.id, s]));

	// Check if the service set has changed
	const oldIds = new Set(oldServices.map((s) => s.id));
	const newIds = new Set(newServices.map((s) => s.id));

	// Check for added or removed services
	const hasAddedOrRemoved =
		newServices.some((s) => !oldIds.has(s.id)) || oldServices.some((s) => !newIds.has(s.id));

	if (hasAddedOrRemoved) {
		// Services were added or removed, return new array
		return newServices;
	}

	// Check if any services changed
	let hasChanges = false;
	const mergedServices = oldServices.map((oldService) => {
		const newService = newServiceMap.get(oldService.id);
		if (newService && hasServiceChanged(oldService, newService)) {
			hasChanges = true;
			return newService;
		}
		return oldService;
	});

	return hasChanges ? mergedServices : null;
}
