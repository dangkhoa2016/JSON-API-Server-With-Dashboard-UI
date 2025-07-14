# Commit Coverage Verification Tool

> 🌐 Language / Ngôn ngữ: **English** | [Tiếng Việt](README.vi.md)

Automated script to verify test coverage for each commit on the current branch.

## Structure

- `verify-commit-coverage.sh` — iterates through each commit, runs `yarn test:coverage`, writes report
- `coverage-report.md` — generated markdown report (gitignored)
- `results/` — raw logs per commit (gitignored)

## Usage

```bash
# Check all commits from root to HEAD
bash manual-test-coverage/verify-commit-coverage.sh

# Check with a threshold (default 80%)
bash manual-test-coverage/verify-commit-coverage.sh --threshold 90

# Check a specific commit range
bash manual-test-coverage/verify-commit-coverage.sh <base-sha> <head-sha>

# Combine threshold with commit range
bash manual-test-coverage/verify-commit-coverage.sh --threshold 85 <base-sha> <head-sha>
```

## Requirements

- Node.js, yarn
- `vitest` with `--coverage` configured (uses `@vitest/coverage-v8`)

## Output

Each commit is checked out, coverage tests are run, and results are written to:

- `coverage-report.md` — markdown table with coverage % per commit
- `results/<index>-<hash>-<message>.log` — full output of each commit
