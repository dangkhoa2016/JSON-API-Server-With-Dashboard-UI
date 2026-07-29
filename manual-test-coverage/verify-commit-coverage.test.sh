#!/usr/bin/env bash
set -euo pipefail

echo "=== Test: verify-commit-coverage.sh status classification ==="

# Resolve paths before changing directory
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
SCRIPT="$PROJECT_ROOT/manual-test-coverage/verify-commit-coverage.sh"

# Single validated temp root for all artifacts
TEST_TMP_ROOT="$(mktemp -d)"

cleanup() {
  if [[ -n "${TEST_TMP_ROOT:-}" && -d "$TEST_TMP_ROOT" ]]; then
    rm -rf -- "$TEST_TMP_ROOT"
  fi
}
trap cleanup EXIT
trap 'exit 130' INT
trap 'exit 143' TERM

fail() {
  echo "FAIL: $*" >&2
  exit 1
}

assert_file_contains() {
  local file="$1" text="$2"
  grep -Fq -- "$text" "$file" || fail "$file does not contain: $text"
}

init_repo() {
  local repo="$1"
  mkdir -p "$repo"
  git init -q "$repo"
  git -C "$repo" config user.email "test@test.com"
  git -C "$repo" config user.name "Test"
}

# Write a file and commit it; the file is only staged when the content arg is non-empty.
commit_file() {
  local repo="$1" path="$2" msg="$3" content="$4"
  mkdir -p "$repo/$(dirname "$path")"
  printf '%s\n' "$content" > "$repo/$path"
  git -C "$repo" add "$path"
  git -C "$repo" commit -q -m "$msg"
}

run_verifier() {
  local output_dir="$1"
  shift
  rm -rf -- "$output_dir"
  mkdir -p "$output_dir"
  timeout 60 bash "$SCRIPT" --project-root "$FIXTURE_REPO" --output-dir "$output_dir" "$@" >/dev/null 2>&1
  echo $?
}

# Standard two-commit repo; second commit is the designated LOW target.
setup_repo() {
  init_repo "$FIXTURE_REPO"
  commit_file "$FIXTURE_REPO" "yarn.lock" "chore: add lockfile" "lock"
  commit_file "$FIXTURE_REPO" "api/foo.ts" "feat: add foo" "export const foo = 1"
  LOW_SHA=$(git -C "$FIXTURE_REPO" rev-parse HEAD)
  export LOW_SHA
}

# pass_stub: 100% coverage (used by the state-preservation fixture)
PASS_STUB="$TEST_TMP_ROOT/stub-pass.sh"
cat > "$PASS_STUB" << 'STUB'
#!/usr/bin/env bash
set -euo pipefail
printf '%s\n' "$PWD" >> "$1"
printf 'All files | 100 | 100 | 100 | 100 |\n'
STUB
chmod +x "$PASS_STUB"

# low_stub: emits LOW for a designated commit SHA, PASS otherwise
LOW_STUB="$TEST_TMP_ROOT/stub-low.sh"
cat > "$LOW_STUB" << 'STUB'
#!/usr/bin/env bash
set -euo pipefail
printf '%s\n' "$PWD" >> "$1"
if [ "$(git -C "$PWD" rev-parse HEAD)" = "${LOW_SHA:-}" ]; then
  printf 'All files | 50 | 50 | 50 | 50 |\n'
else
  printf 'All files | 100 | 100 | 100 | 100 |\n'
fi
STUB
chmod +x "$LOW_STUB"

# fail_stub: exits non-zero, proving the verifier skips real test runs
FAIL_STUB="$TEST_TMP_ROOT/stub-fail.sh"
cat > "$FAIL_STUB" << 'STUB'
#!/usr/bin/env bash
set -euo pipefail
printf '%s\n' "$PWD" >> "$1"
exit 3
STUB
chmod +x "$FAIL_STUB"

