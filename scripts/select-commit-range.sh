#!/usr/bin/env bash
set -euo pipefail

# Emit the commit range audited by commit-policy jobs.
#
# Usage:
#   select-commit-range.sh <event_name> <base_ref> <before_sha> <head_sha>
#   select-commit-range.sh --refs <event_name> <base_ref> <before_sha> <head_sha>
#
# Default prints one commit hash per line (newest first) over the range.
# --refs prints two lines: the base revision and the head revision. The base
# line is empty for a root-inclusive range.
#
# Contract:
#   pull_request -> origin/<base_ref>..<head_sha>
#   push         -> <before_sha>..<head_sha>; a zero <before_sha> selects the
#                   full branch history (root-inclusive). A <before_sha> that
#                   cannot be resolved to a commit (e.g. force-push rewrite)
#                   also selects the full branch history.
#   Merge commits are excluded: their messages are auto-generated (e.g. by
#   GitHub's PR merge ref) and are not subject to the authoring policy.
#
# Invalid bases/heads fail loudly instead of silently selecting nothing.

mode="commits"
if [ "${1:-}" = "--refs" ]; then
  mode="refs"
  shift
fi

event_name="${1:?missing event_name}"
base_ref="${2:-}"
before_sha="${3:-}"
head_sha="${4:?missing head_sha}"

zero_sha="0000000000000000000000000000000000000000"
base=""

case "$event_name" in
  pull_request)
    if [ -z "$base_ref" ]; then
      echo "select-commit-range: missing base_ref for pull_request" >&2
      exit 2
    fi
    base="origin/$base_ref"
    ;;
  push)
    if [ -n "$before_sha" ] && [ "$before_sha" != "$zero_sha" ]; then
      base="$before_sha"
      # A force-push (e.g. history rewrite) may report a `before` commit that
      # is no longer reachable from any fetched ref, so it is absent from the
      # checkout. Fall back to a full-history audit instead of failing.
      # Note: rev-parse --verify accepts a well-formed full hex even when the
      # object does not exist, so peel with ^{commit} to force existence.
      if ! git rev-parse --verify --quiet "$base^{commit}" >/dev/null 2>&1; then
        base=""
      fi
    fi
    ;;
  *)
    echo "select-commit-range: unsupported event '$event_name'" >&2
    exit 2
    ;;
esac

if [ -n "$base" ] && ! git rev-parse --verify --quiet "$base^{commit}" >/dev/null 2>&1; then
  echo "select-commit-range: invalid base '$base'" >&2
  exit 1
fi

if ! git rev-parse --verify --quiet "$head_sha^{commit}" >/dev/null 2>&1; then
  echo "select-commit-range: invalid head '$head_sha'" >&2
  exit 1
fi

if [ "$mode" = "refs" ]; then
  printf '%s\n%s\n' "$base" "$head_sha"
  exit 0
fi

if [ -n "$base" ]; then
  git log --no-merges --format='%H' "$base..$head_sha"
else
  git log --no-merges --format='%H' "$head_sha"
fi
