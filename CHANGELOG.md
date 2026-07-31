# Changelog

## Features
- feat(init): add application entry point (93c7576)
- feat(db): add Drizzle ORM schema and config with tests (c35d7e2)
- feat(api): add env loader, Redis client, and context (46dc8ca)
- feat(api): add rate limiting core with CIDR matching (bea7a43)
- feat(api): add admin auth with HMAC sessions and middleware (f5fd742)
- feat(db): add database seed scripts (8b301f1)
- feat(api): add JSON Server core handlers and router with tests (93a7989)
- feat(api): add remaining resources, feature cards, and tests (6b2f017)
- feat(api): add admin router with auth and settings endpoints (a35799a)
- feat(api): add root router and remaining tests (a7e9741)
- feat(api): add boot server with health check and Vite integration (709477a)
- feat(frontend): add Vue app shell, tRPC client, and theme (7e02a0b)
- feat(frontend): add reusable UI components with tests (b164dbc)
- feat(frontend): add useResourceCrud composable with tests (86a80df)
- feat(frontend): add ResourceTable and ResourceSearch components (cd3b1c0)
- feat(frontend): add ResourcePage component (5db3169)
- feat(frontend): add Albums, Comments, Photos, Posts, and Todos pages (aae39f7)
- feat(frontend): add Users page with admin features (5d87d7f)
- feat(frontend): add auth composable with tests (671d6b3)
- feat(frontend): add Home page with health badges (0ed1da2)
- feat(frontend): add Settings page with admin-only editing (b86108d)
- feat(scripts): add interactive database inspection tool (bb6b7ed)

## Bug Fixes

## Tests
- test(api): cover in-memory rate limiting (93e76db)
- test(api): cover Redis-backed rate limiting (cd27228)
- test(api): cover boot routes, health checks, and startup (67ac2a6)
- test(api): add admin endpoint and JSON Server cache tests (58be5ba)
- test(frontend): add ResourcePage component tests (d234547)
- test(frontend): add Settings page test helpers and auth tests (7e80470)
- test(frontend): add Settings page CRUD and mutation tests (e465780)
- test(frontend): add Settings page mount-based rendering tests (5302192)

## Chores
- chore(init): add package.json and project configuration (7b4290c)
- chore(init): add yarn.lock for deterministic dependency resolution (751948f)
- chore(init): add build, lint, and format tooling (ab6b4e9)
- chore: add commitlint and husky for conventional commits (6be88d2)
- chore: add favicon and public assets (8f61f15)
- chore: add vitest configuration for API and web tests (189b210)
- chore: add manual test coverage verification scripts with harness (7e487df)
- chore: add manual curl test scripts (d6db2e5)
- chore: increase commitlint body/footer line length limit (e2cb826)
- chore: add commit size check with 1000-line threshold to pre-commit hook (f9cc438)
- chore: add editorconfig, gitattributes, and blame-ignore-revs (39852f4)
- chore: add Dependabot config for automated dependency updates (98faaf5)
- chore: enforce coverage thresholds and add lint-staged (1be3bf7)

## Documentation
- docs: add bilingual contributing guidelines (8f59d71)
- docs: add bilingual technical architecture documentation (f7120c8)
- docs: add MIT license (22ff563)
- docs: add bilingual README with quick start and API reference (f123e0b)
- docs: add SECURITY policy and CODE_OF_CONDUCT (f5d984f)
- docs: add PR and issue templates for contributor workflow (94d9e28)

## Refactors