# timeout_stub: sleeps past the verifier's per-commit timeout
TIMEOUT_STUB="$TEST_TMP_ROOT/stub-timeout.sh"
cat > "$TIMEOUT_STUB" << 'STUB'
#!/usr/bin/env bash
set -euo pipefail
printf '%s\n' "$PWD" >> "$1"
sleep 5
STUB
chmod +x "$TIMEOUT_STUB"

# nodata_stub: succeeds but emits no coverage data
NODATA_STUB="$TEST_TMP_ROOT/stub-nodata.sh"
cat > "$NODATA_STUB" << 'STUB'
#!/usr/bin/env bash
set -euo pipefail
printf '%s\n' "$PWD" >> "$1"
STUB
chmod +x "$NODATA_STUB"

# threshold_stub: fails the run on coverage thresholds but still emits numbers
# (mirrors vitest failing when statements are below the global threshold)
THRESHOLD_STUB="$TEST_TMP_ROOT/stub-threshold.sh"
cat > "$THRESHOLD_STUB" << 'STUB'
#!/usr/bin/env bash
set -euo pipefail
printf '%s\n' "$PWD" >> "$1"
if [ "$(git -C "$PWD" rev-parse HEAD)" = "${LOW_SHA:-}" ]; then
  printf 'Test Files  1 passed (1)\n'
  printf 'Tests       3 passed (3)\n'
  printf 'All files | 85 | 60 | 90 | 84 |\n'
  printf 'ERROR: Coverage for branches (60%%) does not meet global threshold (80%%)\n' >&2
  exit 1
fi
printf 'Test Files  1 passed (1)\n'
printf 'Tests       3 passed (3)\n'
printf 'All files | 100 | 100 | 100 | 100 |\n'
STUB
chmod +x "$THRESHOLD_STUB"

# mixed_stub: statements meet the threshold but branches do not; same behavior
# as threshold_stub (statements 85, branches 60), so it aliases that stub.
MIXED_STUB="$THRESHOLD_STUB"

# metric_stub: emits a configurable "All files" coverage line for a designated
# commit; used for independent low statements/functions/lines and malformed cases
METRIC_STUB="$TEST_TMP_ROOT/stub-metric.sh"
cat > "$METRIC_STUB" << 'STUB'
#!/usr/bin/env bash
set -euo pipefail
printf '%s\n' "$PWD" >> "$1"
if [ "$(git -C "$PWD" rev-parse HEAD)" = "${LOW_SHA:-}" ]; then
  printf 'Test Files  1 passed (1)\n'
  printf 'Tests       3 passed (3)\n'
  printf 'All files | %s |\n' "${COV_LINE:-}"
  if [ -n "${COV_ERR:-}" ]; then
    printf '%s\n' "$COV_ERR" >&2
  fi
  exit "${COV_EXIT:-0}"
fi
printf 'Test Files  1 passed (1)\n'
printf 'Tests       3 passed (3)\n'
printf 'All files | 100 | 100 | 100 | 100 |\n'
STUB
chmod +x "$METRIC_STUB"

# combined_stub: a real test failure occurs while coverage thresholds also
# fail; this must be classified as a real FAIL, never as recoverable LOW.
COMBINED_STUB="$TEST_TMP_ROOT/stub-combined.sh"
cat > "$COMBINED_STUB" << 'STUB'
#!/usr/bin/env bash
set -euo pipefail
printf '%s\n' "$PWD" >> "$1"
if [ "$(git -C "$PWD" rev-parse HEAD)" = "${LOW_SHA:-}" ]; then
  printf 'FAIL api/foo.test.ts > rejects malformed input\n'
  printf 'AssertionError: expected 500 to be 400\n'
  printf 'Test Files  1 failed | 1 passed (2)\n'
  printf 'Tests       1 failed | 3 passed (4)\n'
  printf 'All files | 85 | 60 | 90 | 84 |\n'
  printf 'ERROR: Coverage for branches (60%%) does not meet global threshold (80%%)\n' >&2
  exit 1
