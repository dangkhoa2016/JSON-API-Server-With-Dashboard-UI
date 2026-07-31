#!/usr/bin/env bash
set -euo pipefail

echo "=== Test: changelog generation ==="

SCRIPT="$(cd "$(dirname "$0")/../.." && pwd)/scripts/generate-changelog.sh"

REPO=$(mktemp -d)
FAKEBIN=$(mktemp -d)
trap "rm -rf $REPO $FAKEBIN" EXIT

cd "$REPO"
git init -q
git config user.email "test@test.com"
git config user.name "Test"

commit_file() {
  local path="$1" msg="$2"
  mkdir -p "$(dirname "$path")"
  printf 'x\n' > "$path"
  git add "$path"
  git commit -q -m "$msg"
}

commit_file "api/a.ts" "feat: add feature"
commit_file "api/b.ts" "fix: correct bug"
commit_file "api/c.test.ts" "test: cover feature"
commit_file "yarn.lock" "chore: add lockfile"

echo ""
echo "--- Test 1: full-history changelog ---"
bash "$SCRIPT" CHANGELOG.md
for section in "Features" "Bug Fixes" "Tests" "Chores"; do
  grep -q "## $section" CHANGELOG.md || { echo "FAIL: missing section $section"; exit 1; }
done
grep -q -- "- feat: add feature (" CHANGELOG.md || { echo "FAIL: missing feat entry"; exit 1; }
grep -q -- "- fix: correct bug (" CHANGELOG.md || { echo "FAIL: missing fix entry"; exit 1; }
echo "  PASS: full-history changelog generated"

echo ""
echo "--- Test 2: tag-scoped changelog ---"
git tag v1.0.0 HEAD~3
bash "$SCRIPT" CHANGELOG.md v1.0.0
grep -q -- "- fix: correct bug (" CHANGELOG.md || { echo "FAIL: scoped changelog missing post-tag fix"; exit 1; }
grep -q -- "- feat: add feature (" CHANGELOG.md && { echo "FAIL: scoped changelog should exclude pre-tag feat"; exit 1; }
echo "  PASS: tag-scoped changelog generated"

echo ""
echo "--- Test 3: invalid tag rejected ---"
if bash "$SCRIPT" CHANGELOG.md does-not-exist >/dev/null 2>err.txt; then
  echo "FAIL: invalid tag accepted"
  exit 1
fi
grep -q "does not resolve to a commit" err.txt || { echo "FAIL: missing tag error message"; exit 1; }
echo "  PASS: invalid tag rejected"

echo ""
echo "--- Test 4: no commits in a section prints placeholder ---"
git checkout -q --detach HEAD~3
bash "$SCRIPT" CHANGELOG.md >/dev/null
grep -q "_No bug fixes in this release._" CHANGELOG.md || { echo "FAIL: missing placeholder for empty section"; exit 1; }
echo "  PASS: empty sections get placeholders"

echo ""
echo "--- Test 5: git log failure aborts without overwriting output ---"
REAL_GIT="$(command -v git)"
cat > "$FAKEBIN/git" << EOF
#!/usr/bin/env bash
if [ "\$1" = "log" ]; then
  echo "simulated git log failure" >&2
  exit 1
fi
exec "$REAL_GIT" "\$@"
EOF
chmod +x "$FAKEBIN/git"
printf 'previous content\n' > CHANGELOG.md
if PATH="$FAKEBIN:$PATH" bash "$SCRIPT" CHANGELOG.md >/dev/null 2>err2.txt; then
  echo "FAIL: generator should abort on git log failure"
  exit 1
fi
grep -q "unable to read git history" err2.txt || { echo "FAIL: missing git log error message"; exit 1; }
grep -q "previous content" CHANGELOG.md || { echo "FAIL: output was overwritten on git log failure"; exit 1; }
echo "  PASS: git log failure handled"

echo ""
echo "--- Test 6: secondary git log failure aborts without overwriting output ---"
cat > "$FAKEBIN/git" << EOF
#!/usr/bin/env bash
if [ "\$1" = "log" ] && [[ "\$*" == *--grep* ]]; then
  echo "simulated secondary git log failure" >&2
  exit 1
fi
exec "$REAL_GIT" "\$@"
EOF
chmod +x "$FAKEBIN/git"
printf 'previous content\n' > CHANGELOG.md
if PATH="$FAKEBIN:$PATH" bash "$SCRIPT" CHANGELOG.md >/dev/null 2>err3.txt; then
  echo "FAIL: generator should abort on secondary git log failure"
  exit 1
fi
grep -q "simulated secondary git log failure" err3.txt || { echo "FAIL: missing secondary git log error message"; exit 1; }
grep -q "previous content" CHANGELOG.md || { echo "FAIL: output was overwritten on secondary git log failure"; exit 1; }
echo "  PASS: secondary git log failure handled"

echo ""
echo "PASS: all changelog tests passed"
