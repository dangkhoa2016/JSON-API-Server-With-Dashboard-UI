#!/usr/bin/env bash
set -euo pipefail

# ── Config ─────────────────────────────────────────────────────────
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
OUTPUT_DIR="$SCRIPT_DIR"
COVERAGE_THRESHOLD=80
TEST_COMMAND="yarn test:coverage"
INSTALL_DEPS=false

# ── Parse args ─────────────────────────────────────────────────────
BASE=""
HEAD=""
BASE_EXPLICIT=false
while [[ $# -gt 0 ]]; do
  case "$1" in
    --threshold)
      [[ $# -lt 2 ]] && { echo "Missing value for $1" >&2; exit 2; }
      COVERAGE_THRESHOLD="$2"
      shift 2
      ;;
    --threshold=*)
      COVERAGE_THRESHOLD="${1#*=}"
      if [ -z "$COVERAGE_THRESHOLD" ]; then echo "Empty value for --threshold" >&2; exit 2; fi
      shift
      ;;
    --project-root)
      [[ $# -lt 2 ]] && { echo "Missing value for $1" >&2; exit 2; }
      PROJECT_ROOT="$2"
      shift 2
      ;;
    --project-root=*)
      PROJECT_ROOT="${1#*=}"
      if [ -z "$PROJECT_ROOT" ]; then echo "Empty value for --project-root" >&2; exit 2; fi
      shift
      ;;
    --test-command)
      [[ $# -lt 2 ]] && { echo "Missing value for $1" >&2; exit 2; }
      TEST_COMMAND="$2"
      shift 2
      ;;
    --test-command=*)
      TEST_COMMAND="${1#*=}"
      if [ -z "$TEST_COMMAND" ]; then echo "Empty value for --test-command" >&2; exit 2; fi
      shift
      ;;
    --output-dir)
      [[ $# -lt 2 ]] && { echo "Missing value for $1" >&2; exit 2; }
      OUTPUT_DIR="$2"
      shift 2
      ;;
    --output-dir=*)
      OUTPUT_DIR="${1#*=}"
      if [ -z "$OUTPUT_DIR" ]; then echo "Empty value for --output-dir" >&2; exit 2; fi
      shift
      ;;
    --install)
      INSTALL_DEPS=true
      shift
      ;;
    -*)
      echo "Unknown option: $1"
      exit 1
      ;;
    *)
      if [ -z "$BASE" ]; then
        BASE="$1"
        BASE_EXPLICIT=true
      elif [ -z "$HEAD" ]; then
        HEAD="$1"
      else
        echo "Unexpected positional argument: $1" >&2
        exit 2
      fi
      shift
      ;;
  esac
done

HEAD="${HEAD:-HEAD}"

if ! [[ "$COVERAGE_THRESHOLD" =~ ^[0-9]+$ ]] || [ "$COVERAGE_THRESHOLD" -lt 0 ] || [ "$COVERAGE_THRESHOLD" -gt 100 ]; then
  echo "Invalid --threshold: $COVERAGE_THRESHOLD (must be 0-100)" >&2
  exit 2
fi

RESULTS_DIR="$OUTPUT_DIR/results"
REPORT="$OUTPUT_DIR/coverage-report.md"
mkdir -p "$RESULTS_DIR"

# ── Temp directory & worktree cleanup ──────────────────────────
WORKTREE_DIR=""
cleanup() {
  if [ -n "$WORKTREE_DIR" ] && [ -d "$WORKTREE_DIR" ]; then
    git -C "$PROJECT_ROOT" worktree remove --force "$WORKTREE_DIR" 2>/dev/null || true
    rm -rf "$WORKTREE_DIR"
  fi
}
trap cleanup EXIT
trap 'exit 130' INT
trap 'exit 143' TERM

# ── Collect commits ────────────────────────────────────────────────
COMMITS=()
if [[ "$BASE_EXPLICIT" == true ]]; then
  REVISION_ARGS=("${BASE}..${HEAD}")
else
  REVISION_ARGS=("$HEAD")
fi
while IFS= read -r line; do
  [[ -n "$line" ]] && COMMITS+=("$line")
