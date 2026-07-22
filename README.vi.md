# JSON API Server With Dashboard UI

> 🌐 Language / Ngôn ngữ: [English](README.md) | **Tiếng Việt**

Một ứng dụng CRUD full-stack lấy cảm hứng từ [json-server](https://github.com/typicode/json-server), cung cấp cả **REST API** và **tRPC API** trên nền SQLite, kèm **giao diện Vue 3** để quản lý 6 loại tài nguyên: users, posts, comments, albums, photos, và todos.

---

## Điểm nổi bật

- **Giao diện Vue 3 SPA hoàn chỉnh** — 14 components, 8 trang, chế độ tối, bố cục responsive, thông báo toast, và bảng quản trị settings. Không chỉ là API — một giao diện quản lý trọn vẹn.
- **Hai mặt API, một business logic** — REST (`/api/:resource`) và tRPC (`trpc.json.*`) cùng ủy thác vào cùng một thủ tục đã được định kiểu. Viết một lần, dùng từ bất kỳ client nào.
- **An toàn kiểu dữ liệu từ đầu đến cuối** — TypeScript 6 ở cả hai phía, tRPC kết nối mà không cần sinh code, Zod xác thực ở mọi ranh giới. Không có khoảng trống kiểu giữa database và UI.
- **100% test coverage** — **50 file test** ở cả backend và frontend đạt 100% trên statements, branches, functions, và lines. Integration tests chạy với SQLite thật + HTTP; component tests dùng `@vue/test-utils` với jsdom.
- **Drizzle ORM với libSQL (tương thích Turso)** — Bắt đầu với SQLite cục bộ, mở rộng lên Turso distributed database. Cùng code, không cần viết lại.
- **Giới hạn tốc độ đa tầng với circuit breaker** — Lua scripting trên Redis đếm nguyên tử → dự phòng in-memory LRU (10k mục) → cho phép tất cả. Circuit breaker mở sau 3 lần Redis thất bại (30s), với thời gian chặn tăng dần.
- **Docker sẵn sàng sản xuất** — Build đa tầng, chạy với user không phải root, tự động migration + seeding khi khởi động, toàn bộ cấu hình qua biến môi trường.
- **Trải nghiệm phát triển chuyên nghiệp** — Husky pre-commit hooks, commitlint (conventional commits), CircleCI ma trận trên Node 22/24/26, tự động kiểm tra coverage.

---

## Công nghệ sử dụng

| Danh mục | Công nghệ |
|---|---|
| Runtime | Node.js ≥ 22 |
| Ngôn ngữ | TypeScript 6 |
| HTTP server | [Hono](https://hono.dev/) + `@hono/node-server` |
| RPC an toàn kiểu | [tRPC](https://trpc.io/) |
| ORM | [Drizzle](https://orm.drizzle.team/) với libSQL / Turso |
| Frontend | [Vue 3](https://vuejs.org/), [Vite 8](https://vitejs.dev/), [Vue Router](https://router.vuejs.org/) |
| Async state | [TanStack Vue Query](https://tanstack.com/query/latest) + `@trpc-vue-query/client` |
| Giao diện | [Tailwind CSS 4](https://tailwindcss.com/), icon [Lucide](https://lucide.dev/) |
| Xác thực | [Zod](https://zod.dev/) |
| Cache | Redis qua [ioredis](https://github.com/redis/ioredis) |
| Bảo mật | Argon2 qua `@node-rs/argon2` |
| Kiểm thử | [Vitest](https://vitest.dev/), `@vue/test-utils`, jsdom |
| CI | CircleCI (ma trận: Node 22, 24, 26) |
| Lint / Format | ESLint, Prettier, commitlint, Husky |

---

## Kiến trúc

```
Trình duyệt
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
                                    Redis (tùy chọn: caching + rate limit)
```

---

## Bắt đầu nhanh

### Yêu cầu

- Node.js ≥ 22
- Yarn

### Cài đặt

```bash
# Cài dependencies
yarn install

# Cấu hình môi trường
cp .env.example .env
```

Sửa file `.env` với tối thiểu:

```env
APP_SECRET=your-secret-key-change-this
DATABASE_URL=file:./local.db
```

### Khởi tạo database

```bash
yarn db:push        # Tạo bảng
yarn db:seed        # Nạp dữ liệu từ JSONPlaceholder
yarn db:seed:admin  # Tạo thông tin đăng nhập admin
```

### Bắt đầu phát triển

```bash
yarn dev
```

Mở http://localhost:3000 — cả API và SPA đều được phục vụ bởi Vite dev server.

---

## Biến môi trường

| Biến | Bắt buộc | Mặc định | Mô tả |
|---|---|---|---|
| `APP_SECRET` | Có | — | Dùng để ký session |
| `DATABASE_URL` | Có | — | Chuỗi kết nối libSQL (`file:./local.db` hoặc `libsql://...`) |
| `PORT` | Không | `3000` | Cổng server |
| `REDIS_ENABLED` | Không | `false` | Bật Redis caching |
| `REDIS_HOST` | Không | `localhost` | Redis host |
| `REDIS_PORT` | Không | `6379` | Redis port |
| `REDIS_PASSWORD` | Không | — | Redis password |
| `REDIS_TTL` | Không | `60` | Thời gian cache (giây) |
| `CACHE_ENABLED` | Không | `false` | Bật query caching |
| `RATE_LIMIT_ENABLED` | Không | `false` | Bật giới hạn tốc độ |
| `RATE_LIMIT_MAX_REQUESTS` | Không | `100` | Số request tối đa mỗi cửa sổ |
| `RATE_LIMIT_WINDOW_MS` | Không | `60000` | Thời gian cửa sổ (ms) |
| `ADMIN_USERNAME` | Không | — | Tên đăng nhập admin |
| `ADMIN_PASSWORD` | Không | — | Mật khẩu admin |
| `DEBUG_SQL` | Không | `false` | Ghi log câu lệnh SQL |
| `SKIP_SEED` | Không | `false` | Bỏ qua tự động seed lần đầu (Docker) |

---

## Scripts

| Script | Mô tả |
|---|---|
| `yarn dev` | Chạy Vite dev server (HMR cho cả frontend và backend) |
| `yarn build` | Build frontend (Vite) + bundle server (esbuild) |
| `yarn start` | Chạy server production |
| `yarn test` | Chạy tất cả tests |
| `yarn test:watch` | Chạy tests ở chế độ watch |
| `yarn test:coverage` | Chạy tests với coverage (mục tiêu 100%) |
| `yarn lint` | ESLint |
| `yarn format` | Prettier |
| `yarn check` | vue-tsc kiểm tra kiểu |
| `yarn db:generate` | Sinh migration Drizzle |
| `yarn db:migrate` | Áp dụng migration |
| `yarn db:push` | Đẩy schema trực tiếp |
| `yarn db:seed` | Nạp dữ liệu từ JSONPlaceholder |
| `yarn db:seed:settings` | Nạp bảng settings |
| `yarn db:seed:admin` | Nạp thông tin admin |

---

## Cấu trúc dự án

```
.
├── api/
│   ├── boot.ts                 # Entry point Hono server
│   ├── context.ts              # Factory context tRPC
│   ├── router.ts               # Router tRPC chính
│   ├── middleware.ts            # Middleware tRPC (publicQuery, adminQuery)
│   ├── jsonServerRouter.ts     # Thủ tục CRUD tổng quát
│   ├── adminRouter.ts          # Auth admin, settings, quản lý dữ liệu
│   ├── lib/
│   │   ├── env.ts              # Cấu hình môi trường
│   │   ├── adminAuth.ts        # Quản lý session trong bộ nhớ
│   │   ├── ratelimit.ts        # Rate limiter Redis + in-memory
│   │   ├── redis.ts            # Redis client & caching
│   │   └── vite.ts             # Phục vụ static file (production)
│   └── __tests__/              # Bộ test backend (19 file)
├── db/
│   ├── schema.ts               # Schema Drizzle (7 bảng)
│   ├── relations.ts            # Quan hệ giữa các bảng
│   ├── seed.ts                 # Nạp dữ liệu từ JSONPlaceholder
│   ├── seed-settings.ts        # Nạp settings
│   ├── seed-admin.ts           # Nạp thông tin admin
│   └── migrations/             # File migration SQL
├── web/
│   ├── main.ts                 # Entry Vue app
│   ├── App.vue                 # Component gốc
│   ├── index.css               # Tailwind + biến dark mode
│   ├── providers/trpc.ts       # Plugin tRPC client
│   ├── composables/
│   │   ├── useAuth.ts          # Trạng thái auth admin
│   │   ├── useTheme.ts         # Chế độ tối (auto/light/dark)
│   │   └── useResourceCrud.ts  # Composable CRUD tổng quát
│   ├── lib/
│   │   ├── authToken.ts        # Helper localStorage token
│   │   └── utils.ts            # cn(), tryParseJson
│   ├── components/
│   │   ├── AppLayout.vue       # Sidebar + nội dung chính
│   │   ├── ResourcePage.vue    # Trang CRUD tổng quát
│   │   ├── ResourceTable.vue   # Bảng phân trang có sắp xếp
│   │   ├── ResourceSearch.vue  # Tìm kiếm client/server
│   │   └── ui/                 # Component cơ bản (10 file)
│   ├── pages/                  # 8 component trang
│   └── __tests__/              # Bộ test frontend (31 file)
├── manual/                     # Script curl test (REST + tRPC)
├── Dockerfile                  # Build Docker đa tầng
├── docker-compose.yml          # Cấu hình Docker Compose
├── docker-entrypoint.sh        # Entrypoint tự động seed
└── .env.example                # Mẫu biến môi trường
```

---

## API Reference

### REST Endpoints

Tất cả route REST là adapter mỏng ủy thác cho tRPC router. Kết quả là mảng JSON với metadata phân trang trong header `Link` và `X-Total-Count`.

| Method | Path | Mô tả |
|---|---|---|
| `GET` | `/api/:resource` | Danh sách (`_page`, `_limit`, `_sort`, `_order`, `q`, `*field*`) |
| `GET` | `/api/:resource/:id` | Lấy một mục |
| `POST` | `/api/:resource` | Tạo mới |
| `PUT` | `/api/:resource/:id` | Thay thế toàn bộ |
| `PATCH` | `/api/:resource/:id` | Cập nhật một phần |
| `DELETE` | `/api/:resource/:id` | Xóa |

Tài nguyên hỗ trợ: `users`, `posts`, `comments`, `albums`, `photos`, `todos`.

### tRPC Procedures (qua `POST /api/trpc`)

```typescript
trpc.json.<resource>.list(input: { page?, limit?, sort?, order?, q?, filters? })
trpc.json.<resource>.getById(input: { id })
trpc.json.<resource>.create(input: { data })
trpc.json.<resource>.update(input: { id, data })
trpc.json.<resource>.delete(input: { id })
trpc.json.<resource>.count()
```

### Admin Endpoints

| tRPC procedure | Mô tả |
|---|---|
| `admin.auth.login` | Đăng nhập với username / password |
| `admin.auth.verify` | Xác minh session (kiểm tra Authorization header) |
| `admin.settings.list` | Danh sách settings (admin) / settings công khai (non-admin) |
| `admin.settings.update` | Cập nhật một setting |
| `admin.data.seed` | Nạp lại toàn bộ dữ liệu từ JSONPlaceholder |
| `admin.data.resetDatabase` | Xóa và nạp lại toàn bộ dữ liệu |

---

## Kiểm thử

```bash
# Chạy tất cả tests
yarn test

# Với coverage
yarn test:coverage

# Chế độ watch
yarn test:watch
```

Dự án áp dụng **100% code coverage**. Bộ test bao gồm:

- **API tests** (19 file, môi trường `node`): Kiểm thử tích hợp đầy đủ tất cả REST endpoints, tRPC procedures, rate limiting, Redis caching, admin auth, settings, cấu hình môi trường, database seeding, và các trường hợp biên.
- **Frontend tests** (31 file, môi trường `jsdom`): Kiểm thử component cho tất cả UI primitives, pages, layouts; kiểm thử composable cho auth, theme, và CRUD; kiểm thử utility cho token helpers và xử lý chuỗi.

Backend tests dùng SQLite trong bộ nhớ (`:memory:`) và nạp dữ liệu tổng hợp mỗi test. Frontend tests giả lập tRPC calls, Vue Router, và Lucide icons để kiểm thử component độc lập.

---

## Production

```bash
yarn build
yarn start
```

Bản build production biên dịch Vue SPA vào `dist/` và bundle server vào `dist/boot.js` qua esbuild.

### Docker (từ GitHub Packages)

```bash
# Tải image đã được build sẵn
docker pull ghcr.io/dangkhoa2016/json-api-server-with-dashboard-ui:latest

# Chạy độc lập (database lưu trong ./data)
docker run -d --name json-api-server \
  -p 3000:3000 \
  -e APP_SECRET=change-this-secret \
  -e DATABASE_URL=file:./data/local.db \
  -e ADMIN_USERNAME=admin \
  -e ADMIN_PASSWORD=admin123 \
  -v "$(pwd)/data:/app/data" \
  ghcr.io/dangkhoa2016/json-api-server-with-dashboard-ui:latest

# Hoặc dùng Docker Compose
docker compose up
```

Thiết lập Docker build ứng dụng trong image `node:22-alpine` đa tầng, mở cổng 3000, và tự động chạy migration + seeding khi khởi động (chỉ lần đầu). Đặt `SKIP_SEED=true` để bỏ qua auto-seeding.

> **Lưu trữ dữ liệu**: Mount volume vào `/app/data` để giữ database SQLite khi container khởi động lại. Nếu không có volume, dữ liệu sẽ mất khi xóa container.

---

## Kiểm thử thủ công

Script curl có sẵn trong `manual/` để kiểm tra cả REST và tRPC endpoints:

```bash
bash manual/run-all.sh
```

Kết quả được ghi vào `manual/output/`.

Xem [docs/TECHNICAL.vi.md](docs/TECHNICAL.vi.md) để biết kiến trúc chi tiết, luồng khởi động và xử lý yêu cầu, mô hình dữ liệu, và ghi chú triển khai.

## Tham khảo

- [JSON-API-Server](https://github.com/dangkhoa2016/JSON-API-Server) — một dự án tương tự của cùng tác giả, nhưng là API server thuần (không có UI), cũng rất đáng xem.

## Favicon

Các file favicon (`favicon.ico`, `favicon.png`, `favicon.svg`) được dựa trên [robot sticker](public/license.md) bởi Stickers - Flaticon.

## Giấy phép

[MIT](LICENSE) — Copyright (c) 2026 Đăng Khoa &lt;i.am@dangkhoa.dev&gt;
