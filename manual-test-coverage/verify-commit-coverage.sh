#!/usr/bin/env bash
set -euo pipefail

# ── Config ─────────────────────────────────────────────────────────
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
RESULTS_DIR="$SCRIPT_DIR/results"
REPORT="$SCRIPT_DIR/coverage-report.md"
COVERAGE_THRESHOLD=80

# ── Parse args ─────────────────────────────────────────────────────
BASE=""
HEAD=""
while [[ $# -gt 0 ]]; do
  case "$1" in
    --threshold)
      COVERAGE_THRESHOLD="$2"
      shift 2
      ;;
    --threshold=*)
      COVERAGE_THRESHOLD="${1#*=}"
      shift
      ;;
    -*)
      echo "Unknown option: $1"
      exit 1
      ;;
    *)
      if [ -z "$BASE" ]; then
        BASE="$1"
      elif [ -z "$HEAD" ]; then
        HEAD="$1"
      fi
      shift
      ;;
  esac
done

BASE="${BASE:-$(git rev-list --max-parents=0 HEAD)}"
HEAD="${HEAD:-HEAD}"

mkdir -p "$RESULTS_DIR"

# ── Helpers ─────────────────────────────────────────────────────────
cleanup() {
  cd "$PROJECT_ROOT" 2>/dev/null || true
  git checkout "$ORIG_BRANCH" 2>/dev/null || true
  git stash pop --quiet 2>/dev/null || true
}

ORIG_BRANCH=$(git rev-parse --abbrev-ref HEAD)
ORIG_COMMIT=$(git rev-parse HEAD)
trap cleanup EXIT

# Stash any uncommitted changes
git stash push --include-untracked --quiet 2>/dev/null || true

# ── Collect commits ────────────────────────────────────────────────
COMMITS=()
while IFS= read -r line; do
  COMMITS+=("$line")
done < <(git log --oneline --reverse "${BASE}..${HEAD}")

