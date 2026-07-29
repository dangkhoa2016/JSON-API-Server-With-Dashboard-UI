#!/usr/bin/env bash
set -euo pipefail

echo "=== Test: verify-commit-coverage.sh preserves repo state ==="

# Resolve paths before changing directory
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
SCRIPT="$PROJECT_ROOT/manual-test-coverage/verify-commit-coverage.sh"

# Single validated temp root for all artifacts
TEST_TMP_ROOT="$(mktemp -d)"
TEST_REPO="$TEST_TMP_ROOT/repo"
STUB_MARKER="$TEST_TMP_ROOT/stub-marker.log"
OUTPUT_DIR="$TEST_TMP_ROOT/output"
mkdir -p "$TEST_REPO" "$OUTPUT_DIR"

cleanup() {
  if [[ -n "${TEST_TMP_ROOT:-}" && -d "$TEST_TMP_ROOT" ]]; then
    rm -rf -- "$TEST_TMP_ROOT"
  fi
}
trap cleanup EXIT
trap 'exit 130' INT
trap 'exit 143' TERM

# Create stub test command that appends $PWD to marker and emits coverage
STUB_SCRIPT="$TEST_TMP_ROOT/stub-test.sh"
cat > "$STUB_SCRIPT" << 'STUB'
#!/usr/bin/env bash
set -euo pipefail
printf '%s\n' "$PWD" >> "$1"
printf 'All files | 100 | 100 | 100 | 100 |\n'
STUB
chmod +x "$STUB_SCRIPT"

# Init test repo
cd "$TEST_REPO"
git init
git config user.email "test@test.com"
git config user.name "Test"

# First commit
echo "file1" > file1.txt
git add file1.txt
git commit -m "chore: add first fixture"

# Second commit
echo "file2" > file2.txt
git add file2.txt
git commit -m "chore: add second fixture"

# Record fixture SHAs
FIXTURE_ROOT_SHA="$(git rev-parse HEAD~1)"
FIXTURE_HEAD_SHA="$(git rev-parse HEAD)"

run_verifier() {
  local run_label="$1"

  : > "$STUB_MARKER"
  rm -rf -- "$OUTPUT_DIR"
  mkdir -p "$OUTPUT_DIR"

  # Create dirty state: tracked file modified, untracked file
  echo "dirty" >> file1.txt
  echo "untracked" > untracked.txt

  # Record state before running the script
  ORIG_HEAD=$(git rev-parse HEAD)
  ORIG_STATUS=$(git status --porcelain=v1 | sort)
  ORIG_WORKTREES=$(git worktree list --porcelain)

  # Now, run verify-commit-coverage.sh against the fixture repo
  if [ -f "$SCRIPT" ]; then
    timeout 30 bash "$SCRIPT" \
      --threshold 80 \
      --project-root "$TEST_REPO" \
      --output-dir "$OUTPUT_DIR" \
      --test-command "bash $STUB_SCRIPT $STUB_MARKER"
  fi

  # Record state after running
  AFTER_HEAD=$(git rev-parse HEAD)
  AFTER_STATUS=$(git status --porcelain=v1 | sort)
  AFTER_WORKTREES=$(git worktree list --porcelain)

  # Compare HEAD
  if [ "$ORIG_HEAD" != "$AFTER_HEAD" ]; then
    echo "FAIL [${run_label}]: HEAD changed!"
    echo "  Before: $ORIG_HEAD"
    echo "  After:  $AFTER_HEAD"
    exit 1
  fi

  # Compare working tree
  if [ "$ORIG_STATUS" != "$AFTER_STATUS" ]; then
    echo "FAIL [${run_label}]: Working tree changed!"
    diff <(echo "$ORIG_STATUS") <(echo "$AFTER_STATUS")
    exit 1
  fi

  # Compare worktree list
  if [ "$ORIG_WORKTREES" != "$AFTER_WORKTREES" ]; then
    echo "FAIL [${run_label}]: Worktree list changed!"
    diff <(echo "$ORIG_WORKTREES") <(echo "$AFTER_WORKTREES")
    exit 1
  fi

  echo "  Repo state preserved [${run_label}]"

  # Restore dirty state for next run
  git checkout -- file1.txt 2>/dev/null || true
  rm -f untracked.txt
}

