#!/usr/bin/env bash
set -euo pipefail

echo "=== Test: commit policy enforcement ==="

MSG_SCRIPT="$(cd "$(dirname "$0")/../.." && pwd)/scripts/check-commit-message.mjs"
SIZE_SCRIPT="$(cd "$(dirname "$0")/../.." && pwd)/scripts/check-commit-size.sh"

MSG_REPO=$(mktemp -d)
SIZE_REPO=$(mktemp -d)
trap "rm -rf $MSG_REPO $SIZE_REPO" EXIT

cd "$MSG_REPO"
git init
git config user.email "test@test.com"
git config user.name "Test"

cat > valid-msg.txt << 'EOF'
fix(api): handle null pointer in parser
- Guard against null reference in JSON parser
- Add regression test for empty body case
EOF

cat > long-subject.txt << 'EOF'
fix(api): this is a really long subject that exceeds seventy two characters which is the maximum
- Short body
EOF

cat > missing-bullet.txt << 'EOF'
feat(ui): add settings page
This is not a bullet point
EOF

cat > no-body.txt << 'EOF'
chore: bump dependencies
EOF

cat > merge-msg.txt << 'EOF'
Merge branch 'feature/new-dashboard'
EOF

cat > revert-msg.txt << 'EOF'
Revert "feat(api): add user authentication"
This reverts commit abc123def456.
EOF

echo ""
echo "--- Test 1: valid commit message ---"
if node "$MSG_SCRIPT" valid-msg.txt 2>&1; then echo "PASS: accepted valid message"; else echo "FAIL: rejected valid message"; exit 1; fi

echo ""
echo "--- Test 2: subject too long ---"
if node "$MSG_SCRIPT" long-subject.txt 2>&1; then echo "FAIL: accepted long subject"; exit 1; else echo "PASS: rejected long subject"; fi

echo ""
echo "--- Test 3: missing bullet ---"
if node "$MSG_SCRIPT" missing-bullet.txt 2>&1; then echo "FAIL: accepted missing bullet"; exit 1; else echo "PASS: rejected missing bullet"; fi

echo ""
echo "--- Test 4: no body (single line) ---"
if node "$MSG_SCRIPT" no-body.txt 2>&1; then echo "FAIL: accepted single-line message"; exit 1; else echo "PASS: rejected single-line message"; fi

echo ""
echo "--- Test 5: empty file (no message) ---"
touch empty-msg.txt
if node "$MSG_SCRIPT" empty-msg.txt 2>&1; then echo "FAIL: accepted empty file"; exit 1; else echo "PASS: rejected empty file"; fi

echo ""
echo "--- Test 6: merge commit (allowlisted) ---"
if node "$MSG_SCRIPT" merge-msg.txt 2>&1; then echo "PASS: accepted merge commit"; else echo "FAIL: rejected merge commit"; exit 1; fi

echo ""
echo "--- Test 7: revert commit (allowlisted) ---"
if node "$MSG_SCRIPT" revert-msg.txt 2>&1; then echo "PASS: accepted revert commit"; else echo "FAIL: rejected revert commit"; exit 1; fi

echo ""
echo "=== All message policy tests PASS ==="

echo ""
echo "=== Size policy tests ==="

cd "$SIZE_REPO"
git init
git config user.email "test@test.com"
git config user.name "Test"

echo ""
echo "--- Size Test 1: warn on 601 staged lines ---"
seq 1 601 > test-file.txt
git add test-file.txt
output=$(MODE=staged bash "$SIZE_SCRIPT" 2>&1) || true
if echo "$output" | grep -q "⚠️"; then
  echo "PASS: warned on 601 lines"
else
  echo "FAIL: no warning on 601 lines"
  echo "$output"
  exit 1
fi

git rm --cached -r . > /dev/null 2>&1 || true
rm -f test-file.txt

echo ""
echo "--- Size Test 2: fail on 1001 lines (STRICT) ---"
mkdir -p subdir
seq 1 500 > subdir/file-a.txt
seq 1 501 > subdir/file-b.txt
git add subdir/
output=$(MODE=staged STRICT=true bash "$SIZE_SCRIPT" 2>&1) || true
if echo "$output" | grep -q "❌"; then
  echo "PASS: strict failed on 1001 lines"
else
  echo "FAIL: no failure on 1001 lines"
  echo "$output"
  exit 1
fi

git rm --cached -r . > /dev/null 2>&1 || true
rm -rf subdir

echo ""
echo "--- Size Test 3: lockfile exempt from size check ---"
seq 1 3000 > yarn.lock
git add yarn.lock
output=$(MODE=staged bash "$SIZE_SCRIPT" 2>&1) || true
if echo "$output" | grep -q "0 handwritten"; then
  echo "PASS: lockfile exempt from size check"
else
  echo "FAIL: lockfile not exempt"
  echo "$output"
  exit 1
fi

echo ""
echo "=== All size policy tests PASS ==="