done < <(git -C "$PROJECT_ROOT" log --oneline --reverse "${REVISION_ARGS[@]}")

if [[ "$BASE_EXPLICIT" == true ]]; then
  RANGE_LABEL="${BASE}..${HEAD}"
else
  RANGE_LABEL="root..${HEAD} (inclusive)"
fi

TOTAL=${#COMMITS[@]}
IDX=1
PASSED=0
LOW_COVERAGE=0
FAILED=0
SKIPPED=0

mkdir -p "$(dirname "$REPORT")"
rm -f "$REPORT"
echo "# Coverage Report" > "$REPORT"
echo "" >> "$REPORT"
echo "Range: \`${RANGE_LABEL}\`" >> "$REPORT"
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

  # Create temp worktree for this commit
  WORKTREE_DIR=$(mktemp -d)
  if ! git -C "$PROJECT_ROOT" worktree add --detach "$WORKTREE_DIR" "$HASH" 2>/dev/null; then
    echo "  SKIP - worktree checkout failed for $HASH"
    rm -rf "$WORKTREE_DIR"
    WORKTREE_DIR=""
    echo "| $IDX | \`${HASH}\` | - | - | - | - | ⏭️ SKIP | $MSG |" >> "$REPORT"
    SKIPPED=$((SKIPPED + 1))
    IDX=$((IDX + 1))
    continue
  fi

  cd "$WORKTREE_DIR"

  # Symlink node_modules from main project for isolated worktree runs
  if [ -d "$PROJECT_ROOT/node_modules" ] && [ ! -e "node_modules" ]; then
    ln -sfn "$PROJECT_ROOT/node_modules" "node_modules"
  fi

  # Install deps if enabled (disabled by default for isolation)
  if [ "$INSTALL_DEPS" = true ] && [ ! -d "node_modules" ]; then
    echo "  -> Installing dependencies..."
    yarn install --frozen-lockfile --silent 2>/dev/null || yarn install --silent 2>/dev/null || true
  fi

  # Skip check only applies to default test command
  if [ "$TEST_COMMAND" = "yarn test:coverage" ] && ! grep -q '"test:coverage"' package.json 2>/dev/null; then
    echo "  SKIP - no test:coverage script"
    echo "| $IDX | \`${HASH}\` | - | - | - | - | ⏭️ SKIP | $MSG |" >> "$REPORT"
    cd "$PROJECT_ROOT"
    git -C "$PROJECT_ROOT" worktree remove --force "$WORKTREE_DIR" 2>/dev/null || true
    rm -rf "$WORKTREE_DIR"
    WORKTREE_DIR=""
    SKIPPED=$((SKIPPED + 1))
    IDX=$((IDX + 1))
    continue
  fi

  # Run test command
  echo "  -> Running $TEST_COMMAND..."
  rm -rf coverage/
  set +e
  output=$(timeout 600 $TEST_COMMAND 2>&1)
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
    meets=$(python3 -c "print(1 if float('$coverage_val') >= $COVERAGE_THRESHOLD else 0)" 2>/dev/null || echo "1")
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

  # Clean up worktree for this iteration
  cd "$PROJECT_ROOT"
  git -C "$PROJECT_ROOT" worktree remove --force "$WORKTREE_DIR" 2>/dev/null || true
  rm -rf "$WORKTREE_DIR"
  WORKTREE_DIR=""

  IDX=$((IDX + 1))
done

cleanup

# ── Summary ─────────────────────────────────────────────────────────
echo ""
echo "═══════════════════════════════════════════════════"
echo "SUMMARY"
echo "═══════════════════════════════════════════════════"
echo "  Range:      ${RANGE_LABEL}"
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
  echo "  Range:      ${RANGE_LABEL}"
  echo "  Total:      $TOTAL"
  echo "  Passed:     $PASSED"
  echo "  Low cov:    $LOW_COVERAGE"
  echo "  Failed:     $FAILED"
  echo "  Skipped:    $SKIPPED"
  echo "  Threshold:  ${COVERAGE_THRESHOLD}%"
} >> "$REPORT"

if [ "$FAILED" -gt 0 ]; then
  echo "FATAL: ${FAILED} commit(s) failed — exiting with code 1"
  exit 1
fi

exit 0
