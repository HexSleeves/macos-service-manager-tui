#!/bin/bash

# format.sh - Hook script that formats edited files using Biome
# This script is called by Cursor's afterFileEdit hook

# Read JSON input from stdin
json_input=$(cat)

# Parse the file path from the JSON input
file_path=$(echo "$json_input" | jq -r '.file_path // empty')

# If we got a file path and it's a TypeScript/JavaScript file, format it
if [[ -n "$file_path" ]] && [[ "$file_path" =~ \.(ts|tsx|js|jsx)$ ]]; then
	# Run biome format on the specific file
	bunx biome format --write "$file_path" 2>/dev/null || true
fi

# Always succeed to allow the edit to continue
exit 0
