/**
 * Fuzzy Search Implementation (fzf-style)
 * Matches characters in order but not necessarily consecutive
 * Scores based on: consecutive chars, word boundaries, start of string
 */

export interface FuzzyMatch {
	/** Whether the pattern matched */
	matched: boolean;
	/** Match score (higher is better) */
	score: number;
	/** Indices of matched characters in the target string */
	matchedIndices: number[];
}

// Scoring constants (tuned for service name matching)
const SCORE_CONSECUTIVE = 15; // Bonus for consecutive character matches
const SCORE_WORD_BOUNDARY = 10; // Bonus for matching at word boundary
const SCORE_CAMEL_CASE = 10; // Bonus for matching camelCase boundary
const SCORE_START_OF_STRING = 20; // Bonus for matching at start of string
const SCORE_EXACT_MATCH = 100; // Bonus for exact substring match
const SCORE_BASE_MATCH = 1; // Base score per matched character
const PENALTY_DISTANCE = 1; // Penalty per character gap between matches
const PENALTY_UNMATCHED = 0.5; // Penalty for unmatched characters in target

/**
 * Check if a character is a word boundary
 */
function isWordBoundary(str: string, index: number): boolean {
	if (index === 0) return true;
	const prevChar = str[index - 1];
	const currChar = str[index];
	if (!prevChar || !currChar) return false;

	// After separator characters
	if (/[._\-/\s]/.test(prevChar)) return true;

	// camelCase boundary (lowercase followed by uppercase)
	if (/[a-z]/.test(prevChar) && /[A-Z]/.test(currChar)) return true;

	return false;
}

/**
 * Check if position is a camelCase boundary
 */
function isCamelCaseBoundary(str: string, index: number): boolean {
	if (index === 0) return false;
	const prevChar = str[index - 1];
	const currChar = str[index];
	if (!prevChar || !currChar) return false;
	return /[a-z]/.test(prevChar) && /[A-Z]/.test(currChar);
}

/**
 * Find all occurrences of a character in a string (case-insensitive)
 */
function _findAllOccurrences(str: string, char: string): number[] {
	const indices: number[] = [];
	const lowerStr = str.toLowerCase();
	const lowerChar = char.toLowerCase();
	for (let i = 0; i < lowerStr.length; i++) {
		if (lowerStr[i] === lowerChar) {
			indices.push(i);
		}
	}
	return indices;
}

/**
 * Recursive fuzzy match with memoization
 * Returns the best match starting from given positions
 */
function fuzzyMatchRecursive(
	pattern: string,
	target: string,
	patternIdx: number,
	targetIdx: number,
	matchedIndices: number[],
	memo: Map<string, FuzzyMatch>,
): FuzzyMatch {
	const memoKey = `${patternIdx}-${targetIdx}`;
	const cached = memo.get(memoKey);
	if (cached && matchedIndices.length === 0) {
		return cached;
	}

	// Pattern fully matched
	if (patternIdx >= pattern.length) {
		return {
			matched: true,
			score: 0,
			matchedIndices: [...matchedIndices],
		};
	}

	// Target exhausted but pattern not fully matched
	if (targetIdx >= target.length) {
		return {
			matched: false,
			score: -Infinity,
			matchedIndices: [],
		};
	}

	const patternChar = pattern[patternIdx]?.toLowerCase() ?? "";
	let bestMatch: FuzzyMatch = {
		matched: false,
		score: -Infinity,
		matchedIndices: [],
	};

	// Find all positions where current pattern char matches
	for (let i = targetIdx; i < target.length; i++) {
		const targetChar = target[i]?.toLowerCase() ?? "";
		if (targetChar !== patternChar) continue;

		// Calculate score for this match position
		let positionScore = SCORE_BASE_MATCH;

		// Bonus for start of string
		if (i === 0) {
			positionScore += SCORE_START_OF_STRING;
		}

		// Bonus for word boundary
		if (isWordBoundary(target, i)) {
			positionScore += SCORE_WORD_BOUNDARY;
		}

		// Bonus for camelCase
		if (isCamelCaseBoundary(target, i)) {
			positionScore += SCORE_CAMEL_CASE;
		}

		// Bonus for consecutive match
		const lastMatchIdx = matchedIndices[matchedIndices.length - 1];
		if (lastMatchIdx !== undefined && i === lastMatchIdx + 1) {
			positionScore += SCORE_CONSECUTIVE;
		} else if (lastMatchIdx !== undefined) {
			// Penalty for gap
			positionScore -= (i - lastMatchIdx - 1) * PENALTY_DISTANCE;
		}

		// Recurse for rest of pattern
		const newMatchedIndices = [...matchedIndices, i];
		const restMatch = fuzzyMatchRecursive(
			pattern,
			target,
			patternIdx + 1,
			i + 1,
			newMatchedIndices,
			memo,
		);

		if (restMatch.matched) {
			const totalScore = positionScore + restMatch.score;
			if (totalScore > bestMatch.score) {
				bestMatch = {
					matched: true,
					score: totalScore,
					matchedIndices: restMatch.matchedIndices,
				};
			}
		}
	}

	// Cache result (without matchedIndices dependency)
	if (matchedIndices.length === 0) {
		memo.set(memoKey, bestMatch);
	}

	return bestMatch;
}

