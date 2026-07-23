# JSON API Server With Dashboard UI

> 🌐 Language / Ngôn ngữ: **English** | [Tiếng Việt](README.vi.md)

A full-stack CRUD application inspired by [json-server](https://github.com/typicode/json-server) that exposes both a **REST API** and a **tRPC API** over an SQLite database, with a **Vue 3 dashboard UI** for managing 6 resource types: users, posts, comments, albums, photos, and todos.

---

## Highlights

- **Full Vue 3 SPA dashboard** — 14 components, 8 pages, dark mode, responsive layout, toast notifications, and admin settings panel. Not just an API — a complete management UI.
- **Dual API surface, single business logic** — REST (`/api/:resource`) and tRPC (`trpc.json.*`) both delegate to the same typed procedures. Write once, consume from any client.
- **End-to-end type safety** — TypeScript 6 on both sides, tRPC bridges the gap without code generation, Zod validates at every boundary. Zero type gaps between database and UI.
- **100% test coverage** — **50 test files** across backend and frontend achieve 100% on statements, branches, functions, and lines. Integration tests run against real SQLite + HTTP; component tests use `@vue/test-utils` with jsdom.
- **Drizzle ORM with libSQL (Turso-compatible)** — Start with local SQLite, scale to a distributed Turso database. Same code, zero rewrite.
- **Multi-tier rate limiting with circuit breaker** — Redis-backed Lua scripting for atomic counting → in-memory LRU fallback (10k entries) → allow-all. Circuit breaker opens after 3 Redis failures (30s), with escalating block durations.
- **Production-hardened Docker** — Multi-stage build, non-root user, automatic migration + seeding on startup, all config via environment variables.
- **Professional developer experience** — Husky pre-commit hooks, commitlint (conventional commits), CircleCI matrix across Node 22/24/26, automated coverage enforcement.

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
| Testing | [Vitest](https://vitest.dev/), `@vue/test-utils`, jsdom |
| CI | CircleCI (matrix: Node 22, 24, 26) |
| Lint / Format | ESLint, Prettier, commitlint, Husky |

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
                                      ├── Rate limiter (Redis / in-memory)
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
yarn db:push        # Create tables
yarn db:seed        # Seed data from JSONPlaceholder
yarn db:seed:admin  # Create admin credentials
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
| `yarn db:seed` | Seed main data from JSONPlaceholder |
| `yarn db:seed:settings` | Seed settings table |
| `yarn db:seed:admin` | Seed admin credentials |

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
# Run all tests
yarn test

# With coverage
yarn test:coverage

# Watch mode
yarn test:watch
```

The project enforces **100% code coverage**. The test suite comprises:

- **API tests** (19 files, `node` environment): Full integration tests covering all REST endpoints, tRPC procedures, rate limiting, Redis caching, admin auth, settings, environment config, database seeding, and edge cases.
- **Frontend tests** (31 files, `jsdom` environment): Component tests for all UI primitives, pages, layouts; composable tests for auth, theme, and CRUD; utility tests for token helpers and string parsing.

Backend tests use an in-memory SQLite database and seed synthetic data per test. Frontend tests mock tRPC calls, Vue Router, and Lucide icons for isolated component testing.

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

The production build compiles the Vue SPA into `dist/` and bundles the server into `dist/boot.js` via esbuild.

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

The Docker setup builds the application in a multi-stage `node:22-alpine` image, exposes port 3000, and automatically runs migrations and seeding on startup (first run only). Set `SKIP_SEED=true` to skip auto-seeding.

> **Volume persistence**: Mount a volume to `/app/data` to persist the SQLite database across container restarts. Without a volume, all data is lost when the container is removed.

---

## Manual Testing

Curl scripts are available in `manual/` for verifying both REST and tRPC endpoints:

```bash
bash manual/run-all.sh
```

Results are logged to `manual/output/`.

See [docs/TECHNICAL.md](docs/TECHNICAL.md) for detailed architecture, startup and request flows, data model, and implementation notes.

## See also

- [JSON-API-Server](https://github.com/dangkhoa2016/JSON-API-Server) — a similar project by the same author, but it's an API-only server (no UI), also worth checking out.

## Favicon

The favicon files (`favicon.ico`, `favicon.png`, `favicon.svg`) are based on a [robot sticker](public/license.md) by Stickers - Flaticon.

## License

[MIT](LICENSE) — Copyright (c) 2026 Đăng Khoa &lt;i.am@dangkhoa.dev&gt;