fi
printf 'Test Files  1 passed (1)\n'
printf 'Tests       3 passed (3)\n'
printf 'All files | 100 | 100 | 100 | 100 |\n'
STUB
chmod +x "$COMBINED_STUB"

echo ""
echo "=== Fixture: repo state preservation ==="
FIXTURE_REPO="$TEST_TMP_ROOT/repo-state"
OUTPUT_DIR="$TEST_TMP_ROOT/output"
MARKER="$TEST_TMP_ROOT/marker.log"
init_repo "$FIXTURE_REPO"
commit_file "$FIXTURE_REPO" "yarn.lock" "chore: add lockfile" "lock"
commit_file "$FIXTURE_REPO" "api/foo.ts" "feat: add foo" "export const foo = 1"
commit_file "$FIXTURE_REPO" "api/bar.ts" "feat: add bar" "export const bar = 2"

run_verifier_twice() {
  local run_label="$1"
  : > "$MARKER"
  echo "dirty" >> "$FIXTURE_REPO/api/foo.ts"
  echo "untracked" > "$FIXTURE_REPO/untracked.txt"

  local ORIG_HEAD ORIG_STATUS ORIG_WORKTREES
  ORIG_HEAD=$(git -C "$FIXTURE_REPO" rev-parse HEAD)
  ORIG_STATUS=$(git -C "$FIXTURE_REPO" status --porcelain=v1 | sort)
  ORIG_WORKTREES=$(git -C "$FIXTURE_REPO" worktree list --porcelain)

  timeout 60 bash "$SCRIPT" \
    --threshold 80 \
    --project-root "$FIXTURE_REPO" \
    --output-dir "$OUTPUT_DIR" \
    --test-command "bash $PASS_STUB $MARKER" >/dev/null 2>&1

  local AFTER_HEAD AFTER_STATUS AFTER_WORKTREES
  AFTER_HEAD=$(git -C "$FIXTURE_REPO" rev-parse HEAD)
  AFTER_STATUS=$(git -C "$FIXTURE_REPO" status --porcelain=v1 | sort)
  AFTER_WORKTREES=$(git -C "$FIXTURE_REPO" worktree list --porcelain)

  [ "$ORIG_HEAD" = "$AFTER_HEAD" ] || fail "[$run_label] HEAD changed"
  [ "$ORIG_STATUS" = "$AFTER_STATUS" ] || fail "[$run_label] working tree changed"
  [ "$ORIG_WORKTREES" = "$AFTER_WORKTREES" ] || fail "[$run_label] worktree list changed"

  git -C "$FIXTURE_REPO" checkout -- api/foo.ts 2>/dev/null || true
  rm -f "$FIXTURE_REPO/untracked.txt"
}

for i in 1 2; do
  echo "  Run ${i}"
  run_verifier_twice "run-${i}"
done

[ -s "$MARKER" ] || fail "stub test marker missing (verifier did not run in fixture)"
mapfile -t MARKER_LINES < "$MARKER"
for marker_path in "${MARKER_LINES[@]}"; do
  [[ "$marker_path" == "$PROJECT_ROOT"* ]] && fail "stub ran in real project root: $marker_path"
done
REPORT="$OUTPUT_DIR/coverage-report.md"
assert_file_contains "$REPORT" "PASS"
SUMMARY_REPORT="$OUTPUT_DIR/commit-policy-summary.md"
assert_file_contains "$SUMMARY_REPORT" "| # | Commit |"
assert_file_contains "$SUMMARY_REPORT" "Verdict: **PASS**"
echo "  State preservation: PASS"

echo ""
echo "=== Fixture: commit link in summary ==="
FIXTURE_REPO="$TEST_TMP_ROOT/repo-link"
setup_repo
code=$(GITHUB_REPOSITORY="owner/repo" run_verifier "$TEST_TMP_ROOT/out-link" --test-command "bash $PASS_STUB $MARKER")
[ "$code" -eq 0 ] || fail "link run should exit 0, got $code"
assert_file_contains "$TEST_TMP_ROOT/out-link/commit-policy-summary.md" "](https://github.com/owner/repo/commit/${LOW_SHA})"
echo "  Commit link: PASS"

