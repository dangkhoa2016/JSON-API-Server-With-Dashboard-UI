#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
OUTPUT_DIR="$SCRIPT_DIR"
COVERAGE_THRESHOLD=80
TEST_COMMAND="yarn test:coverage"
INSTALL_DEPS=false
STRICT=false
MAX_RECOVERY_COMMITS=2
TIMEOUT_SECONDS=600

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
    --strict)
      STRICT=true
      shift
      ;;
    --max-recovery-commits)
      [[ $# -lt 2 ]] && { echo "Missing value for $1" >&2; exit 2; }
      MAX_RECOVERY_COMMITS="$2"
      shift 2
      ;;
    --max-recovery-commits=*)
      MAX_RECOVERY_COMMITS="${1#*=}"
      if [ -z "$MAX_RECOVERY_COMMITS" ]; then echo "Empty value for --max-recovery-commits" >&2; exit 2; fi
      shift
      ;;
    --timeout)
      [[ $# -lt 2 ]] && { echo "Missing value for $1" >&2; exit 2; }
      TIMEOUT_SECONDS="$2"
      shift 2
      ;;
    --timeout=*)
      TIMEOUT_SECONDS="${1#*=}"
      if [ -z "$TIMEOUT_SECONDS" ]; then echo "Empty value for --timeout" >&2; exit 2; fi
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

if ! [[ "$MAX_RECOVERY_COMMITS" =~ ^[0-9]+$ ]] || [ "$MAX_RECOVERY_COMMITS" -lt 0 ]; then
  echo "Invalid --max-recovery-commits: $MAX_RECOVERY_COMMITS (must be >= 0)" >&2
  exit 2
fi

if ! [[ "$TIMEOUT_SECONDS" =~ ^[0-9]+$ ]] || [ "$TIMEOUT_SECONDS" -lt 1 ]; then
  echo "Invalid --timeout: $TIMEOUT_SECONDS (must be >= 1)" >&2
  exit 2
fi

RESULTS_DIR="$OUTPUT_DIR/results"
REPORT="$OUTPUT_DIR/coverage-report.md"
SUMMARY_REPORT="$OUTPUT_DIR/commit-policy-summary.md"
TABLE_PLAIN=""
TABLE_LINKED=""
mkdir -p "$RESULTS_DIR"

WORKTREE_DIR=""
cleanup() {
  if [ -n "$WORKTREE_DIR" ] && [ -d "$WORKTREE_DIR" ]; then
    git -C "$PROJECT_ROOT" worktree remove --force "$WORKTREE_DIR" 2>/dev/null || true
    rm -rf "$WORKTREE_DIR"
  fi
  if [ -n "$TABLE_PLAIN" ] && [ -n "$TABLE_LINKED" ]; then
    rm -f "$TABLE_PLAIN" "$TABLE_LINKED"
  fi
}
trap cleanup EXIT
trap 'exit 130' INT
trap 'exit 143' TERM

COMMITS=()
if [[ "$BASE_EXPLICIT" == true ]]; then
  REVISION_ARGS=("${BASE}..${HEAD}")
else
  REVISION_ARGS=("$HEAD")
fi
while IFS= read -r line; do
  [[ -n "$line" ]] && COMMITS+=("$line")
done < <(git -C "$PROJECT_ROOT" log --no-merges --oneline --reverse "${REVISION_ARGS[@]}")

if [[ "$BASE_EXPLICIT" == true ]]; then
  RANGE_LABEL="${BASE}..${HEAD}"
else
  RANGE_LABEL="root..${HEAD} (inclusive)"
fi

TOTAL=${#COMMITS[@]}

# Per-commit result storage (parallel to COMMITS)
declare -a ROW_HASH ROW_MSG ROW_STMTS ROW_BRANCH ROW_FUNCS ROW_LINES ROW_STATUS
PASSED=0
RAW_LOW=0
BOOTSTRAP_COUNT=0
NOT_APPLICABLE=0
TIMEOUT_COUNT=0
CHECKOUT_FAIL_COUNT=0
NO_DATA_COUNT=0
REAL_FAIL_COUNT=0
RECOVERED_LOW=0
UNRECOVERED_LOW=0
INSTALL_FAIL_COUNT=0
DEP_MODE="none"

EMPTY_TREE="4b825dc642cb6eb9a060e54bf8d69288fbee4904"

is_testable_change() {
  local parent="$1" hash="$2" file
  while IFS= read -r file; do
    [ -z "$file" ] && continue
    case "$file" in
      api/*|web/*|db/*|scripts/*)
        case "$file" in
          *.ts|*.tsx|*.vue|*.js|*.mjs|*.cjs) return 0 ;;
        esac
        ;;
    esac
  done < <(git -C "$PROJECT_ROOT" diff --name-only "$parent" "$hash")
  return 1
}

# Compare a coverage metric against the threshold; value and threshold are
# passed as argv so raw tool output is never interpolated into Python source.
metric_meets_threshold() {
  python3 -c 'import sys
value, threshold = float(sys.argv[1]), float(sys.argv[2])
print(1 if value >= threshold else 0)' "$1" "$2" 2>/dev/null || echo "0"
}

# True only when all four coverage metrics are present and numeric.
# metrics_valid() must run after stmts/branch/funcs/lines are set.
metrics_valid() {
  [[ "$stmts" =~ ^[0-9]+([.][0-9]+)?$ ]] &&
  [[ "$branch" =~ ^[0-9]+([.][0-9]+)?$ ]] &&
  [[ "$funcs" =~ ^[0-9]+([.][0-9]+)?$ ]] &&
  [[ "$lines" =~ ^[0-9]+([.][0-9]+)?$ ]]
}

# True only when the test summary proves the suite passed with no failures.
test_summary_passed() {
  local clean_output
  clean_output=$(printf '%s\n' "$output" | sed -E 's/\x1B\[[0-9;]*[mK]//g')
  grep -Eq 'Test Files[[:space:]]+[0-9]+ passed' <<< "$clean_output" &&
    grep -Eq 'Tests[[:space:]]+[0-9]+ passed' <<< "$clean_output" &&
    ! grep -Eq '([0-9]+ failed|Unhandled Errors?|^FAIL[[:space:]])' <<< "$clean_output"
}

IDX=1
for entry in "${COMMITS[@]}"; do
  HASH=$(echo "$entry" | awk '{print $1}')
  MSG=$(echo "$entry" | cut -d' ' -f2-)
  SAFE_MSG=$(echo "$MSG" | sed 's/[^a-zA-Z0-9._-]/_/g' | head -c 80)
  LOGFILE="$RESULTS_DIR/${IDX}-${HASH}-${SAFE_MSG}.log"

  echo ""
  echo "========================================"
  echo "[${IDX}/${TOTAL}] Checking ${HASH}: ${MSG}"
  echo "========================================"

  ROW_HASH[$IDX]="$HASH"
  ROW_MSG[$IDX]="$MSG"

  # Bootstrap: no dependency lockfile introduced yet — tests cannot run.
  if ! git -C "$PROJECT_ROOT" cat-file -e "${HASH}:yarn.lock" 2>/dev/null; then
    echo "  BOOTSTRAP - no dependency lockfile yet"
    ROW_STATUS[$IDX]="BOOTSTRAP"
    BOOTSTRAP_COUNT=$((BOOTSTRAP_COUNT + 1))
    IDX=$((IDX + 1))
    continue
  fi

  WORKTREE_DIR=$(mktemp -d)
  if [ -n "${VERIFIER_WORKTREE_CMD:-}" ]; then
    if ! $VERIFIER_WORKTREE_CMD "$WORKTREE_DIR" "$HASH" 2>/dev/null; then
      rm -rf "$WORKTREE_DIR"
      WORKTREE_DIR=""
      echo "  CHECKOUT FAIL - worktree checkout failed for $HASH"
      ROW_STATUS[$IDX]="CHECKOUT FAIL"
      CHECKOUT_FAIL_COUNT=$((CHECKOUT_FAIL_COUNT + 1))
      IDX=$((IDX + 1))
      continue
    fi
  elif ! git -C "$PROJECT_ROOT" worktree add --detach "$WORKTREE_DIR" "$HASH" 2>/dev/null; then
    rm -rf "$WORKTREE_DIR"
    WORKTREE_DIR=""
    echo "  CHECKOUT FAIL - worktree checkout failed for $HASH"
    ROW_STATUS[$IDX]="CHECKOUT FAIL"
    CHECKOUT_FAIL_COUNT=$((CHECKOUT_FAIL_COUNT + 1))
    IDX=$((IDX + 1))
    continue
  fi

  cd "$WORKTREE_DIR"

  # Not applicable: commit changes no testable code, so coverage is undefined.
  PARENT="${HASH}^"
  if ! git -C "$PROJECT_ROOT" cat-file -e "$PARENT" 2>/dev/null; then
    PARENT="$EMPTY_TREE"
  fi
  if ! is_testable_change "$PARENT" "$HASH"; then
    echo "  NOT APPLICABLE - commit changes no testable code"
    cd "$PROJECT_ROOT"
    git -C "$PROJECT_ROOT" worktree remove --force "$WORKTREE_DIR" 2>/dev/null || true
    rm -rf "$WORKTREE_DIR"
    WORKTREE_DIR=""
    ROW_STATUS[$IDX]="NOT APPLICABLE"
    NOT_APPLICABLE=$((NOT_APPLICABLE + 1))
    IDX=$((IDX + 1))
    continue
  fi

  # Symlink node_modules from main project for isolated worktree runs
  if [ -d "$PROJECT_ROOT/node_modules" ] && [ ! -e "node_modules" ]; then
    ln -sfn "$PROJECT_ROOT/node_modules" "node_modules"
    DEP_MODE="reuse"
  fi

  # Install deps if enabled (immutable only; a failing install fails the commit)
  if [ "$INSTALL_DEPS" = true ] && [ ! -e "node_modules" ]; then
    echo "  -> Installing dependencies..."
    if yarn install --immutable --silent 2>/dev/null; then
      DEP_MODE="install-immutable"
    else
      echo "  INSTALL FAIL - immutable dependency installation failed"
      ROW_STATUS[$IDX]="INSTALL FAIL"
      INSTALL_FAIL_COUNT=$((INSTALL_FAIL_COUNT + 1))
      cd "$PROJECT_ROOT"
      git -C "$PROJECT_ROOT" worktree remove --force "$WORKTREE_DIR" 2>/dev/null || true
      rm -rf "$WORKTREE_DIR"
      WORKTREE_DIR=""
      IDX=$((IDX + 1))
      continue
    fi
  fi

  echo "  -> Running $TEST_COMMAND..."
  rm -rf coverage/
  set +e
  # vitest auto-adds a github-actions reporter in CI that appends a "Vitest Test
  # Report" block to $GITHUB_STEP_SUMMARY on every run; empty the path so per-commit
  # runs never pollute the job summary (CI posts commit-policy-summary.md instead).
  output=$(GITHUB_STEP_SUMMARY= timeout "$TIMEOUT_SECONDS" $TEST_COMMAND 2>&1)
  exit_code=$?
  set -e
  echo "$output" > "$LOGFILE"

  stmts=$(echo "$output" | grep 'All files' | awk '{print $4}' | tr -d '|' | head -1) || true
  branch=$(echo "$output" | grep 'All files' | awk '{print $6}' | tr -d '|' | head -1) || true
  funcs=$(echo "$output" | grep 'All files' | awk '{print $8}' | tr -d '|' | head -1) || true
  lines=$(echo "$output" | grep 'All files' | awk '{print $10}' | tr -d '|' | head -1) || true

  if [ -z "$stmts" ]; then
    stmts=$(echo "$output" | grep -oP 'Statements\s*:\s*\K[\d.]+' | head -1) || true
    branch=$(echo "$output" | grep -oP 'Branches\s*:\s*\K[\d.]+' | head -1) || true
    funcs=$(echo "$output" | grep -oP 'Functions\s*:\s*\K[\d.]+' | head -1) || true
    lines=$(echo "$output" | grep -oP 'Lines\s*:\s*\K[\d.]+' | head -1) || true
  fi

  if [ -z "$stmts" ]; then
    stmts=$(echo "$output" | grep 'All files' | awk -F'|' '{print $2}' | tr -d ' ' | head -1) || true
    branch=$(echo "$output" | grep 'All files' | awk -F'|' '{print $3}' | tr -d ' ' | head -1) || true
    funcs=$(echo "$output" | grep 'All files' | awk -F'|' '{print $4}' | tr -d ' ' | head -1) || true
    lines=$(echo "$output" | grep 'All files' | awk -F'|' '{print $5}' | tr -d ' ' | head -1) || true
  fi

  ROW_STMTS[$IDX]="${stmts:--}"
  ROW_BRANCH[$IDX]="${branch:--}"
  ROW_FUNCS[$IDX]="${funcs:--}"
  ROW_LINES[$IDX]="${lines:--}"

  # A non-zero exit is treated as a recoverable threshold-only failure only
  # when all four metrics parse, the test summary confirms the suite passed,
  # and the output confirms a threshold violation; otherwise it is a real
  # failure and must not be ignored.
  threshold_only=false
  if [ $exit_code -ne 0 ] &&
     metrics_valid &&
     test_summary_passed &&
     grep -q "does not meet global threshold" <<< "$output"; then
    threshold_only=true
  fi

  if [ $exit_code -eq 124 ]; then
    ROW_STATUS[$IDX]="TIMEOUT"
    TIMEOUT_COUNT=$((TIMEOUT_COUNT + 1))
    echo "  TIMEOUT after ${TIMEOUT_SECONDS}s"
  elif [ $exit_code -ne 0 ] && [ "$threshold_only" = false ]; then
    ROW_STATUS[$IDX]="FAIL ($exit_code)"
    REAL_FAIL_COUNT=$((REAL_FAIL_COUNT + 1))
    echo "  FAIL ($exit_code)"
  elif ! metrics_valid; then
    ROW_STATUS[$IDX]="NO DATA"
    NO_DATA_COUNT=$((NO_DATA_COUNT + 1))
    echo "  NO DATA"
  else
    low_parts=""
    for metric_entry in "Statements:$stmts" "Branches:$branch" "Functions:$funcs" "Lines:$lines"; do
      metric_name="${metric_entry%%:*}"
      metric_value="${metric_entry#*:}"
      if [ "$(metric_meets_threshold "$metric_value" "$COVERAGE_THRESHOLD")" != "1" ]; then
        if [ -n "$low_parts" ]; then
          low_parts="$low_parts, "
        fi
        low_parts="$low_parts${metric_name} ${metric_value}% < ${COVERAGE_THRESHOLD}%"
      fi
    done
    if [ -n "$low_parts" ]; then
      ROW_STATUS[$IDX]="LOW (${low_parts})"
      RAW_LOW=$((RAW_LOW + 1))
      echo "  LOW (${low_parts})"
    else
      ROW_STATUS[$IDX]="PASS"
      PASSED=$((PASSED + 1))
      echo "  PASS | Stmts: ${stmts}% Branch: ${branch}% Funcs: ${funcs}% Lines: ${lines}%"
    fi
  fi

  cd "$PROJECT_ROOT"
  git -C "$PROJECT_ROOT" worktree remove --force "$WORKTREE_DIR" 2>/dev/null || true
  rm -rf "$WORKTREE_DIR"
  WORKTREE_DIR=""

  IDX=$((IDX + 1))
done

cleanup

# A LOW commit is acceptable only if coverage recovers within the next
# MAX_RECOVERY_COMMITS adjacent commits; otherwise it is a debt failure.
for ((i = 1; i <= TOTAL; i++)); do
  st="${ROW_STATUS[$i]}"
  if [[ "$st" == LOW* ]]; then
    recovered=false
    for ((j = i + 1; j <= TOTAL && j <= i + MAX_RECOVERY_COMMITS; j++)); do
      case "${ROW_STATUS[$j]}" in
        PASS|RECOVERED*) recovered=true ;;
      esac
    done
    if [ "$recovered" = true ]; then
      ROW_STATUS[$i]="RECOVERED ($st)"
      RECOVERED_LOW=$((RECOVERED_LOW + 1))
    else
      ROW_STATUS[$i]="UNRECOVERED ($st)"
      UNRECOVERED_LOW=$((UNRECOVERED_LOW + 1))
    fi
    RAW_LOW=$((RAW_LOW - 1))
  fi
done

NOT_APPLICABLE_AND_BOOTSTRAP=$((BOOTSTRAP_COUNT + NOT_APPLICABLE))

# Escape Markdown table cell content so message text cannot break the table
# layout. Backslash first so later substitutions stay reversible.
md_escape_cell() {
  printf '%s' "$1" | sed 's/\\/\\\\/g; s/|/\\|/g; s/`/\\`/g'
}

VERDICT="PASS"
if [ "$REAL_FAIL_COUNT" -gt 0 ]; then
  VERDICT="FAIL"
elif [ "$STRICT" = true ] && { [ "$CHECKOUT_FAIL_COUNT" -gt 0 ] || [ "$TIMEOUT_COUNT" -gt 0 ] || [ "$NO_DATA_COUNT" -gt 0 ] || [ "$UNRECOVERED_LOW" -gt 0 ] || [ "$INSTALL_FAIL_COUNT" -gt 0 ]; }; then
  VERDICT="FAIL"
fi

TABLE_PLAIN="$(mktemp)"
TABLE_LINKED="$(mktemp)"
for ((i = 1; i <= TOTAL; i++)); do
  plain_cell="\`${ROW_HASH[$i]}\`"
  linked_cell="$plain_cell"
  if [ -n "${GITHUB_REPOSITORY:-}" ]; then
    full_hash="$(git -C "$PROJECT_ROOT" rev-parse "${ROW_HASH[$i]}")"
    linked_cell="[\`${ROW_HASH[$i]:0:7}\`](https://github.com/${GITHUB_REPOSITORY}/commit/${full_hash})"
  fi
  escaped_msg="$(md_escape_cell "${ROW_MSG[$i]}")"
  printf '| %s | %s | %s | %s | %s | %s | %s | %s |\n' \
    "$i" "$plain_cell" "${ROW_STMTS[$i]:--}" "${ROW_BRANCH[$i]:--}" "${ROW_FUNCS[$i]:--}" "${ROW_LINES[$i]:--}" "${ROW_STATUS[$i]}" "$escaped_msg" >> "$TABLE_PLAIN"
  printf '| %s | %s | %s | %s | %s | %s | %s | %s |\n' \
    "$i" "$linked_cell" "${ROW_STMTS[$i]:--}" "${ROW_BRANCH[$i]:--}" "${ROW_FUNCS[$i]:--}" "${ROW_LINES[$i]:--}" "${ROW_STATUS[$i]}" "$escaped_msg" >> "$TABLE_LINKED"
done

mkdir -p "$(dirname "$REPORT")"
rm -f "$REPORT"
{
  echo "# Coverage Report"
  echo ""
  echo "Generated: $(date -Is 2>/dev/null || date)"
  echo "Range: \`${RANGE_LABEL}\`"
  echo "Threshold: ${COVERAGE_THRESHOLD}%"
  echo "Recovery policy: LOW must recover within ${MAX_RECOVERY_COMMITS} adjacent commit(s)"
  echo "Dependency mode: ${DEP_MODE}"
  echo "Node: $(node -v 2>/dev/null || echo 'unknown')"
  echo "Yarn: $(yarn --version 2>/dev/null || echo 'unknown')"
  echo ""
  echo "| # | Commit | Stmts | Branch | Funcs | Lines | Status | Message |"
  echo "|--:|--------|------:|-------:|------:|------:|--------|---------|"
  cat "$TABLE_PLAIN"
  echo ""
  echo "═══════════════════════════════════════════════════"
  echo "SUMMARY"
  echo "═══════════════════════════════════════════════════"
  printf "  %-29s%s\n" "Range:" "${RANGE_LABEL}"
  printf "  %-29s%s\n" "Total:" "$TOTAL"
  printf "  %-29s%s\n" "Passed:" "$PASSED"
  printf "  %-29s%s\n" "Temporary low/recovered:" "$RECOVERED_LOW"
  printf "  %-29s%s\n" "Unrecovered low:" "$UNRECOVERED_LOW"
  printf "  %-29s%s\n" "Bootstrap/not applicable:" "$NOT_APPLICABLE_AND_BOOTSTRAP"
  printf "  %-29s%s\n" "Real failures:" "$REAL_FAIL_COUNT"
  printf "  %-29s%s\n" "Timeouts:" "$TIMEOUT_COUNT"
  printf "  %-29s%s\n" "Checkout failures:" "$CHECKOUT_FAIL_COUNT"
  printf "  %-29s%s\n" "Unexpected no-data:" "$NO_DATA_COUNT"
  printf "  %-29s%s\n" "Install failures:" "$INSTALL_FAIL_COUNT"
  printf "  %-29s%s\n" "Threshold:" "${COVERAGE_THRESHOLD}%"
} >> "$REPORT"

mkdir -p "$(dirname "$SUMMARY_REPORT")"
rm -f "$SUMMARY_REPORT"
{
  echo "## Commit Policy — Coverage Report"
  echo ""
  echo "Generated: $(date -Is 2>/dev/null || date)"
  echo "Range: \`${RANGE_LABEL}\`"
  echo "Threshold: ${COVERAGE_THRESHOLD}%"
  echo "Recovery policy: LOW must recover within ${MAX_RECOVERY_COMMITS} adjacent commit(s)"
  echo "Dependency mode: ${DEP_MODE}"
  echo "Node: $(node -v 2>/dev/null || echo 'unknown') · Yarn: $(yarn --version 2>/dev/null || echo 'unknown')"
  echo ""
  echo "| # | Commit | Stmts | Branch | Funcs | Lines | Status | Message |"
  echo "|--:|--------|------:|-------:|------:|------:|--------|---------|"
  cat "$TABLE_LINKED"
  echo ""
  echo "Result: ${PASSED} passed · ${RECOVERED_LOW} recovered · ${UNRECOVERED_LOW} unrecovered · ${NOT_APPLICABLE_AND_BOOTSTRAP} bootstrap/n-a · ${REAL_FAIL_COUNT} failures"
  echo ""
  echo "Verdict: **${VERDICT}**"
} >> "$SUMMARY_REPORT"

rm -f "$TABLE_PLAIN" "$TABLE_LINKED"

echo ""
echo "═══════════════════════════════════════════════════"
echo "SUMMARY"
echo "═══════════════════════════════════════════════════"
printf "  %-29s%s\n" "Range:" "${RANGE_LABEL}"
printf "  %-29s%s\n" "Total:" "$TOTAL"
printf "  %-29s%s\n" "Passed:" "$PASSED"
printf "  %-29s%s\n" "Temporary low/recovered:" "$RECOVERED_LOW"
printf "  %-29s%s\n" "Unrecovered low:" "$UNRECOVERED_LOW"
printf "  %-29s%s\n" "Bootstrap/not applicable:" "$NOT_APPLICABLE_AND_BOOTSTRAP"
printf "  %-29s%s\n" "Real failures:" "$REAL_FAIL_COUNT"
printf "  %-29s%s\n" "Timeouts:" "$TIMEOUT_COUNT"
printf "  %-29s%s\n" "Checkout failures:" "$CHECKOUT_FAIL_COUNT"
printf "  %-29s%s\n" "Unexpected no-data:" "$NO_DATA_COUNT"
printf "  %-29s%s\n" "Install failures:" "$INSTALL_FAIL_COUNT"
printf "  %-29s%s\n" "Threshold:" "${COVERAGE_THRESHOLD}%"
echo ""
echo "Report written to $REPORT"
echo "Summary written to $SUMMARY_REPORT"

if [ "$REAL_FAIL_COUNT" -gt 0 ]; then
  echo "FATAL: ${REAL_FAIL_COUNT} commit(s) failed — exiting with code 1"
  exit 1
fi

if [ "$STRICT" = true ]; then
  if [ "$CHECKOUT_FAIL_COUNT" -gt 0 ] || [ "$TIMEOUT_COUNT" -gt 0 ] ||
     [ "$NO_DATA_COUNT" -gt 0 ] || [ "$UNRECOVERED_LOW" -gt 0 ] ||
     [ "$INSTALL_FAIL_COUNT" -gt 0 ]; then
    echo "FATAL: strict mode — checkout failures, timeouts, unexpected no-data, install failures, or unrecovered LOW present"
    exit 1
  fi
fi

exit 0
