/**
 * Search Bar Component
 * Search input for filtering services
 */

import { useEffect, useState } from "react";
import { COLORS } from "../constants";
import { SEARCH_DEBOUNCE_MS } from "../store/constants";
import { useAppStore } from "../store/useAppStore";

export function SearchBar() {
	const searchQuery = useAppStore((state) => state.searchQuery);
	const focusedPanel = useAppStore((state) => state.focusedPanel);
	const setSearch = useAppStore((state) => state.setSearch);

	// Local state for immediate input feedback
	const [localValue, setLocalValue] = useState(searchQuery);

	// Sync local value when store's searchQuery changes externally (e.g., ESC to clear)
	useEffect(() => {
		setLocalValue(searchQuery);
	}, [searchQuery]);

	// Debounce the search query update to the store
	useEffect(() => {
		// Skip if already in sync
		if (localValue === searchQuery) {
			return;
		}

		const timer = setTimeout(() => {
			setSearch(localValue);
		}, SEARCH_DEBOUNCE_MS);

		return () => clearTimeout(timer);
	}, [localValue, searchQuery, setSearch]);

	const handleChange = (value: string) => {
		setLocalValue(value);
	};

	const isFocused = focusedPanel === "search";

	return (
		<box
			flexDirection="row"
			alignItems="center"
			gap={1}
			paddingLeft={1}
			paddingRight={1}
			height={1}
			backgroundColor={isFocused ? COLORS.bgHeader : COLORS.bgSecondary}
		>
			<text fg={COLORS.textMuted}>🔍</text>
			<input
				value={localValue}
				onChange={handleChange}
				placeholder="Search services... (press / to focus)"
				focused={isFocused}
				width={40}
				backgroundColor="transparent"
				textColor={COLORS.textSecondary}
				placeholderColor={COLORS.textMuted}
				cursorColor={COLORS.textAccent}
			/>
			{localValue && <text fg={COLORS.textMuted}>[ESC] clear</text>}
		</box>
	);
}
