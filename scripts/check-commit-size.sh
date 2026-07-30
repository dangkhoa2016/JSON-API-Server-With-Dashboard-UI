#!/usr/bin/env bash
set -euo pipefail

WARN_THRESHOLD=${WARN_THRESHOLD:-600}
FAIL_THRESHOLD=${FAIL_THRESHOLD:-1000}
STRICT=${STRICT:-false}
MODE=${MODE:-staged}
BEFORE=${BEFORE:-HEAD}

EXEMPT_PATTERNS='\.(lock|min\.(js|css)|map|svg|png|jpg|jpeg|gif|ico)$|/snapshots/|/migrations/|/__snapshots__/|yarn\.lock|package-lock\.json'

total_lines=0
files_changed=0
binary_count=0
exempt_count=0

if [ "${MODE}" = "staged" ]; then
  diff_data=$(git diff --cached --numstat 2>/dev/null || true)
else
  diff_data=$(git diff "$BEFORE^" "$BEFORE" --numstat 2>/dev/null || true)
fi

while IFS=$'\t' read -r added deleted file; do
  [ -z "$file" ] && continue

  if echo "$file" | grep -qE "$EXEMPT_PATTERNS"; then
    exempt_count=$((exempt_count + 1))
    continue
  fi

  if [ "$added" = "-" ] && [ "$deleted" = "-" ]; then
    binary_count=$((binary_count + 1))
    continue
  fi

  total_lines=$((total_lines + added + deleted))
  files_changed=$((files_changed + 1))
done < <(echo "$diff_data")

if [ "$binary_count" -gt 0 ]; then
  echo "ℹ️  ${binary_count} binary file(s) skipped"
fi
if [ "$exempt_count" -gt 0 ]; then
  echo "ℹ️  ${exempt_count} exempt file(s) (lock/snapshot/generated) skipped"
fi

if [ "$total_lines" -gt "$FAIL_THRESHOLD" ]; then
  echo "❌ Commit has ${total_lines} handwritten +/- lines (limit: ${FAIL_THRESHOLD})"
  echo "   Generated/lock/snapshot lines are exempt."
  echo "   Consider splitting into multiple commits."
  if [ "$STRICT" = "true" ]; then
    exit 1
  else
    echo "   (CI mode would fail. In dev, continuing...)"
  fi
elif [ "$total_lines" -gt "$WARN_THRESHOLD" ]; then
  echo "⚠️  Commit has ${total_lines} handwritten +/- lines (warn threshold: ${WARN_THRESHOLD})"
fi

echo "✅ Commit size: ${total_lines} handwritten +/- lines across ${files_changed} files"
