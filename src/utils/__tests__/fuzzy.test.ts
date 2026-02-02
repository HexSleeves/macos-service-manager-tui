/**
 * Tests for fuzzy search implementation
 */

import { describe, expect, test } from "bun:test";
import { fuzzyMatch, fuzzyMatchService } from "../fuzzy";

describe("fuzzyMatch", () => {
	test("empty pattern matches everything", () => {
		const result = fuzzyMatch("", "com.apple.dock");
		expect(result.matched).toBe(true);
		expect(result.matchedIndices).toEqual([]);
	});

	test("empty target doesn't match", () => {
		const result = fuzzyMatch("abc", "");
		expect(result.matched).toBe(false);
	});

	test("exact substring match", () => {
		const result = fuzzyMatch("docker", "com.docker.helper");
		expect(result.matched).toBe(true);
		expect(result.matchedIndices).toEqual([4, 5, 6, 7, 8, 9]);
	});

	test("fuzzy match - characters in order but not consecutive", () => {
		const result = fuzzyMatch("cdk", "com.docker");
		expect(result.matched).toBe(true);
		// Should match c-d-k from com.docker
		expect(result.matchedIndices.length).toBe(3);
	});

	test("case insensitive matching", () => {
		const result = fuzzyMatch("DOCKER", "com.docker.helper");
		expect(result.matched).toBe(true);
	});

	test("no match when characters not in order", () => {
		const result = fuzzyMatch("xyz", "com.docker");
		expect(result.matched).toBe(false);
	});

	test("prefers word boundary matches", () => {
		// "ssh" should match better in "com.openssh.agent" than in "flashship"
		const sshMatch = fuzzyMatch("ssh", "com.openssh.agent");
		const flashMatch = fuzzyMatch("ssh", "flashship");
		expect(sshMatch.matched).toBe(true);
		expect(flashMatch.matched).toBe(true);
		expect(sshMatch.score).toBeGreaterThan(flashMatch.score);
	});

	test("prefers start of string matches", () => {
		const startMatch = fuzzyMatch("com", "com.apple.dock");
		const middleMatch = fuzzyMatch("com", "something.com.else");
		expect(startMatch.score).toBeGreaterThan(middleMatch.score);
	});

	test("prefers consecutive character matches", () => {
		const consecutiveMatch = fuzzyMatch("doc", "docker");
		const scatteredMatch = fuzzyMatch("doc", "deployoncloud");
		expect(consecutiveMatch.matched).toBe(true);
		expect(scatteredMatch.matched).toBe(true);
		expect(consecutiveMatch.score).toBeGreaterThan(scatteredMatch.score);
	});

	test("handles camelCase boundaries", () => {
		const result = fuzzyMatch("LH", "LaunchHelper");
		expect(result.matched).toBe(true);
		// Should prefer matching at camelCase boundaries
	});

	test("handles dot-separated segments", () => {
		const result = fuzzyMatch("ado", "com.apple.dock");
		expect(result.matched).toBe(true);
		// Should match at word boundaries preferably
	});
});

describe("fuzzyMatchService", () => {
	const service = {
		label: "com.docker.helper",
		displayName: "Docker Helper Service",
		description: "Helps manage Docker containers",
	};

	test("empty pattern matches", () => {
		const result = fuzzyMatchService("", service);
		expect(result.matched).toBe(true);
	});

	test("matches label", () => {
		const result = fuzzyMatchService("docker", service);
		expect(result.matched).toBe(true);
		expect(result.field).toBe("label");
	});

	test("matches displayName", () => {
		const result = fuzzyMatchService("Helper Service", service);
		expect(result.matched).toBe(true);
		// Could match in label or displayName
	});

	test("matches description", () => {
		const result = fuzzyMatchService("containers", service);
		expect(result.matched).toBe(true);
		expect(result.field).toBe("description");
	});

	test("prefers label over description", () => {
		// "helper" appears in both label and description
		const result = fuzzyMatchService("helper", service);
		expect(result.matched).toBe(true);
		expect(result.field).toBe("label");
	});

	test("returns no match when nothing matches", () => {
		const result = fuzzyMatchService("xyz123", service);
		expect(result.matched).toBe(false);
	});
});

describe("fuzzy search performance", () => {
	test("handles 500+ services efficiently", () => {
		// Generate 500 mock service names
		const services = Array.from({ length: 500 }, (_, i) => ({
			label: `com.company${i}.service.name${i}`,
			displayName: `Service Name ${i}`,
			description: `Description for service ${i}`,
		}));

		const start = performance.now();

		// Run fuzzy match on all services
		for (const service of services) {
			fuzzyMatchService("comp", service);
		}

		const elapsed = performance.now() - start;

		// Should complete in under 100ms for 500 services
		expect(elapsed).toBeLessThan(100);
	});
});
