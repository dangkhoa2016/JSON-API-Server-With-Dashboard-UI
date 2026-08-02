# CI Evidence Guide

> 🌐 Language / Ngôn ngữ: **English** | [Tiếng Việt](CI-EVIDENCE.vi.md)

> Why and how to attach CI evidence whenever you submit a pull request or ask for a review.

## Purpose

This repository enforces quality through GitHub Actions CI. When you open a PR or
request a review, reviewers need verifiable proof that the CI pipeline actually ran
and passed for the exact revision under review.

Local test runs and generated coverage reports do **not** self-prove their origin:
anyone can generate them locally. CI evidence links a specific commit to a workflow
run executed on GitHub's infrastructure.

## Why Not Commit Artifact Links?

The `test` job uploads per-Node coverage artifacts (`coverage-report-22`,
`coverage-report-24`, `coverage-report-26`). These are useful, but their download
links are **not durable**:

- `actions/upload-artifact` retains artifacts for **90 days** by default.
- Each link is tied to a specific run ID and requires authentication.

Committing artifact links means the links go stale after ~3 months. Instead, use the
**workflow run URL** (permanent page on GitHub) plus the **HEAD SHA** — both are
durable and instantly verifiable.

## Pre-Submit Checklist

- [ ] All local checks pass (`yarn check`, `yarn lint`, `yarn test`)
- [ ] CI workflow run for your branch is green
- [ ] HEAD SHA recorded
- [ ] Workflow run URL recorded
- [ ] Both pasted into the PR/review description

### 1. Record the HEAD SHA

```bash
git rev-parse HEAD
```

### 2. Open the CI workflow page

```text
https://github.com/dangkhoa2016/JSON-API-Server-With-Dashboard-UI/actions/workflows/ci.yml
```

Open the run for your branch, confirm it is green, and copy the run URL.

### 3. Paste both into the description

Use this two-line template at the top of the PR or review description:

```markdown
**CI:** [workflow run](workflow-run-url)
**HEAD SHA:** `<full-sha>`
```

The `commit-policy` job inside the run posts the per-commit coverage report to its
step summary ("Post commit-policy summary" step). Point reviewers there to inspect
per-commit coverage, commit message policy, and commit size checks.

## CI Jobs and Where to Read Results

| Job               | Purpose                                                             | Where to read the result                                                             |
| ----------------- | ------------------------------------------------------------------- | ------------------------------------------------------------------------------------ |
| `test`            | Matrix over Node 22/24/26: install, typecheck, lint, coverage tests | Job log; per-node coverage artifact `coverage-report-<node>` (expires after 90 days) |
| `commit-policy`   | Commit message, commit size, and per-commit coverage recovery       | Step summary "Post commit-policy summary" in this job's log                          |
| `container-smoke` | Docker build + container smoke test                                 | Job log                                                                              |
| `e2e`             | Playwright browser tests against a Redis-backed server              | Job log; `playwright-report` artifact on failure                                     |

## Notes

- The CI badge in the README is the durable, always-visible proof that CI passes on
  `main`. The workflow run URL in a PR proves it for your specific branch.
- Do not commit artifact download links — they expire after 90 days.
- If a CI job fails, do not submit the review until it is fixed; if a failure is
  unrelated to your change, say so explicitly and link the failing run.
