/**
 * Highlighted Text Component
 * Renders text with highlighted matched characters for search results
 */

import { COLORS } from "../constants";

export interface HighlightedTextProps {
	text: string;
	matchedIndices: number[];
	baseColor: string;
	highlightColor: string;
	dimmed?: boolean;
}

export function HighlightedText({
	text,
	matchedIndices,
	baseColor,
	highlightColor,
	dimmed,
}: HighlightedTextProps) {
	if (matchedIndices.length === 0) {
		return <text fg={dimmed ? COLORS.textTertiary : baseColor}>{text}</text>;
	}

	const matchSet = new Set(matchedIndices);
	const segments: Array<{ text: string; highlighted: boolean }> = [];
	let currentSegment = "";
	let currentHighlighted = false;

	for (let i = 0; i < text.length; i++) {
		const isHighlighted = matchSet.has(i);
		if (i === 0) {
			currentHighlighted = isHighlighted;
			currentSegment = text[i] ?? "";
		} else if (isHighlighted === currentHighlighted) {
			currentSegment += text[i];
		} else {
			segments.push({ text: currentSegment, highlighted: currentHighlighted });
			currentSegment = text[i] ?? "";
			currentHighlighted = isHighlighted;
		}
	}
	if (currentSegment) {
		segments.push({ text: currentSegment, highlighted: currentHighlighted });
	}

	return (
		<text>
			{segments.map((seg, i) =>
				seg.highlighted ? (
					<b key={`hl-${i}-${seg.text.substring(0, 10)}`}>
						<span fg={highlightColor}>{seg.text}</span>
					</b>
				) : (
					<span key={`txt-${i}-${seg.text.substring(0, 10)}`} fg={dimmed ? COLORS.textTertiary : baseColor}>
						{seg.text}
					</span>
				),
			)}
		</text>
	);
}