/**
 * Perform fuzzy matching on a target string with a pattern
 * Returns match result with score and matched character indices
 */
export function fuzzyMatch(pattern: string, target: string): FuzzyMatch {
	if (!pattern) {
		return { matched: true, score: 0, matchedIndices: [] };
	}

	if (!target) {
		return { matched: false, score: -Infinity, matchedIndices: [] };
	}

	// Check for exact substring match (case-insensitive) - give bonus
	const lowerTarget = target.toLowerCase();
	const lowerPattern = pattern.toLowerCase();
	const exactIndex = lowerTarget.indexOf(lowerPattern);

	if (exactIndex !== -1) {
		// Exact match found
		const matchedIndices: number[] = [];
		for (let i = 0; i < pattern.length; i++) {
			matchedIndices.push(exactIndex + i);
		}

		let score = SCORE_EXACT_MATCH + pattern.length * SCORE_CONSECUTIVE;

		// Bonus for match at start
		if (exactIndex === 0) {
			score += SCORE_START_OF_STRING;
		}

		// Bonus for match at word boundary
		if (isWordBoundary(target, exactIndex)) {
			score += SCORE_WORD_BOUNDARY;
		}

		// Penalty for unmatched characters
		score -= (target.length - pattern.length) * PENALTY_UNMATCHED;

		return { matched: true, score, matchedIndices };
	}

	// Perform recursive fuzzy match
	const memo = new Map<string, FuzzyMatch>();
	const result = fuzzyMatchRecursive(pattern, target, 0, 0, [], memo);

	// Apply length penalty
	if (result.matched) {
		result.score -= (target.length - pattern.length) * PENALTY_UNMATCHED;
	}

	return result;
}

/**
 * Match a pattern against a service, checking label, displayName, and description
 * Returns the best match among all fields
 */
export interface ServiceFuzzyMatch {
	matched: boolean;
	score: number;
	/** Which field had the best match */
	field: "label" | "displayName" | "description";
	/** Matched indices for the best matching field */
	matchedIndices: number[];
}

export function fuzzyMatchService(
	pattern: string,
	service: { label: string; displayName: string; description?: string },
): ServiceFuzzyMatch {
	if (!pattern) {
		return {
			matched: true,
			score: 0,
			field: "label",
			matchedIndices: [],
		};
	}

	// Match against label (primary - give extra weight)
	const labelMatch = fuzzyMatch(pattern, service.label);
	const labelScore = labelMatch.matched ? labelMatch.score * 1.5 : -Infinity;

	// Match against displayName
	const displayMatch = fuzzyMatch(pattern, service.displayName);
	const displayScore = displayMatch.matched
		? displayMatch.score * 1.2
		: -Infinity;

	// Match against description (lower weight)
	const descMatch = service.description
		? fuzzyMatch(pattern, service.description)
		: { matched: false, score: -Infinity, matchedIndices: [] };
	const descScore = descMatch.matched ? descMatch.score * 0.8 : -Infinity;

	// Return best match
	if (
		labelScore >= displayScore &&
		labelScore >= descScore &&
		labelMatch.matched
	) {
		return {
			matched: true,
			score: labelScore,
			field: "label",
			matchedIndices: labelMatch.matchedIndices,
		};
	}

	if (displayScore >= descScore && displayMatch.matched) {
		return {
			matched: true,
			score: displayScore,
			field: "displayName",
			matchedIndices: displayMatch.matchedIndices,
		};
	}

	if (descMatch.matched) {
		return {
			matched: true,
			score: descScore,
			field: "description",
			matchedIndices: descMatch.matchedIndices,
		};
	}

	return {
		matched: false,
		score: -Infinity,
		field: "label",
		matchedIndices: [],
	};
}
