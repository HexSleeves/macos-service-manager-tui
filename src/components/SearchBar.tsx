/**
 * Search Bar Component
 * Search input for filtering services
 */

import { useAppStore } from "../store/useAppStore";

export function SearchBar() {
	const searchQuery = useAppStore((state) => state.searchQuery);
	const focusedPanel = useAppStore((state) => state.focusedPanel);
	const setSearch = useAppStore((state) => state.setSearch);

	const handleChange = (value: string) => {
		setSearch(value);
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
			backgroundColor={isFocused ? "#1e3a5f" : "#1f2937"}
		>
			<text fg="#6b7280">🔍</text>
			<input
				value={searchQuery}
				onChange={handleChange}
				placeholder="Search services... (press / to focus)"
				focused={isFocused}
				width={40}
				backgroundColor="transparent"
				textColor="#e5e7eb"
				placeholderColor="#6b7280"
				cursorColor="#60a5fa"
			/>
			{searchQuery && <text fg="#6b7280">[ESC] clear</text>}
		</box>
	);
}
