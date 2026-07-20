#!/usr/bin/env bash
set -euo pipefail

echo "=== Test: commit range selection ==="

SCRIPT="$(cd "$(dirname "$0")/.." && pwd)/select-commit-range.sh"

REPO=$(mktemp -d)
trap "rm -rf $REPO" EXIT

cd "$REPO"
git init -q
git config user.email "test@test.com"
git config user.name "Test"

commit() {
  echo "$1" > "$1.txt"
  git add "$1.txt"
  git commit -q -m "$1"
}

commit A
A=$(git rev-parse HEAD)
commit B
B=$(git rev-parse HEAD)
commit C
C=$(git rev-parse HEAD)
commit D
D=$(git rev-parse HEAD)

git branch origin/main "$A"

ZERO="0000000000000000000000000000000000000000"
FAILS=0

run() {  # run <desc> <expected_exit> <expected_output> <args...>
  local desc="$1" expected_exit="$2" expected_out="$3"
  shift 3
  local code out
  set +e
  out=$(bash "$SCRIPT" "$@" 2>&1)
  code=$?
  set -e
  if [ "$code" -ne "$expected_exit" ]; then
    echo "FAIL: $desc (expected exit $expected_exit, got $code)"
    printf '%s\n' "$out"
    FAILS=$((FAILS + 1))
    return
  fi
  if [ "$out" != "$expected_out" ]; then
    echo "FAIL: $desc (unexpected output)"
    echo "--- expected ---"
    printf '%s\n' "$expected_out"
    echo "--- actual ---"
    printf '%s\n' "$out"
    FAILS=$((FAILS + 1))
    return
  fi
  echo "PASS: $desc"
}

run "PR base..HEAD" 0 "$D
$C
$B" pull_request main ignored "$D"

run "push before..sha" 0 "$D" push "" "$C" "$D"

run "push zero before selects full history" 0 "$D
$C
$B
$A" push "" "$ZERO" "$D"

run "empty range selects nothing" 0 "" push "" "$D" "$D"

MISSING_SHA="ffffffffffffffffffffffffffffffffffffffff"

run "push missing before falls back to full history" 0 "$D
$C
$B
$A" push "" "$MISSING_SHA" "$D"

git checkout -qb feature "$A"
commit F
F=$(git rev-parse HEAD)
git checkout -q -
git merge --no-ff -q -m "Merge feature into main" feature >/dev/null
M=$(git rev-parse HEAD)

run "push excludes merge commit" 0 "$F" push "" "$D" "$M"

run "invalid base fails loudly" 1 "select-commit-range: invalid base 'origin/nonexistent'" pull_request nonexistent ignored "$D"

run "unsupported event fails" 2 "select-commit-range: unsupported event 'forked'" forked "" "$ZERO" "$D"

run "missing base_ref on PR fails" 2 "select-commit-range: missing base_ref for pull_request" pull_request "" "" "$D"

run "invalid head fails" 1 "select-commit-range: invalid head 'deadbeef'" push "" "$C" deadbeef

run "--refs PR" 0 "origin/main
$D" --refs pull_request main ignored "$D"

run "--refs push before..sha" 0 "$C
$D" --refs push "" "$C" "$D"

run "--refs push zero before has empty base" 0 "
$D" --refs push "" "$ZERO" "$D"

run "--refs push missing before has empty base" 0 "
$D" --refs push "" "$MISSING_SHA" "$D"

if [ "$FAILS" -gt 0 ]; then
  echo "FAIL: $FAILS range selection test(s) failed"
  exit 1
fi

echo "=== All range selection tests PASS ==="