echo ""
echo "=== Fixture: message escaping in summary ==="
FIXTURE_REPO="$TEST_TMP_ROOT/repo-escape"
setup_repo
commit_file "$FIXTURE_REPO" "api/foo.test.ts" 'feat: add | pipe and ` code`' "import { foo } from './foo'"
code=$(run_verifier "$TEST_TMP_ROOT/out-escape" --test-command "bash $PASS_STUB $MARKER")
[ "$code" -eq 0 ] || fail "escape run should exit 0, got $code"
assert_file_contains "$TEST_TMP_ROOT/out-escape/commit-policy-summary.md" 'feat: add \| pipe and \` code\`'
echo "  Message escaping: PASS"

echo ""
echo "=== Fixture: bootstrap ==="
FIXTURE_REPO="$TEST_TMP_ROOT/repo-bootstrap"
MARKER="$TEST_TMP_ROOT/bootstrap-marker.log"
init_repo "$FIXTURE_REPO"
commit_file "$FIXTURE_REPO" "package.json" "chore: bootstrap" '{}'
: > "$MARKER"
code=$(run_verifier "$TEST_TMP_ROOT/out-bootstrap" --test-command "bash $FAIL_STUB $MARKER")
[ "$code" -eq 0 ] || fail "bootstrap run should exit 0, got $code"
assert_file_contains "$TEST_TMP_ROOT/out-bootstrap/coverage-report.md" "BOOTSTRAP"
[ ! -s "$MARKER" ] || fail "bootstrap should not run the test command"
echo "  Bootstrap: PASS"

echo ""
echo "=== Fixture: not applicable ==="
FIXTURE_REPO="$TEST_TMP_ROOT/repo-notapp"
MARKER="$TEST_TMP_ROOT/notapp-marker.log"
init_repo "$FIXTURE_REPO"
commit_file "$FIXTURE_REPO" "yarn.lock" "chore: add lockfile" "lock"
commit_file "$FIXTURE_REPO" ".editorconfig" "chore: add editor config" "root = true"
: > "$MARKER"
code=$(run_verifier "$TEST_TMP_ROOT/out-notapp" --test-command "bash $FAIL_STUB $MARKER")
[ "$code" -eq 0 ] || fail "not-applicable run should exit 0, got $code"
assert_file_contains "$TEST_TMP_ROOT/out-notapp/coverage-report.md" "NOT APPLICABLE"
[ ! -s "$MARKER" ] || fail "not-applicable commits should not run the test command"
echo "  Not applicable: PASS"

echo ""
echo "=== Fixture: temporary low recovered ==="
FIXTURE_REPO="$TEST_TMP_ROOT/repo-recovered"
MARKER="$TEST_TMP_ROOT/recovered-marker.log"
setup_repo
commit_file "$FIXTURE_REPO" "api/foo.test.ts" "test: cover foo" "import { foo } from './foo'"
: > "$MARKER"
code=$(run_verifier "$TEST_TMP_ROOT/out-recovered" --test-command "bash $LOW_STUB $MARKER")
[ "$code" -eq 0 ] || fail "recovered-low run should exit 0, got $code"
assert_file_contains "$TEST_TMP_ROOT/out-recovered/coverage-report.md" "RECOVERED (LOW"
assert_file_contains "$TEST_TMP_ROOT/out-recovered/commit-policy-summary.md" "RECOVERED (LOW"
assert_file_contains "$TEST_TMP_ROOT/out-recovered/coverage-report.md" "Temporary low/recovered:     1"
# strict mode permits recovered low
code=$(run_verifier "$TEST_TMP_ROOT/out-recovered-strict" --strict --test-command "bash $LOW_STUB $MARKER")
[ "$code" -eq 0 ] || fail "strict recovered-low run should exit 0, got $code"
echo "  Temporary low recovered: PASS"