TOTAL=${#COMMITS[@]}
IDX=1
PASSED=0
LOW_COVERAGE=0
FAILED=0
SKIPPED=0

echo "# Coverage Report" > "$REPORT"
echo "" >> "$REPORT"
echo "Range: \`${BASE}..${HEAD}\`" >> "$REPORT"
echo "Threshold: ${COVERAGE_THRESHOLD}%" >> "$REPORT"
echo "" >> "$REPORT"
echo "| # | Commit | Stmts | Branch | Funcs | Lines | Status | Message |" >> "$REPORT"
echo "|--:|--------|------:|-------:|------:|------:|--------|---------|" >> "$REPORT"

for entry in "${COMMITS[@]}"; do
  HASH=$(echo "$entry" | awk '{print $1}')
  MSG=$(echo "$entry" | cut -d' ' -f2-)
  SAFE_MSG=$(echo "$MSG" | sed 's/[^a-zA-Z0-9._-]/_/g' | head -c 80)
  LOGFILE="$RESULTS_DIR/${IDX}-${HASH}-${SAFE_MSG}.log"

  echo ""
  echo "========================================"
  echo "[${IDX}/${TOTAL}] Checking ${HASH}: ${MSG}"
  echo "========================================"

  cd "$PROJECT_ROOT"

  # Checkout commit
  if ! git checkout "$HASH" > /dev/null 2>&1; then
    echo "  SKIP - checkout failed"
    echo "| $IDX | \`${HASH}\` | - | - | - | - | ⏭️ SKIP | $MSG |" >> "$REPORT"
    SKIPPED=$((SKIPPED + 1))
    IDX=$((IDX + 1))
    continue
  fi

  # Install deps if missing (some old commits may not have node_modules in CI)
  if [ ! -d "node_modules" ]; then
    echo "  -> Installing dependencies..."
    yarn install --frozen-lockfile --silent 2>/dev/null || yarn install --silent 2>/dev/null || true
  fi

  # Check if test:coverage script exists
  if ! grep -q '"test:coverage"' package.json 2>/dev/null; then
    echo "  SKIP - no test:coverage script"
    echo "| $IDX | \`${HASH}\` | - | - | - | - | ⏭️ SKIP | $MSG |" >> "$REPORT"
    SKIPPED=$((SKIPPED + 1))
    IDX=$((IDX + 1))
    continue
  fi

  # Run coverage
  echo "  -> Running yarn test:coverage..."
  set +e
  output=$(yarn test:coverage 2>&1)
  exit_code=$?
  set -e
  echo "$output" > "$LOGFILE"

  # ── Parse vitest v8 coverage text output ──────────────────────────
  # Format 1: "All files" table row
  stmts=$(echo "$output" | grep 'All files' | awk '{print $4}' | tr -d '|' | head -1) || true
  branch=$(echo "$output" | grep 'All files' | awk '{print $6}' | tr -d '|' | head -1) || true
  funcs=$(echo "$output" | grep 'All files' | awk '{print $8}' | tr -d '|' | head -1) || true
  lines=$(echo "$output" | grep 'All files' | awk '{print $10}' | tr -d '|' | head -1) || true

  # Format 2: "Statements   : 50.3%" style
  if [ -z "$stmts" ]; then
    stmts=$(echo "$output" | grep -oP 'Statements\s*:\s*\K[\d.]+' | head -1) || true
    branch=$(echo "$output" | grep -oP 'Branches\s*:\s*\K[\d.]+' | head -1) || true
    funcs=$(echo "$output" | grep -oP 'Functions\s*:\s*\K[\d.]+' | head -1) || true
    lines=$(echo "$output" | grep -oP 'Lines\s*:\s*\K[\d.]+' | head -1) || true
  fi

  # Format 3: pipe-separated table
  if [ -z "$stmts" ]; then
    stmts=$(echo "$output" | grep 'All files' | awk -F'|' '{print $2}' | tr -d ' ' | head -1) || true
    branch=$(echo "$output" | grep 'All files' | awk -F'|' '{print $3}' | tr -d ' ' | head -1) || true
    funcs=$(echo "$output" | grep 'All files' | awk -F'|' '{print $4}' | tr -d ' ' | head -1) || true
    lines=$(echo "$output" | grep 'All files' | awk -F'|' '{print $5}' | tr -d ' ' | head -1) || true
  fi

  coverage_val="${stmts:-${lines:-0}}"

  # ── Determine status ──────────────────────────────────────────────
  if [ $exit_code -eq 124 ]; then
    status_icon="⏭️"
    status_text="TIMEOUT"
    SKIPPED=$((SKIPPED + 1))
  elif [ $exit_code -ne 0 ]; then
    status_icon="❌"
    status_text="FAIL ($exit_code)"
    FAILED=$((FAILED + 1))
  elif [ -n "$coverage_val" ] && [ "$coverage_val" != "0" ]; then
    meets=$(echo "$coverage_val >= $COVERAGE_THRESHOLD" | bc -l 2>/dev/null || echo "1")
    if [ "$meets" = "1" ]; then
      status_icon="✅"
      status_text="PASS"
      PASSED=$((PASSED + 1))
    else
      status_icon="⚠️"
      status_text="LOW (${coverage_val}% < ${COVERAGE_THRESHOLD}%)"
      LOW_COVERAGE=$((LOW_COVERAGE + 1))
    fi
  else
    status_icon="❓"
    status_text="NO DATA"
    SKIPPED=$((SKIPPED + 1))
  fi

  echo "  ${status_text} | Stmts: ${stmts:-N/A}% Branch: ${branch:-N/A}% Funcs: ${funcs:-N/A}% Lines: ${lines:-N/A}%"
  echo "| $IDX | \`${HASH}\` | ${stmts:--} | ${branch:--} | ${funcs:--} | ${lines:--} | ${status_icon} ${status_text} | $MSG |" >> "$REPORT"

  IDX=$((IDX + 1))
done

cleanup

# ── Summary ─────────────────────────────────────────────────────────
echo ""
echo "═══════════════════════════════════════════════════"
echo "SUMMARY"
echo "═══════════════════════════════════════════════════"
echo "  Range:      ${BASE}..${HEAD}"
echo "  Total:      $TOTAL"
echo "  Passed:     $PASSED"
echo "  Low cov:    $LOW_COVERAGE"
echo "  Failed:     $FAILED"
echo "  Skipped:    $SKIPPED"
echo "  Threshold:  ${COVERAGE_THRESHOLD}%"
echo ""
echo "Report written to $REPORT"

{
  echo ""
  echo "═══════════════════════════════════════════════════"
  echo "SUMMARY"
  echo "═══════════════════════════════════════════════════"
  echo "  Range:      ${BASE}..${HEAD}"
  echo "  Total:      $TOTAL"
  echo "  Passed:     $PASSED"
  echo "  Low cov:    $LOW_COVERAGE"
  echo "  Failed:     $FAILED"
  echo "  Skipped:    $SKIPPED"
  echo "  Threshold:  ${COVERAGE_THRESHOLD}%"
} >> "$REPORT"
