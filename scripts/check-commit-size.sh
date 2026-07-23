#!/bin/bash

# Check commit size and warn if too large
# This script is run as part of the pre-commit hook

MAX_LINES=1000

STAGED_FILES=$(git diff --cached --shortstat)
INSERTIONS=$(echo "$STAGED_FILES" | awk '{for(i=1;i<=NF;i++) if($i~/insertion/) print $(i-1)}')
DELETIONS=$(echo "$STAGED_FILES" | awk '{for(i=1;i<=NF;i++) if($i~/deletion/) print $(i-1)}')
INSERTIONS=${INSERTIONS:-0}
DELETIONS=${DELETIONS:-0}

TOTAL=$((INSERTIONS + DELETIONS))

if [ "$TOTAL" -gt "$MAX_LINES" ]; then
  echo ""
  echo "⚠️  Warning: Large commit detected ($TOTAL lines changed)"
  echo ""
  echo "Consider splitting this commit into smaller changes:"
  echo "  1. Implementation changes"
  echo "  2. Test updates"
  echo "  3. Documentation"
  echo ""
  echo "Use 'git restore --staged .' to unstage and split the commit."
  echo ""
  if [ -t 0 ]; then
    read -p "Continue with large commit? (y/N) " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
      echo "Commit cancelled."
      exit 1
    fi
  else
    echo "Warning: Large commit ($TOTAL lines) in non-interactive mode."
  fi
fi
