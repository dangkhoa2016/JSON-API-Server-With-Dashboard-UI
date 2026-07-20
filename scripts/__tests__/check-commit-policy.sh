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

cat > valid-revert.txt << 'EOF'
revert(api): restore previous authentication behavior

- Revert the incompatible authentication change
- Preserve compatibility with existing clients
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
echo "--- Test 6: legacy merge subject is rejected ---"
if node "$MSG_SCRIPT" merge-msg.txt 2>&1; then echo "FAIL: accepted legacy merge subject"; exit 1; else echo "PASS: rejected legacy merge subject"; fi

echo ""
echo "--- Test 7: legacy revert subject is rejected ---"
if node "$MSG_SCRIPT" revert-msg.txt 2>&1; then echo "FAIL: accepted legacy revert subject"; exit 1; else echo "PASS: rejected legacy revert subject"; fi

echo ""
echo "--- Test 7b: conventional revert subject is accepted ---"
if node "$MSG_SCRIPT" valid-revert.txt 2>&1; then echo "PASS: accepted conventional revert"; else echo "FAIL: rejected conventional revert"; exit 1; fi

cat > non-conventional.txt << 'EOF'
updated everything
- Update everything at once
EOF

cat > bad-type.txt << 'EOF'
feature: add thing
- Add the thing
EOF

cat > empty-scope.txt << 'EOF'
feat(): add thing
- Add the thing
EOF

cat > uppercase-type.txt << 'EOF'
Feat: add thing
- Add the thing
EOF

cat > uppercase-desc.txt << 'EOF'
feat: Add thing
- Add the thing
EOF

cat > conv-feat.txt << 'EOF'
feat: add thing
- Add the thing
EOF

cat > conv-scope.txt << 'EOF'
feat(api): add thing
- Add the thing
EOF

cat > conv-test.txt << 'EOF'
test(frontend): cover dialog
- Cover the dialog
EOF

cat > conv-breaking.txt << 'EOF'
feat(api)!: drop old endpoint
- Drop the old endpoint
EOF

echo ""
echo "--- Test 8: subject without conventional prefix ---"
if node "$MSG_SCRIPT" non-conventional.txt 2>&1; then echo "FAIL: accepted non-conventional subject"; exit 1; else echo "PASS: rejected non-conventional subject"; fi

echo ""
echo "--- Test 9: non-standard type ---"
if node "$MSG_SCRIPT" bad-type.txt 2>&1; then echo "FAIL: accepted non-standard type"; exit 1; else echo "PASS: rejected non-standard type"; fi

echo ""
echo "--- Test 10: empty scope ---"
if node "$MSG_SCRIPT" empty-scope.txt 2>&1; then echo "FAIL: accepted empty scope"; exit 1; else echo "PASS: rejected empty scope"; fi

echo ""
echo "--- Test 11: uppercase type ---"
if node "$MSG_SCRIPT" uppercase-type.txt 2>&1; then echo "FAIL: accepted uppercase type"; exit 1; else echo "PASS: rejected uppercase type"; fi

echo ""
echo "--- Test 12: uppercase description ---"
if node "$MSG_SCRIPT" uppercase-desc.txt 2>&1; then echo "FAIL: accepted uppercase description"; exit 1; else echo "PASS: rejected uppercase description"; fi

echo ""
echo "--- Test 13: bare feat subject ---"
if node "$MSG_SCRIPT" conv-feat.txt 2>&1; then echo "PASS: accepted bare feat subject"; else echo "FAIL: rejected bare feat subject"; exit 1; fi

echo ""
echo "--- Test 14: scoped feat subject ---"
if node "$MSG_SCRIPT" conv-scope.txt 2>&1; then echo "PASS: accepted scoped feat subject"; else echo "FAIL: rejected scoped feat subject"; exit 1; fi

echo ""
echo "--- Test 15: scoped test subject ---"
if node "$MSG_SCRIPT" conv-test.txt 2>&1; then echo "PASS: accepted scoped test subject"; else echo "FAIL: rejected scoped test subject"; exit 1; fi

echo ""
echo "--- Test 16: breaking change subject ---"
if node "$MSG_SCRIPT" conv-breaking.txt 2>&1; then echo "PASS: accepted breaking change subject"; else echo "FAIL: rejected breaking change subject"; exit 1; fi

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