# Run twice to catch stale worktree registrations
for i in 1 2; do
  echo "--- Run ${i} ---"
  run_verifier "run-${i}"
done

# Assert marker exists (verifier ran stub test command in fixture worktree)
if [ ! -f "$STUB_MARKER" ]; then
  echo "FAIL: Stub test marker not found (verifier ran on real project, not fixture)"
  exit 1
fi

mapfile -t MARKER_LINES < "$STUB_MARKER"
if [[ "${#MARKER_LINES[@]}" -eq 0 ]]; then
  echo "FAIL: No verified commits recorded in marker"
  exit 1
fi

for marker_path in "${MARKER_LINES[@]}"; do
  if [[ "$marker_path" == "$PROJECT_ROOT"* ]]; then
    echo "FAIL: Stub test ran in real project root instead of fixture"
    echo "  Real project: $PROJECT_ROOT"
    echo "  Marker content: $marker_path"
    exit 1
  fi
done

# ── Assert report content ───────────────────────────────────────
fail() {
  echo "FAIL: $*" >&2
  exit 1
}

assert_file_contains() {
  local file="$1"
  local text="$2"
  grep -Fq -- "$text" "$file" || fail "$file does not contain: $text"
}

REPORT="$OUTPUT_DIR/coverage-report.md"
[[ -f "$REPORT" ]] || fail "coverage report was not created"
assert_file_contains "$REPORT" "${FIXTURE_ROOT_SHA:0:7}"
assert_file_contains "$REPORT" "${FIXTURE_HEAD_SHA:0:7}"
assert_file_contains "$REPORT" "PASS"

# ── Test explicit base-exclusive range ──────────────────────────
echo ""
echo "=== Explicit base-exclusive range ==="
: > "$STUB_MARKER"
EXPLICIT_OUTPUT_DIR="$TEST_TMP_ROOT/explicit-output"
mkdir -p "$EXPLICIT_OUTPUT_DIR"

timeout 30 bash "$SCRIPT" \
  --threshold 80 \
  --project-root "$TEST_REPO" \
  --output-dir "$EXPLICIT_OUTPUT_DIR" \
  --test-command "bash $STUB_SCRIPT $STUB_MARKER" \
  "$FIXTURE_ROOT_SHA" "$FIXTURE_HEAD_SHA"

mapfile -t EXPLICIT_MARKERS < "$STUB_MARKER"
[[ "${#EXPLICIT_MARKERS[@]}" -eq 1 ]] ||
  fail "explicit range should verify exactly one commit"

EXPLICIT_REPORT="$EXPLICIT_OUTPUT_DIR/coverage-report.md"
assert_file_contains "$EXPLICIT_REPORT" "${FIXTURE_HEAD_SHA:0:7}"
# grep for the short SHA in backtick form (table rows use `sha` format)
HEAD_SHORT="${FIXTURE_HEAD_SHA:0:7}"
ROOT_SHORT="${FIXTURE_ROOT_SHA:0:7}"
if grep -Fq -- "\`${ROOT_SHORT}\`" "$EXPLICIT_REPORT"; then
  fail "explicit BASE..HEAD report table lists BASE commit"
fi

echo "  Explicit range: PASS (1 commit, BASE excluded)"

# ── Final PASS ──────────────────────────────────────────────────
echo ""
echo "PASS: repo state preserved, root included, output isolated"
echo "  HEAD: $(git rev-parse HEAD)"
echo "  Status: unchanged"
echo "  Worktrees: unchanged"
echo "  Marker (fixture worktree): ${MARKER_LINES[*]}"
