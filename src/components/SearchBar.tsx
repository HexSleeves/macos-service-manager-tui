/**
 * Search Bar Component
 * Search input for filtering services
 */

import { useAppState } from "../hooks/useAppState";

export function SearchBar() {
	const { state, dispatch } = useAppState();

	const handleChange = (value: string) => {
		dispatch({ type: "SET_SEARCH", payload: value });
	};

	const isFocused = state.focusedPanel === "search";

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
				value={state.searchQuery}
				onChange={handleChange}
				placeholder="Search services... (press / to focus)"
				focused={isFocused}
				width={40}
				backgroundColor="transparent"
				textColor="#e5e7eb"
				placeholderColor="#6b7280"
				cursorColor="#60a5fa"
			/>
			{state.searchQuery && <text fg="#6b7280">[ESC] clear</text>}
		</box>
	);
}
