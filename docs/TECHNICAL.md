# Technical Documentation

> 🌐 Language / Ngôn ngữ: **English** | [Tiếng Việt](TECHNICAL.vi.md)

> Architecture, implementation notes, and internal design of JSON Server with Dashboard UI.

## Architecture

```
JSON-API-Server-With-Dashboard-UI/
├── api/
│   ├── boot.ts                 # Hono server entry point — middleware, routes, production static serving
│   ├── context.ts              # tRPC context factory (rate limiter, admin sessions, cache)
│   ├── router.ts               # tRPC app router (merges jsonServerRouter + adminRouter)
│   ├── middleware.ts            # tRPC middleware (publicQuery — no auth, adminQuery — token required)
│   ├── jsonServerRouter.ts     # Generic CRUD procedures for all 6 resources (list, getById, create, update, delete, count)
│   ├── adminRouter.ts          # Admin procedures (auth: login/verify, settings: list/update, data: seed/resetDatabase)
│   ├── lib/
│   │   ├── env.ts              # Centralized environment config with Zod validation
│   │   ├── adminAuth.ts        # In-memory session tokens with 24h TTL
│   │   ├── ratelimit.ts        # Redis Lua + in-memory LRU + circuit breaker
│   │   ├── redis.ts            # Redis client (ioredis) with cache helpers
│   │   └── vite.ts             # Production static file serving via `hono/serve-static`
│   └── __tests__/              # Backend test suite (19 files)
├── db/
│   ├── schema.ts               # Drizzle schema — 7 tables (users, posts, comments, albums, photos, todos, settings)
│   ├── relations.ts            # Drizzle relations — users → posts → comments, users → albums → photos, etc.
│   ├── seed.ts                 # Fetch data from JSONPlaceholder and insert via Drizzle
│   ├── seed-settings.ts        # Seed settings table from .env variables
│   ├── seed-admin.ts           # Hash admin password with Argon2 and store in settings
│   └── migrations/             # Generated SQL migration files
├── web/                        # Vue 3 frontend
│   ├── main.ts                 # App entry — create Vue app, install router, tRPC plugin, Vue Query
│   ├── App.vue                 # Root component (wraps RouterView + Toaster)
│   ├── providers/trpc.ts       # tRPC client as Vue plugin with httpBatchLink
│   ├── composables/
│   │   ├── useAuth.ts          # Admin auth state (login/logout/session via Vue Query)
│   │   ├── useTheme.ts         # Dark mode — auto/light/dark with system preference listener
│   │   └── useResourceCrud.ts  # Generic CRUD — list/create/update/delete via tRPC
│   ├── components/
│   │   ├── AppLayout.vue       # Responsive sidebar + main content + header
│   │   ├── ResourcePage.vue    # Reusable CRUD page — create/edit/delete dialogs, search, sort, pagination
│   │   ├── ResourceTable.vue   # Data table with sort headers and pagination
│   │   ├── ResourceSearch.vue  # Search bar with client/server mode toggle
│   │   └── ui/                 # 10 primitive components (Button, Dialog, Input, Label, Table, etc.)
│   ├── pages/                  # 8 page components (Home, Users, Posts, Comments, Albums, Photos, Todos, Settings)
│   └── __tests__/              # Frontend test suite (29 files)
└── manual/                     # Curl test scripts by resource (REST + tRPC)
```

### Startup Flow

```
bin/ → vite.config.ts (dev) or node dist/boot.js (production)
         │
         ├── api/lib/env.ts          — Load .env, validate with Zod schema
         │                            (rejects wildcard CORS in production)
         ├── api/lib/redis.ts        — Connect to Redis (if enabled)
         ├── api/lib/ratelimit.ts   — Initialize rate limiter (Redis or in-memory)
         ├── api/lib/adminAuth.ts    — Initialize session store
         ├── db/schema.ts            — Drizzle schema definitions
         └── api/router.ts           — Build tRPC router
                  │
         Hono Server (api/boot.ts)
           ├── CORS middleware (explicit origins required in production)
           ├── Body size limiter (50 MB — stream-enforced with unreadable body detection)
           ├── Rate limiter middleware (/api/* — INCR+PEXPIRE Lua / in-memory LRU)
           ├── tRPC handler (/api/trpc/*)
           ├── REST compatibility routes (/api/:resource)
           ├── Admin REST routes (/api/admin/...)
           └── Static files (production only)
```

