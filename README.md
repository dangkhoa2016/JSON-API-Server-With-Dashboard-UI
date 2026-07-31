# JSON API Server With Dashboard UI

[![Node 22.x](https://img.shields.io/badge/Node-22.x-339933?style=flat&logo=node.js&logoColor=white)](https://nodejs.org/)
[![Node 24.x](https://img.shields.io/badge/Node-24.x-339933?style=flat&logo=node.js&logoColor=white)](https://nodejs.org/)
[![Node 26.x](https://img.shields.io/badge/Node-26.x-339933?style=flat&logo=node.js&logoColor=white)](https://nodejs.org/)
[![CI](https://github.com/dangkhoa2016/JSON-API-Server-With-Dashboard-UI/actions/workflows/ci.yml/badge.svg)](https://github.com/dangkhoa2016/JSON-API-Server-With-Dashboard-UI/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

> 🌐 Language / Ngôn ngữ: **English** | [Tiếng Việt](README.vi.md)

A full-stack CRUD application inspired by [json-server](https://github.com/typicode/json-server) that exposes both a **REST API** and a **tRPC API** over an SQLite database, with a **Vue 3 dashboard UI** for managing 6 resource types: users, posts, comments, albums, photos, and todos.

---

## Highlights

- **Full Vue 3 SPA dashboard** — 14 components, 8 pages, dark mode, responsive layout, toast notifications, and admin settings panel. Not just an API — a complete management UI.
- **Dual API surface, single business logic** — REST (`/api/:resource`) and tRPC (`trpc.json.*`) both delegate to the same typed procedures. Write once, consume from any client.
- **End-to-end type safety** — TypeScript 6 on both sides, tRPC bridges the gap without code generation, Zod validates at every boundary. Zero type gaps between database and UI.
- **100% test coverage** — **69 test files** across backend and frontend achieve 100% on statements, branches, functions, and lines. Integration tests run against real SQLite + HTTP; component tests use `@vue/test-utils` with jsdom. E2E browser tests use Playwright.
- **Drizzle ORM with libSQL (Turso-compatible)** — Start with local SQLite, scale to a distributed Turso database. Same code, zero rewrite.
- **Multi-tier rate limiting with circuit breaker** — Redis-backed Lua scripting (INCR+PEXPIRE) for atomic counting → in-memory LRU fallback (10k entries, progressive block durations: 5m→20m→1h) → allow-all. Circuit breaker opens after 3 Redis failures (30s), with exponential backoff retries. Request cost weighting: GET=1, POST/PUT/PATCH=2, DELETE=3.
- **Production-hardened Docker** — Multi-stage build, non-root user, automatic migration + seeding on startup, all config via environment variables.
- **Professional developer experience** — Husky pre-commit hooks, commitlint (conventional commits), lint-staged auto-formatting, GitHub Actions CI matrix across Node 22/24/26, automated coverage enforcement (80% threshold), Dependabot dependency updates, Playwright E2E browser tests, and changelog generation.

---

## Technologies Used

| Category | Technology |
|---|---|
| Runtime | Node.js ≥ 22 |
| Language | TypeScript 6 |
| HTTP server | [Hono](https://hono.dev/) + `@hono/node-server` |
| Type-safe RPC | [tRPC](https://trpc.io/) |
| ORM | [Drizzle](https://orm.drizzle.team/) with libSQL / Turso |
| Frontend | [Vue 3](https://vuejs.org/), [Vite 8](https://vitejs.dev/), [Vue Router](https://router.vuejs.org/) |
| Async state | [TanStack Vue Query](https://tanstack.com/query/latest) + `@trpc-vue-query/client` |
| Styling | [Tailwind CSS 4](https://tailwindcss.com/), [Lucide](https://lucide.dev/) icons |
| Validation | [Zod](https://zod.dev/) |
| Caching | Redis via [ioredis](https://github.com/redis/ioredis) |
| Auth | Argon2 via `@node-rs/argon2` |
| Testing | [Vitest](https://vitest.dev/), `@vue/test-utils`, jsdom, [Playwright](https://playwright.dev/) |
| CI | GitHub Actions (matrix: Node 22, 24, 26) |
| Lint / Format | ESLint, Prettier, commitlint, Husky, lint-staged |

---

## Architecture

```
Browser
  ├── Vue Router (SPA)
  ├── TanStack Vue Query
  ├── @trpc-vue-query/client  ──POST──▶  /api/trpc
  └── REST calls              ──GET/POST/PUT/DELETE──▶  /api/:resource
                                              │
                                    Hono Server
                                      ├── CORS
                                      ├── Body limiter (50 MB)
                                       ├── Rate limiter (Redis INCR+PEXPIRE Lua / in-memory LRU + circuit breaker)
                                      ├── tRPC handler (/api/trpc)
                                      │   ├── jsonServerRouter (CRUD)
                                      │   └── adminRouter (auth, settings, data)
                                      ├── REST adapters → tRPC caller
                                      └── Static files (production)
                                              │
                                    SQLite (libSQL + Drizzle ORM)
                                      users, posts, comments,
                                      albums, photos, todos, settings
                                              │
                                    Redis (optional: caching + rate limit)
```

---

## Quick Start

### Prerequisites

- Node.js ≥ 22
- Yarn

### Setup

```bash
# Install dependencies
yarn install

# Configure environment
cp .env.example .env
```

Edit `.env` at minimum:

```env
APP_SECRET=your-secret-key-change-this
DATABASE_URL=file:./local.db
```

### Initialize database

```bash
yarn db:push        # Create tables (Drizzle push)
yarn db:seed        # Seed data from JSONPlaceholder
yarn db:seed:admin  # Create admin credentials
```

For production / Docker, compiled seed preparation is used instead (built by `scripts/build-seeds.sh` during `yarn build`):

```bash
yarn db:prepare     # Apply migrations + seed via compiled scripts (Docker entrypoint)
```

### Start development

```bash
yarn dev
```

Open http://localhost:3000 — both the API and the SPA are served by the Vite dev server.

---

## Environment Variables

| Variable | Required | Default | Description |
|---|---|---|---|
| `APP_SECRET` | Yes | — | Used for session signing |
| `DATABASE_URL` | Yes | — | libSQL connection string (`file:./local.db` or `libsql://...`) |
| `PORT` | No | `3000` | Server port |
| `REDIS_ENABLED` | No | `false` | Enable Redis caching |
| `REDIS_HOST` | No | `localhost` | Redis host |
| `REDIS_PORT` | No | `6379` | Redis port |
| `REDIS_PASSWORD` | No | — | Redis password |
| `REDIS_TTL` | No | `60` | Cache TTL (seconds) |
| `CACHE_ENABLED` | No | `false` | Enable query caching |
| `RATE_LIMIT_ENABLED` | No | `false` | Enable rate limiting |
| `RATE_LIMIT_MAX_REQUESTS` | No | `100` | Max requests per window |
| `RATE_LIMIT_WINDOW_MS` | No | `60000` | Window duration (ms) |
| `ADMIN_USERNAME` | No | — | Admin login username |
| `ADMIN_PASSWORD` | No | — | Admin login password |
| `DEBUG_SQL` | No | `false` | Log SQL queries |
| `CORS_ORIGINS` | Yes (production) | `*` | Comma-separated allowed CORS origins. Wildcard (`*`) rejected in production — set explicit origins like `http://localhost:5173,https://example.com` |
| `TRUSTED_PROXY_CIDRS` | No | `127.0.0.1,::1,10.0.0.0/8,172.16.0.0/12,192.168.0.0/16` | Trusted proxy CIDR ranges for client IP resolution. Only IPs from trusted proxies in `X-Forwarded-For` are used for rate limiting and login throttling |
| `SKIP_SEED` | No | `false` | Skip auto-seeding on first start (Docker) |

---

## Scripts

| Script | Description |
|---|---|
| `yarn dev` | Start Vite dev server (HMR for both frontend and backend) |
| `yarn build` | Build frontend (Vite) + bundle server (esbuild) |
| `yarn start` | Run production server |
| `yarn test` | Run all tests |
| `yarn test:watch` | Run tests in watch mode |
| `yarn test:coverage` | Run tests with coverage (100 % target) |
| `yarn lint` | ESLint |
| `yarn format` | Prettier |
| `yarn check` | vue-tsc type checking |
| `yarn db:generate` | Generate Drizzle migrations |
| `yarn db:migrate` | Apply migrations |
| `yarn db:push` | Push schema directly |
| `yarn db:prepare` | Run compiled seed scripts (Docker entrypoint) |
| `yarn db:seed` | Seed main data from JSONPlaceholder |
| `yarn db:seed:settings` | Seed settings table |
| `yarn db:seed:admin` | Seed admin credentials |
| `yarn test:e2e` | Run Playwright E2E browser tests |

---

## Project Structure

```
.
├── api/
│   ├── boot.ts                 # Hono server entry point
│   ├── context.ts              # tRPC context factory
│   ├── router.ts               # tRPC app router
│   ├── middleware.ts            # tRPC middleware (publicQuery, adminQuery)
│   ├── jsonServerRouter.ts     # Generic CRUD procedures
│   ├── adminRouter.ts          # Admin auth, settings, data management
│   ├── lib/
│   │   ├── env.ts              # Environment config
│   │   ├── adminAuth.ts        # In-memory session management
│   │   ├── ratelimit.ts        # Redis + in-memory rate limiter
│   │   ├── redis.ts            # Redis client & caching
│   │   └── vite.ts             # Production static serving
│   └── __tests__/              # Backend test suite (19 files)
├── db/
│   ├── schema.ts               # Drizzle schema (7 tables)
│   ├── relations.ts            # Table relations
│   ├── seed.ts                 # Seed from JSONPlaceholder
│   ├── seed-settings.ts        # Seed settings
│   ├── seed-admin.ts           # Seed admin credentials
│   └── migrations/             # SQL migrations
├── web/
│   ├── main.ts                 # Vue app entry
│   ├── App.vue                 # Root component
│   ├── index.css               # Tailwind + dark mode variables
│   ├── providers/trpc.ts       # tRPC client plugin
│   ├── composables/
│   │   ├── useAuth.ts          # Admin auth state
│   │   ├── useTheme.ts         # Dark mode (auto/light/dark)
│   │   └── useResourceCrud.ts  # Generic CRUD composable
│   ├── lib/
│   │   ├── authToken.ts        # localStorage token helpers
│   │   └── utils.ts            # cn(), tryParseJson
│   ├── components/
│   │   ├── AppLayout.vue       # Sidebar + main content
│   │   ├── ResourcePage.vue    # Generic CRUD page
│   │   ├── ResourceTable.vue   # Paginated sortable table
│   │   ├── ResourceSearch.vue  # Client/server search toggle
│   │   └── ui/                 # Primitive components (10 files)
│   ├── pages/                  # 8 page components
│   └── __tests__/              # Frontend test suite (31 files)
├── manual/                     # Curl test scripts (REST + tRPC)
├── web/
│   └── e2e/                    # Playwright E2E browser tests
├── .github/
│   ├── dependabot.yml          # Automated dependency updates
│   ├── PULL_REQUEST_TEMPLATE.md
│   └── ISSUE_TEMPLATE/         # Bug report + feature request templates
├── .editorconfig               # Cross-editor coding style
├── .gitattributes              # Line ending normalization
├── SECURITY.md                 # Vulnerability reporting policy
├── CODE_OF_CONDUCT.md          # Contributor Covenant
├── CHANGELOG.md                # Auto-generated release log
├── playwright.config.ts        # E2E test configuration
├── Dockerfile                  # Multi-stage production build
├── docker-compose.yml          # Docker Compose config
├── docker-entrypoint.sh        # Entrypoint with auto-seed
└── .env.example                # Environment template
```

---

## API Reference

### REST Endpoints

All REST routes are thin adapters that delegate to the tRPC router. Results are JSON arrays with pagination metadata in `Link` and `X-Total-Count` headers.

| Method | Path | Description |
|---|---|---|
| `GET` | `/api/:resource` | List items (`_page`, `_limit`, `_sort`, `_order`, `q`, `*field*`) |
| `GET` | `/api/:resource/:id` | Get single item |
| `POST` | `/api/:resource` | Create item |
| `PUT` | `/api/:resource/:id` | Full replace |
| `PATCH` | `/api/:resource/:id` | Partial update |
| `DELETE` | `/api/:resource/:id` | Delete item |

Supported resources: `users`, `posts`, `comments`, `albums`, `photos`, `todos`.

### tRPC Procedures (via `POST /api/trpc`)

```typescript
trpc.json.<resource>.list(input: { page?, limit?, sort?, order?, q?, filters? })
trpc.json.<resource>.getById(input: { id })
trpc.json.<resource>.create(input: { data })
trpc.json.<resource>.update(input: { id, data })
trpc.json.<resource>.delete(input: { id })
trpc.json.<resource>.count()
```

### Admin Endpoints

| tRPC procedure | Description |
|---|---|
| `admin.auth.login` | Login with username / password |
| `admin.auth.verify` | Verify session (check Authorization header) |
| `admin.settings.list` | List all settings (admin) / public settings (non-admin) |
| `admin.settings.update` | Update a setting |
| `admin.data.seed` | Re-seed all data from JSONPlaceholder |
| `admin.data.resetDatabase` | Clear all data and re-seed |

---

## Testing

```bash
# Run all tests (excluding E2E)
yarn test

# With coverage (80% threshold enforced)
yarn test:coverage

# Watch mode
yarn test:watch

# E2E browser tests
yarn test:e2e
```

The project enforces **100% code coverage** (minimum 80% threshold configured in vitest). The test suite comprises:

- **API tests** (25 files, `node` environment): Full integration tests covering all REST endpoints, tRPC procedures, rate limiting, Redis caching, admin auth, settings, environment config, database seeding, and edge cases.
- **Frontend tests** (40 files, `jsdom` environment): Component tests for all UI primitives, pages, layouts; composable tests for auth, theme, and CRUD; utility tests for token helpers and string parsing.
- **E2E tests** (1 file, Playwright): Browser-level tests covering admin login, settings editing, and logout flow against a real running server.

Backend tests use an in-memory SQLite database and seed synthetic data per test. Frontend tests mock tRPC calls, Vue Router, and Lucide icons for isolated component testing. E2E tests start the full application via Vite dev server and run against a real browser.

---

## Contributing

Please read [CONTRIBUTING.md](CONTRIBUTING.md) for details on our commit message conventions and development workflow.

### Quick Start

```bash
# Install dependencies
yarn install

# Run tests
yarn test

# Run linting
yarn lint
```

---

## Production

```bash
yarn build
yarn start
```

The production build compiles the Vue SPA into `dist/`, bundles the server into `dist/boot.js` via esbuild, and compiles seed scripts into `dist/db/prepare.js` via `scripts/build-seeds.sh`.

### Production requirements

| Requirement | Setting |
|---|---|
| **CORS** | Set `CORS_ORIGINS` to explicit origins (wildcard `*` is rejected in production) |
| **Secret** | Set `APP_SECRET` to a strong random value |
| **Admin password** | Set `ADMIN_PASSWORD` (hashed with Argon2 on first seed) |
| **Redis** (optional) | Set `REDIS_ENABLED=true` and configure `REDIS_HOST`/`REDIS_PORT`/`REDIS_PASSWORD` |
| **Database URL** | Set `DATABASE_URL` to a writable path (use a Docker volume for persistence) |
| **Trusted proxy** | If behind a reverse proxy, add its CIDR to `TRUSTED_PROXY_CIDRS` so `X-Forwarded-For` is trusted for rate limiting |

### Docker (from GitHub Packages)

```bash
# Pull the pre-built image
docker pull ghcr.io/dangkhoa2016/json-api-server-with-dashboard-ui:latest

# Run standalone (database stored in ./data)
docker run -d --name json-api-server \
  -p 3000:3000 \
  -e APP_SECRET=change-this-secret \
  -e DATABASE_URL=file:./data/local.db \
  -e ADMIN_USERNAME=admin \
  -e ADMIN_PASSWORD=admin123 \
  -v "$(pwd)/data:/app/data" \
  ghcr.io/dangkhoa2016/json-api-server-with-dashboard-ui:latest

# Or use Docker Compose
docker compose up
```

The Docker setup builds the application in a multi-stage `node:22-alpine` image, exposing port 3000. At startup, the entrypoint runs compiled seed preparation (`yarn db:prepare` → `node dist/db/prepare.js`) — applying migrations and seeding data — on first run only. Seeds are pre-compiled via `scripts/build-seeds.sh` during `yarn build` for fast container startup. Set `SKIP_SEED=true` to skip auto-seeding.

### Container smoke test

```bash
bash scripts/container-smoke-test.sh <image-tag>
```

Builds the image, verifies runtime artifacts (`dist/boot.js`, `dist/db/prepare.js`), runs a container, waits for `/api/health` to respond within 60 seconds, and cleans up on exit.

### Commit policies

The pre-commit hook (`yarn check` + `npx lint-staged`) plus two dedicated scripts enforce commit quality:

- `lint-staged` — auto-formats staged `*.ts`, `*.tsx`, `*.vue`, `*.json`, `*.md`, `*.yaml`, `*.yml` files with ESLint and Prettier.
- `scripts/check-commit-size.sh` — warns on >600 handwritten lines, fails >1000 (strict mode). **Environment variables**: `STRICT=true/false` (fail mode), `MODE=staged|commit` (default staged), `BEFORE=<sha>` (compare against a specific commit). Lockfiles, snapshots, and generated files are exempt.
- `scripts/check-commit-message.mjs` — validates subject ≤72 chars, body uses `- ` bullets, body is required. Merge and Revert commits are allowlisted.

Coverage thresholds (80% statements, 75% branches, 80% functions, 80% lines) are enforced in CI via `vitest.config.ts`. Any commit that drops coverage below these thresholds fails the build.

> **Volume persistence**: Mount a volume to `/app/data` to persist the SQLite database across container restarts. Without a volume, all data is lost when the container is removed.

---

## Manual Testing

Curl scripts are available in `manual/` for verifying both REST and tRPC endpoints:

```bash
bash manual/run-all.sh
```

Results are logged to `manual/output/`.

### Commit coverage verification

A per-commit coverage tool with a safety fixture harness is in `manual-test-coverage/`:

- **Default** (no arguments): includes every commit from root through `HEAD`.
- **Explicit `BASE HEAD`**: base-exclusive `BASE..HEAD` range (standard Git semantics).
- Run the harness in CI via `yarn test:coverage-verifier`.

```bash
# Verify coverage for all commits from root to HEAD (default, root included)
bash manual-test-coverage/verify-commit-coverage.sh

# Verify BASE..HEAD (BASE excluded)
bash manual-test-coverage/verify-commit-coverage.sh <base-sha> <head-sha>

# Customize threshold, project root, test command, or output directory
bash manual-test-coverage/verify-commit-coverage.sh \
  --threshold 90 \
  --project-root /path/to/repo \
  --test-command "npm run coverage" \
  --install \
  --output-dir /tmp/commit-coverage

# Run the fixture harness (isolated, not real project coverage)
yarn test:coverage-verifier
```

**Flags**: `--threshold <n>` (default 80), `--project-root <path>`, `--test-command <cmd>`, `--output-dir <path>` (default `manual-test-coverage/`), `--install` (enable dependency installation). The verifier uses git worktrees to check each commit in isolation without leaving dirty state.

See [docs/TECHNICAL.md](docs/TECHNICAL.md) for detailed architecture, startup and request flows, data model, and implementation notes.

## See also

- [Nodejs-JSON-API-Server](https://github.com/dangkhoa2016/Nodejs-JSON-API-server) — a similar project by the same author, but it's an API-only server (no UI), also worth checking out.

- [Python-JSON-API-Server](https://github.com/dangkhoa2016/Python-JSON-API-Server) — a Python port using FastAPI + SQLAlchemy, mirroring the full feature set of this project.

## Favicon

The favicon files (`favicon.ico`, `favicon.png`, `favicon.svg`) are based on a [robot sticker](public/license.md) by Stickers - Flaticon.

## License

[MIT](LICENSE) — Copyright (c) 2026 Đăng Khoa &lt;i.am@dangkhoa.dev&gt;
