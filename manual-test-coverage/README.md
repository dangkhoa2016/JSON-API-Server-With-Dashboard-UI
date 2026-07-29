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

# Fail on checkout failures, timeouts, unexpected no-data, real failures,
# or coverage that does not recover within the recovery window
bash manual-test-coverage/verify-commit-coverage.sh --strict

# Tune how many adjacent commits may pass before a LOW must recover (default 2)
bash manual-test-coverage/verify-commit-coverage.sh --max-recovery-commits 2

# Override the per-commit test timeout in seconds (default 600)
bash manual-test-coverage/verify-commit-coverage.sh --timeout 600

# Combine options
bash manual-test-coverage/verify-commit-coverage.sh \
  --project-root /path/to/repo \
  --test-command "npm run coverage" \
  --install \
  --threshold 85

# Run the verifier safety harness (isolated fixture, not real coverage)
yarn test:coverage-verifier
```

## Status classification

The threshold applies to **all four coverage metrics** — statements, branches,
functions, and lines. A commit is `PASS` only when every parsed metric meets
the threshold; otherwise it is `LOW` and the report lists each metric that is
below the threshold (for example `LOW (Branches 60% < 80%)`).

- `PASS` — all four metrics meet the threshold.
- `LOW` then `RECOVERED` — at least one metric dips below the threshold but all
  four metrics recover to the threshold within `--max-recovery-commits`
  adjacent commits (permitted).
- `UNRECOVERED` — coverage stays below the threshold (a debt failure).
- `NO DATA` — any of the four metrics is missing, empty, or non-numeric, so the
  coverage line cannot be trusted.
- `BOOTSTRAP` — commit predates the dependency lockfile, so tests cannot run
  (not an application failure).
- `NOT APPLICABLE` — commit changes no testable code (config, docs, generated
  or static assets only).
- `CHECKOUT FAIL`, `TIMEOUT`, `NO DATA`, `INSTALL FAIL`, `FAIL` — real
  infrastructure or test failures. `--strict` makes the verifier exit
  non-zero for these.

A non-zero exit is treated as a recoverable `LOW` only when **all** of the
following hold: the output confirms a global-coverage-threshold violation
(`does not meet global threshold`), all four metrics parse successfully, and
the test summary proves the suite itself passed — a positive
`Test Files ... passed` / `Tests ... passed` line with no failed tests, failed
suites, or unhandled errors. A real test failure is always a hard `FAIL`, even
when coverage thresholds also fail, and is never downgraded to `LOW` or
`RECOVERED`. Coverage-recovery rules therefore never mask an actual test
failure.

Dependency mode is recorded in the report: historical worktrees reuse the
current `node_modules` (`reuse`) for speed, or install with
`yarn install --immutable` when `--install` is enabled. A failed immutable
install marks the commit `INSTALL FAIL` and never falls back to a
non-immutable install. Note that `reuse` reflects the current working tree's
dependencies, not an isolated snapshot taken per commit.

## Requirements

- Node.js, yarn
- `vitest` with `--coverage` configured (uses `@vitest/coverage-v8`)

## Output

Each commit is checked out, coverage tests are run, and results are written to:

- `coverage-report.md` — markdown table with coverage % per commit
- `results/<index>-<hash>-<message>.log` — full output of each commit
