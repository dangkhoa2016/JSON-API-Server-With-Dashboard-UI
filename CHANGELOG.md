# Changelog

## Features

- feat(init): add application entry point (b9dc417)
- feat(db): add Drizzle ORM schema and config with tests (1b33412)
- feat(api): add env loader, Redis client, and context (83fd08d)
- feat(api): add rate limiting core with CIDR matching (e8b0200)
- feat(api): add admin auth with HMAC sessions and middleware (618eca3)
- feat(db): add database seed scripts (51e8d3f)
- feat(scripts): add interactive database inspection tool (b8750ef)
- feat(api): add JSON Server core handlers and router with tests (d6b80d7)
- feat(api): add CRUD route factory and migrate posts router (d9fbcb1)
- feat(api): add comments, albums, photos, and todos resources (2ef0441)
- feat(api): add feature cards and resource counts (ae8d72b)
- feat(api): add admin router with auth and settings endpoints (b300a60)
- feat(api): add root router with integration tests (e94ed85)
- feat(api): add boot server with health check and Vite integration (66fdd7b)
- feat(frontend): add Vue app shell, tRPC client, and theme (e83cdd0)
- feat(frontend): add reusable UI components with tests (14bfd27)
- feat(frontend): add ResourceTable and ResourceSearch components (a119af3)
- feat(frontend): add ResourcePage component (19eca51)
- feat(frontend): add useResourceCrud composable with tests (b9d954a)
- feat(frontend): add auth composable with tests (c99485c)
- feat(frontend): add Albums, Comments, Photos, Posts, and Todos pages (92d6be9)
- feat(frontend): add Users page with admin-only delete (7580fbc)
- feat(frontend): add Home page with health badges (6126dec)
- feat(frontend): add Settings page with admin-only editing (d34644c)

## Bug Fixes

_No bug fixes in this release._

## Tests

- test(api): cover in-memory rate limiting (7ed2a1c)
- test(api): cover Redis-backed rate limiting (01d9100)
- test(api): cover router edge cases (47e2bfd)
- test(api): cover boot routes and error mapping (4d670d8)
- test(api): cover health checks and startup (498ffe9)
- test(api): add admin endpoint and JSON Server cache tests (8ee3a5e)
- test(frontend): add ResourcePage component tests (bc8c631)
- test(frontend): add Settings page test helpers and auth tests (f6fa6dd)
- test(frontend): add Settings page CRUD and mutation tests (0f503e0)
- test(frontend): add Settings page mount-based rendering tests (34edb88)
- test: add Playwright E2E test for admin flow (723f2ba)

## Chores

- chore(init): add package.json and project configuration (41460bd)
- chore(init): add yarn.lock for deterministic dependency resolution (5c42c5d)
- chore(init): add build, lint, and format tooling (138e4aa)
- chore: add CI, commitlint, and husky for conventional commits (4e0bf58)
- chore: add favicon and public assets (f03a9ab)
- chore: add vitest configuration for API and web tests (54c54cc)
- chore: add manual test coverage verifier with harness (0dee5fd)
- chore: add coverage verifier fixture harness and package script (112ca53)
- chore: add docker setup, db prepare and smoke test scripts (017ca23)
- chore: add manual testing documentation and curl scripts (5554ce7)
- chore: add commit size check with 1000-line threshold to pre-commit hook (4e535e2)
- chore: add editorconfig, gitattributes, and blame-ignore-revs (8240c7d)
- chore: add Dependabot config and CI policy exemptions (e13b565)
- chore: enforce coverage thresholds and add lint-staged (d6a93c2)
- chore: add changelog generation script ([this commit])

## Documentation

- docs(scripts): document the database inspection tool (c141ba3)
- docs: add bilingual contributing guidelines (11f047c)
- docs: add bilingual technical architecture documentation (39416fe)
- docs: add SECURITY policy and CODE_OF_CONDUCT (9bdae47)
- docs: add PR and issue templates for contributor workflow (15d367b)

## Refactors

_No refactors in this release._