**Docker entrypoint** (`docker-entrypoint.sh`): On cold start (no `/app/data/.seeded` marker), runs `yarn db:prepare` which executes the compiled `dist/db/prepare.js` — applying all migrations from `db/migrations/` and seeding the database. Seeds are pre-compiled during `yarn build` via `scripts/build-seeds.sh` (esbuild bundles of `db/seed.ts`, `db/seed-settings.ts`, `db/seed-admin.ts` into `dist/db/`).

### Request Flow

**REST request:**
```
GET /api/posts?_page=1&_limit=10&q=hello
         │
    Hono route handler
         │
    boot.ts: getJsonCaller(c)
         │
    ├── appRouter.createCaller({ req, resHeaders })
    │   └── caller.json.posts.list({ page, limit, q })
    │       └── jsonServerRouter.ts handleList()
    │           ├── Build Drizzle query (select, where, orderBy, limit, offset)
    │           └── Return { data, total }
    │
    └── c.json(result) → JSON response
```

**tRPC request:**
```
POST /api/trpc
  Content-Type: application/json
  Body: {"batch":[{"procedure":"json.posts.list","input":{...}}]}
         │
    fetchRequestHandler({ router: appRouter, createContext })
         │
    ├── createContext({ req }) → injects rateLimiter, cache, adminAuth
    ├── middleware.ts publicQuery → validates public access
    ├── jsonServerRouter.ts → handleList → Drizzle query
    └── SuperJSON-serialized response
```

---

## Implementation Notes

### Dual API Design (REST + tRPC)

REST routes in `boot.ts` are thin HTTP adapters that delegate to the tRPC router via `appRouter.createCaller()`. Each REST handler:

1. Validates the resource name against `VALID_RESOURCES`
2. Creates a tRPC caller from the request context
3. Calls the corresponding tRPC procedure
4. Returns the result as JSON

This ensures business logic lives once in the tRPC router. The REST layer is purely protocol adaptation — no duplication.

### Generic CRUD Handlers

`api/jsonServerRouter.ts` exports reusable handler functions (`handleList`, `handleCreate`, `handleUpdate`, `handleDelete`, `handleGetById`, `handleCount`) and configures them per resource with:

- **Table reference** — which Drizzle table to query
- **Searchable fields** — which columns are searched by the `q` parameter
- **Allowed sort fields** — whitelist for `_sort` parameter (MITIGATES SQL injection)
- **Serialization** — custom serialize/deserialize for JSON fields (e.g., user `address`/`company`)

The resource configuration is an array of `ResourceConfig<TPrimary>` objects that parameterize the generic handlers.

### tRPC Context

`api/context.ts` creates a context object per request containing:

- **`req`** — the raw Request object
- **`resHeaders`** — mutable headers for the response
- **`rateLimiter`** — singleton rate limiter instance
- **`cache`** — Redis cache helper (or null if disabled)
- **`adminAuth`** — admin session manager

The context is injected into every tRPC procedure via the `createContext` callback. Middleware in `middleware.ts` uses `publicQuery` (no auth required) and `adminQuery` (session token required) to gate access.

### Rate Limiter

`api/lib/ratelimit/index.ts` implements a three-tier fallback:

1. **Redis tier** — Atomic Lua script using `INCR` + `PEXPIRE` for window-based counting. Each key is a simple counter with a TTL, avoiding sorted set overhead. The script is called via `redis.eval()` with the ioredis contract. On failure, retries up to 3 times with exponential backoff (100ms, 200ms, 400ms).
2. **In-memory tier** — LRU map (10k max entries) with periodic cleanup (every 5 min). Progressive block durations escalate: 5m → 20m → 1h on repeated violations. Block duration decays after `BLOCK_DECAY_MULTIPLIER × block duration` of good behavior.
3. **Allow-all tier** — If both Redis and in-memory are unavailable, passes all requests (fail-open).

**Request cost weighting**: Different HTTP methods consume different rate-limit budgets — GET/HEAD=1, POST/PUT/PATCH=2, DELETE=3. This prevents expensive mutations from saturating the window.

**Circuit breaker**: Tracks Redis failures; after 3 consecutive failures, opens for 30 seconds, then half-opens. All Redis calls check the breaker first to avoid hammering a downed Redis instance.

**Client IP resolution**: `resolveClientIpFromHeaders` in `ipUtils.ts` extracts the client IP from `X-Forwarded-For`, but only trusts IPs in the `TRUSTED_PROXY_CIDRS` environment variable (default: RFC 1918 and loopback ranges). If the immediate peer is not a trusted proxy, its IP is used directly (not the forwarded header). This prevents IP spoofing through untrusted proxies.

