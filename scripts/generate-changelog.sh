#!/usr/bin/env bash
set -euo pipefail

OUTPUT="${1:-CHANGELOG.md}"
REVISION="${2:-}"

TMPFILE=$(mktemp)
COMMITS_FILE=$(mktemp)
trap 'rm -f -- "$TMPFILE" "$COMMITS_FILE"' EXIT

if [ -n "$REVISION" ]; then
  if ! git rev-parse --verify -q "${REVISION}^{commit}" >/dev/null; then
    echo "Error: revision '$REVISION' does not resolve to a commit" >&2
    exit 1
  fi
  RANGE="${REVISION}..HEAD"
else
  RANGE="HEAD"
fi

if ! git rev-list --count "$RANGE" >/dev/null 2>&1; then
  echo "Error: invalid commit range '$RANGE'" >&2
  exit 1
fi

# Read the commit stream once; a failing git log must abort instead of
# silently producing a partial changelog.
if ! git log "$RANGE" --format='%s%x09%h' --reverse > "$COMMITS_FILE"; then
  echo "Error: unable to read git history for '$RANGE'" >&2
  exit 1
fi

# The commit that generates this changelog cannot cite its own hash,
# since it changes on every regeneration; label it [this commit] instead.
# Any commit added on top of it is just as unstable, so its hash is omitted.
# A no-match returns 0 with empty output; a git error must abort instead of
# silently emitting a changelog that cites no commit hashes.
if ! CHANGELOG_COMMIT=$(git log -1 --format=%h --grep="add changelog generation script" HEAD); then
  echo "Error: unable to read the changelog-generating commit" >&2
  exit 1
fi

append_section() {
  local title="$1"
  local grep_pattern="$2"
  local placeholder="$3"
  local subject hash entry found=0

  echo "## $title" >> "$TMPFILE"
  echo "" >> "$TMPFILE"
  while IFS=$'\t' read -r subject hash; do
    if [ "$hash" = "$CHANGELOG_COMMIT" ]; then
      entry="- $subject ([this commit])"
    elif [ -n "$CHANGELOG_COMMIT" ] && ! git merge-base --is-ancestor "$hash" "$CHANGELOG_COMMIT" 2>/dev/null; then
      entry="- $subject"
    else
      entry="- $subject ($hash)"
    fi
    printf '%s\n' "$entry" >> "$TMPFILE"
    found=1
  done < <(grep -E -- "$grep_pattern" "$COMMITS_FILE")
  if [ "$found" -eq 0 ]; then
    echo "_${placeholder}_" >> "$TMPFILE"
  fi
  echo "" >> "$TMPFILE"
}

echo "# Changelog" > "$TMPFILE"
echo "" >> "$TMPFILE"

append_section "Features" "^feat" "No features in this release."
append_section "Bug Fixes" "^fix" "No bug fixes in this release."
append_section "Tests" "^test" "No tests in this release."
append_section "Chores" "^chore" "No chores in this release."
append_section "Documentation" "^docs" "No documentation in this release."
append_section "Refactors" "^refactor" "No refactors in this release."

# prettier normalizes the file on commit: no trailing blank line at EOF.
printf '%s\n' "$(cat "$TMPFILE")" > "$TMPFILE"

mv "$TMPFILE" "$OUTPUT"
echo "Changelog generated at $OUTPUT"