echo ""
echo "=== Fixture: unrecovered low ==="
FIXTURE_REPO="$TEST_TMP_ROOT/repo-unrecovered"
setup_repo
code=$(run_verifier "$TEST_TMP_ROOT/out-unrecovered" --strict --test-command "bash $LOW_STUB $MARKER")
[ "$code" -ne 0 ] || fail "strict unrecovered-low run should exit non-zero"
assert_file_contains "$TEST_TMP_ROOT/out-unrecovered/coverage-report.md" "UNRECOVERED (LOW"
assert_file_contains "$TEST_TMP_ROOT/out-unrecovered/coverage-report.md" "Unrecovered low:             1"
echo "  Unrecovered low: PASS"

echo ""
echo "=== Fixture: threshold failure recovered ==="
FIXTURE_REPO="$TEST_TMP_ROOT/repo-threshold"
setup_repo
commit_file "$FIXTURE_REPO" "api/foo.test.ts" "test: cover foo" "import { foo } from './foo'"
: > "$MARKER"
code=$(run_verifier "$TEST_TMP_ROOT/out-threshold" --test-command "bash $THRESHOLD_STUB $MARKER")
[ "$code" -eq 0 ] || fail "recovered threshold-low run should exit 0, got $code"
assert_file_contains "$TEST_TMP_ROOT/out-threshold/coverage-report.md" "RECOVERED (LOW"
echo "  Threshold failure recovered: PASS"

echo ""
echo "=== Fixture: branch metric low, statements high (recovered) ==="
FIXTURE_REPO="$TEST_TMP_ROOT/repo-branchlow"
setup_repo
commit_file "$FIXTURE_REPO" "api/foo.test.ts" "test: cover foo" "import { foo } from './foo'"
: > "$MARKER"
code=$(run_verifier "$TEST_TMP_ROOT/out-branchlow" --test-command "bash $MIXED_STUB $MARKER")
[ "$code" -eq 0 ] || fail "recovered branch-low run should exit 0, got $code"
assert_file_contains "$TEST_TMP_ROOT/out-branchlow/coverage-report.md" "RECOVERED (LOW"
assert_file_contains "$TEST_TMP_ROOT/out-branchlow/coverage-report.md" "Branches 60% < 80%"
echo "  Branch metric low recovered: PASS"

echo ""
echo "=== Fixture: branch metric low unrecovered ==="
FIXTURE_REPO="$TEST_TMP_ROOT/repo-branchlow-unrec"
setup_repo
code=$(run_verifier "$TEST_TMP_ROOT/out-branchlow-unrec" --strict --test-command "bash $MIXED_STUB $MARKER")
[ "$code" -ne 0 ] || fail "strict branch-low unrecovered run should exit non-zero"
assert_file_contains "$TEST_TMP_ROOT/out-branchlow-unrec/coverage-report.md" "UNRECOVERED (LOW"
assert_file_contains "$TEST_TMP_ROOT/out-branchlow-unrec/coverage-report.md" "Branches 60% < 80%"
echo "  Branch metric low unrecovered: PASS"

echo ""
echo "=== Fixture: statements metric low (recovered) ==="
FIXTURE_REPO="$TEST_TMP_ROOT/repo-stmtlow"
setup_repo
commit_file "$FIXTURE_REPO" "api/foo.test.ts" "test: cover foo" "import { foo } from './foo'"
: > "$MARKER"
export COV_LINE="50 | 100 | 100 | 100" COV_ERR="ERROR: Coverage for statements (50%) does not meet global threshold (80%)" COV_EXIT=1
code=$(run_verifier "$TEST_TMP_ROOT/out-stmtlow" --test-command "bash $METRIC_STUB $MARKER")
[ "$code" -eq 0 ] || fail "recovered statements-low run should exit 0, got $code"
assert_file_contains "$TEST_TMP_ROOT/out-stmtlow/coverage-report.md" "RECOVERED (LOW"
assert_file_contains "$TEST_TMP_ROOT/out-stmtlow/coverage-report.md" "Statements 50% < 80%"
unset COV_LINE COV_ERR COV_EXIT
echo "  Statements metric low recovered: PASS"