**Login rate limiting**: `adminRouter.ts` implements a separate IP-based throttling for login attempts — 5 attempts per 15-minute window, enforced against the resolved client IP (same proxy-aware resolution as the main rate limiter).

### Admin Authentication

`api/lib/adminAuth.ts` manages sessions in-memory using a `Map<string, AdminSession>`:

- Tokens are generated via `crypto.randomUUID()`
- Sessions expire after 24 hours (checked on access)
- Login validates against the Argon2-hashed password in the settings table, using timing-safe comparison (`timingSafeEqual`) for the username
- Logout invalidates the session immediately
- Login attempts are throttled per IP: 5 attempts per 15-minute window (enforced in `adminRouter.ts` using the same proxy-aware IP resolution as the rate limiter)
- Sensitive settings (`ADMIN_PASSWORD_HASH`, `APP_SECRET`, `REDIS_PASSWORD`) are masked as `********` in API responses unless explicitly revealed via the `reveal` mutation

### Database Schema

7 tables with Drizzle ORM:

- **users** — `id`, `name`, `username`, `email`, `address` (JSON string), `phone`, `website`, `company` (JSON string)
- **posts** — `id`, `user_id`, `title`, `body`
- **comments** — `id`, `post_id`, `name`, `email`, `body`
- **albums** — `id`, `user_id`, `title`
- **photos** — `id`, `album_id`, `title`, `url`, `thumbnail_url`
- **todos** — `id`, `user_id`, `title`, `completed` (boolean)
- **settings** — `id`, `key` (unique), `value`, `type`, `label`, `description`, `group`, `is_public` (boolean)

Relations: `users → posts` (1:N), `posts → comments` (1:N), `users → albums` (1:N), `albums → photos` (1:N), `users → todos` (1:N).

`address` and `company` are stored as JSON strings and parsed on read via `deserializeUser`/`serializeUser` in the tRPC router.

### Frontend Architecture

- **State management**: TanStack Vue Query handles all async state (caching, refetching, optimistic updates). CRUD mutations invalidate the list query on success.
- **tRPC client**: Created via `createTRPCVueQueryClient()` with `httpBatchLink` in `web/providers/trpc.ts`. Combined with Vue Query for automatic cache management.
- **Generic CRUD**: `useResourceCrud` composable provides `list`, `create`, `update`, `delete` operations and loading/error states for any resource. Used by all 6 resource pages.
- **UI components**: Primitive components (Table, Button, Dialog, Input, etc.) are built with `class-variance-authority` for variant management and `tailwind-merge` for class composition.
- **Theme**: `useTheme` composable manages a `theme` ref (auto/light/dark). In auto mode, listens for `prefers-color-scheme` changes and toggles the `.dark` class on `<html>`.

### Testing Strategy

**Backend (Vitest, `node` environment):**

- Tests use an in-memory SQLite database (`:memory:`) to avoid side effects
- `api/__tests__/vitest.setup.ts` sets all environment variables and disables Redis/rate-limiting for tests
- 19 test files cover: REST endpoints, tRPC procedures, rate limiter, Redis cache, admin auth, settings, env config, edge cases
- Integration tests run against a real HTTP server via `app.request()`

**Frontend (Vitest, `jsdom` environment):**

- Components are tested with `@vue/test-utils` (shallowMount + mount)
- tRPC calls are mocked to avoid server dependency
- Vue Router, Lucide icons, and window.matchMedia are mocked
- 31 test files cover: all 14 components, 3 composables, 8 pages, utility functions

### CORS Configuration

`api/boot.ts` applies the Hono CORS middleware with origins from `env.corsOriginList`:

- In **development** (`NODE_ENV !== "production"`), a wildcard `*` is accepted (all origins).
- In **production**, a wildcard is **rejected at startup** with a clear error message. Set `CORS_ORIGINS` to explicit comma-separated origins (e.g., `https://example.com,https://admin.example.com`). Duplicates are deduplicated.
- The middleware sets `credentials: true` to support session cookies.

### Body Size Enforcement

`api/lib/bodyLimit.ts` enforces a **50 MB** limit on POST/PUT/PATCH requests:

- First checks the `Content-Length` header — if malformed (non-numeric), returns 400 `"Request body unreadable"`.
- Then streams the body through a reader, canceling on excess and returning 413 `"Request body too large"`.
- Stream read errors produce 400 `"Request body unreadable"` — prevents malformed chunked requests from reaching application code.

### Dev Server

In development, `@hono/vite-dev-server` runs the Hono API server inside the Vite dev server. Both frontend and backend benefit from hot module replacement (HMR). Vite proxies `/api/*` requests to the Hono server automatically.
