#!/usr/bin/env bash
set -euo pipefail

OUTPUT="${1:-CHANGELOG.md}"
TAG="${2:-}"

TMPFILE=$(mktemp)

if [ -n "$TAG" ]; then
  RANGE="${TAG}..HEAD"
else
  RANGE="HEAD"
fi

echo "# Changelog" > "$TMPFILE"
echo "" >> "$TMPFILE"

# Features
echo "## Features" >> "$TMPFILE"
git log "$RANGE" --grep="^feat" --format="- %s (%h)" --reverse >> "$TMPFILE" || true
echo "" >> "$TMPFILE"

# Bug Fixes
echo "## Bug Fixes" >> "$TMPFILE"
git log "$RANGE" --grep="^fix" --format="- %s (%h)" --reverse >> "$TMPFILE" || true
echo "" >> "$TMPFILE"

# Tests
echo "## Tests" >> "$TMPFILE"
git log "$RANGE" --grep="^test" --format="- %s (%h)" --reverse >> "$TMPFILE" || true
echo "" >> "$TMPFILE"

# Chores
echo "## Chores" >> "$TMPFILE"
git log "$RANGE" --grep="^chore" --format="- %s (%h)" --reverse >> "$TMPFILE" || true
echo "" >> "$TMPFILE"

# Documentation
echo "## Documentation" >> "$TMPFILE"
git log "$RANGE" --grep="^docs" --format="- %s (%h)" --reverse >> "$TMPFILE" || true
echo "" >> "$TMPFILE"

# Refactors
echo "## Refactors" >> "$TMPFILE"
git log "$RANGE" --grep="^refactor" --format="- %s (%h)" --reverse >> "$TMPFILE" || true
echo "" >> "$TMPFILE"

mv "$TMPFILE" "$OUTPUT"
echo "Changelog generated at $OUTPUT"