echo ""
echo "=== Fixture: functions metric low (recovered) ==="
FIXTURE_REPO="$TEST_TMP_ROOT/repo-funclow"
setup_repo
commit_file "$FIXTURE_REPO" "api/foo.test.ts" "test: cover foo" "import { foo } from './foo'"
: > "$MARKER"
export COV_LINE="100 | 100 | 50 | 100" COV_ERR="ERROR: Coverage for functions (50%) does not meet global threshold (80%)" COV_EXIT=1
code=$(run_verifier "$TEST_TMP_ROOT/out-funclow" --test-command "bash $METRIC_STUB $MARKER")
[ "$code" -eq 0 ] || fail "recovered functions-low run should exit 0, got $code"
assert_file_contains "$TEST_TMP_ROOT/out-funclow/coverage-report.md" "RECOVERED (LOW"
assert_file_contains "$TEST_TMP_ROOT/out-funclow/coverage-report.md" "Functions 50% < 80%"
unset COV_LINE COV_ERR COV_EXIT
echo "  Functions metric low recovered: PASS"

echo ""
echo "=== Fixture: lines metric low (recovered) ==="
FIXTURE_REPO="$TEST_TMP_ROOT/repo-lineslow"
setup_repo
commit_file "$FIXTURE_REPO" "api/foo.test.ts" "test: cover foo" "import { foo } from './foo'"
: > "$MARKER"
export COV_LINE="100 | 100 | 100 | 50" COV_ERR="ERROR: Coverage for lines (50%) does not meet global threshold (80%)" COV_EXIT=1
code=$(run_verifier "$TEST_TMP_ROOT/out-lineslow" --test-command "bash $METRIC_STUB $MARKER")
[ "$code" -eq 0 ] || fail "recovered lines-low run should exit 0, got $code"
assert_file_contains "$TEST_TMP_ROOT/out-lineslow/coverage-report.md" "RECOVERED (LOW"
assert_file_contains "$TEST_TMP_ROOT/out-lineslow/coverage-report.md" "Lines 50% < 80%"
unset COV_LINE COV_ERR COV_EXIT
echo "  Lines metric low recovered: PASS"

echo ""
echo "=== Fixture: combined test failure + threshold failure ==="
FIXTURE_REPO="$TEST_TMP_ROOT/repo-combined"
MARKER="$TEST_TMP_ROOT/combined-marker.log"
setup_repo
commit_file "$FIXTURE_REPO" "api/foo.test.ts" "test: cover foo" "import { foo } from './foo'"
: > "$MARKER"
code=$(run_verifier "$TEST_TMP_ROOT/out-combined" --test-command "bash $COMBINED_STUB $MARKER")
[ "$code" -ne 0 ] || fail "combined-failure run should exit non-zero, got $code"
assert_file_contains "$TEST_TMP_ROOT/out-combined/coverage-report.md" "FAIL (1)"
assert_file_contains "$TEST_TMP_ROOT/out-combined/coverage-report.md" "Real failures:"
if grep -q "LOW (Branches 60%" "$TEST_TMP_ROOT/out-combined/coverage-report.md"; then
  fail "combined test failure must not be classified as LOW"
fi
code=$(run_verifier "$TEST_TMP_ROOT/out-combined-strict" --strict --test-command "bash $COMBINED_STUB $MARKER")
[ "$code" -ne 0 ] || fail "combined-failure strict run should exit non-zero"
echo "  Combined failure: PASS"

