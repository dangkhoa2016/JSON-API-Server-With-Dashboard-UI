# Commit Coverage Verification Tool

> 🌐 Language / Ngôn ngữ: **English** | [Tiếng Việt](README.vi.md)

Automated script to verify test coverage for each commit on the current branch.

## Structure

- `verify-commit-coverage.sh` — iterates through each commit, runs coverage, writes report
- `verify-commit-coverage.test.sh` — fixture harness that exercises the verifier in an isolated temporary repository
- `coverage-report.md` — generated markdown report (gitignored)
- `results/` — raw logs per commit (gitignored)

## Range semantics

- **No arguments** — includes every commit from the root through `HEAD` (root-inclusive).
- **Explicit `BASE HEAD`** — uses standard Git base-exclusive range `BASE..HEAD`.

## Usage

```bash
# Verify every commit, including root (default)
bash manual-test-coverage/verify-commit-coverage.sh

# Verify BASE..HEAD (BASE excluded)
bash manual-test-coverage/verify-commit-coverage.sh <base-sha> <head-sha>

# Check with a threshold (default 80%)
bash manual-test-coverage/verify-commit-coverage.sh --threshold 90

# Point at a different project root
bash manual-test-coverage/verify-commit-coverage.sh --project-root /path/to/repo

# Inject a custom test command (default: yarn test:coverage)
bash manual-test-coverage/verify-commit-coverage.sh --test-command "npm run coverage"

# Write reports outside the default directory
bash manual-test-coverage/verify-commit-coverage.sh --output-dir /tmp/commit-coverage

# Enable dependency installation (disabled by default for isolation)
bash manual-test-coverage/verify-commit-coverage.sh --install

# Combine options
bash manual-test-coverage/verify-commit-coverage.sh \
  --project-root /path/to/repo \
  --test-command "npm run coverage" \
  --install \
  --threshold 85

# Run the verifier safety harness (isolated fixture, not real coverage)
yarn test:coverage-verifier
```

## Requirements

- Node.js, yarn
- `vitest` with `--coverage` configured (uses `@vitest/coverage-v8`)

## Output

Each commit is checked out, coverage tests are run, and results are written to:

- `coverage-report.md` — markdown table with coverage % per commit
- `results/<index>-<hash>-<message>.log` — full output of each commit