malformed_idx=0
for cov_line in "100 | - | 100 | 100" "100 | 100 | Unknown | 100" "100 | 100 | 100 | "; do
  malformed_idx=$((malformed_idx + 1))
  echo ""
  echo "=== Fixture: malformed coverage line: '${cov_line}' ==="
  FIXTURE_REPO="$TEST_TMP_ROOT/repo-malformed-${malformed_idx}"
  setup_repo
  export COV_LINE="$cov_line" COV_EXIT=0
  unset COV_ERR
  code=$(run_verifier "$TEST_TMP_ROOT/out-malformed-${malformed_idx}" --strict --test-command "bash $METRIC_STUB $MARKER")
  [ "$code" -ne 0 ] || fail "strict malformed-coverage run should exit non-zero"
  assert_file_contains "$TEST_TMP_ROOT/out-malformed-${malformed_idx}/coverage-report.md" "NO DATA"
  unset COV_LINE COV_EXIT
  echo "  Malformed coverage line: PASS"
done

echo ""
echo "=== Fixture: real test failure ==="
FIXTURE_REPO="$TEST_TMP_ROOT/repo-fail"
setup_repo
code=$(run_verifier "$TEST_TMP_ROOT/out-fail" --test-command "bash $FAIL_STUB $MARKER")
[ "$code" -ne 0 ] || fail "real-failure run should exit non-zero"
assert_file_contains "$TEST_TMP_ROOT/out-fail/coverage-report.md" "FAIL (3)"
assert_file_contains "$TEST_TMP_ROOT/out-fail/coverage-report.md" "Real failures:               1"
assert_file_contains "$TEST_TMP_ROOT/out-fail/commit-policy-summary.md" "Verdict: **FAIL**"
echo "  Real test failure: PASS"

echo ""
echo "=== Fixture: timeout ==="
FIXTURE_REPO="$TEST_TMP_ROOT/repo-timeout"
setup_repo
# non-strict: timeout is recorded but not fatal
code=$(run_verifier "$TEST_TMP_ROOT/out-timeout" --timeout 1 --test-command "bash $TIMEOUT_STUB $MARKER")
[ "$code" -eq 0 ] || fail "non-strict timeout run should exit 0, got $code"
assert_file_contains "$TEST_TMP_ROOT/out-timeout/coverage-report.md" "TIMEOUT"
assert_file_contains "$TEST_TMP_ROOT/out-timeout/coverage-report.md" "Timeouts:                    1"
# strict: timeout is fatal
code=$(run_verifier "$TEST_TMP_ROOT/out-timeout-strict" --strict --timeout 1 --test-command "bash $TIMEOUT_STUB $MARKER")
[ "$code" -ne 0 ] || fail "strict timeout run should exit non-zero"
echo "  Timeout: PASS"

echo ""
echo "=== Fixture: unexpected no-data ==="
FIXTURE_REPO="$TEST_TMP_ROOT/repo-nodata"
setup_repo
code=$(run_verifier "$TEST_TMP_ROOT/out-nodata" --strict --test-command "bash $NODATA_STUB $MARKER")
[ "$code" -ne 0 ] || fail "strict no-data run should exit non-zero"
assert_file_contains "$TEST_TMP_ROOT/out-nodata/coverage-report.md" "NO DATA"
assert_file_contains "$TEST_TMP_ROOT/out-nodata/coverage-report.md" "Unexpected no-data:          1"
echo "  Unexpected no-data: PASS"

echo ""
echo "=== Fixture: checkout failure ==="
FIXTURE_REPO="$TEST_TMP_ROOT/repo-checkout"
setup_repo
export VERIFIER_WORKTREE_CMD="false"
code=$(run_verifier "$TEST_TMP_ROOT/out-checkout" --strict --test-command "bash $PASS_STUB $MARKER")
unset VERIFIER_WORKTREE_CMD
[ "$code" -ne 0 ] || fail "strict checkout-failure run should exit non-zero"
assert_file_contains "$TEST_TMP_ROOT/out-checkout/coverage-report.md" "CHECKOUT FAIL"
assert_file_contains "$TEST_TMP_ROOT/out-checkout/coverage-report.md" "Checkout failures:           2"
echo "  Checkout failure: PASS"

echo ""
echo "=== Fixture: install failure ==="
FIXTURE_REPO="$TEST_TMP_ROOT/repo-installfail"
MARKER="$TEST_TMP_ROOT/installfail-marker.log"
FAKE_BIN="$TEST_TMP_ROOT/fakebin"
YARN_CALL_LOG="$TEST_TMP_ROOT/yarn-calls.log"
: > "$YARN_CALL_LOG"
mkdir -p "$FAKE_BIN"
cat > "$FAKE_BIN/yarn" << 'STUB'
#!/usr/bin/env bash
printf '%s\n' "$*" >> "${YARN_CALL_LOG:-/dev/null}"
echo "install failed" >&2
exit 1
STUB
chmod +x "$FAKE_BIN/yarn"
setup_repo
: > "$MARKER"
code=$(PATH="$FAKE_BIN:$PATH" YARN_CALL_LOG="$YARN_CALL_LOG" run_verifier "$TEST_TMP_ROOT/out-installfail" --install --strict --test-command "bash $PASS_STUB $MARKER")
[ "$code" -ne 0 ] || fail "strict install-failure run should exit non-zero"
assert_file_contains "$TEST_TMP_ROOT/out-installfail/coverage-report.md" "INSTALL FAIL"
assert_file_contains "$TEST_TMP_ROOT/out-installfail/coverage-report.md" "Install failures:            1"
[ ! -s "$MARKER" ] || fail "install-failure commits should not run the test command"
if grep -q '^install --silent$' "$YARN_CALL_LOG" 2>/dev/null; then
  fail "non-immutable yarn install was called"
fi
# non-strict mode records INSTALL FAIL but does not fail the run
code=$(PATH="$FAKE_BIN:$PATH" YARN_CALL_LOG="$YARN_CALL_LOG" run_verifier "$TEST_TMP_ROOT/out-installfail-nonstrict" --install --test-command "bash $PASS_STUB $MARKER")
[ "$code" -eq 0 ] || fail "non-strict install-failure run should exit 0, got $code"
assert_file_contains "$TEST_TMP_ROOT/out-installfail-nonstrict/coverage-report.md" "INSTALL FAIL"
echo "  Install failure: PASS"

echo ""
echo "=== Fixture: test runs never write vitest blocks to the step summary ==="
FIXTURE_REPO="$TEST_TMP_ROOT/repo-stepsummary"
MARKER="$TEST_TMP_ROOT/stepsummary-marker.log"
STUB="$TEST_TMP_ROOT/stub-stepsummary.sh"
cat > "$STUB" << 'STUB'
#!/usr/bin/env bash
set -euo pipefail
printf 'GITHUB_STEP_SUMMARY=[%s]\n' "${GITHUB_STEP_SUMMARY-UNSET}" >> "$1"
printf 'All files | 100 | 100 | 100 | 100 |\n'
STUB
chmod +x "$STUB"
setup_repo
: > "$MARKER"
code=$(GITHUB_STEP_SUMMARY="$TEST_TMP_ROOT/step-summary.md" run_verifier "$TEST_TMP_ROOT/out-stepsummary" --test-command "bash $STUB $MARKER")
[ "$code" -eq 0 ] || fail "step-summary run should exit 0, got $code"
if grep -Fq "GITHUB_STEP_SUMMARY=[$TEST_TMP_ROOT/step-summary.md]" "$MARKER"; then
  fail "test command inherited GITHUB_STEP_SUMMARY; vitest would duplicate report blocks"
fi
echo "  Step summary isolation: PASS"

# ── Final PASS ─────────────────────────────────────────────────────
echo ""
echo "PASS: all verifier status paths classified correctly"
