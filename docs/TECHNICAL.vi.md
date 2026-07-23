# Tài liệu Kỹ thuật

> 🌐 Language / Ngôn ngữ: [English](TECHNICAL.md) | **Tiếng Việt**

> Kiến trúc, ghi chú triển khai, và thiết kế nội bộ của JSON Server with Dashboard UI.

## Kiến trúc

```
JSON-API-Server-With-Dashboard-UI/
├── api/
│   ├── boot.ts                 # Entry point Hono server — middleware, routes, phục vụ static production
│   ├── context.ts              # Factory context tRPC (rate limiter, admin sessions, cache)
│   ├── router.ts               # Router tRPC chính (hợp nhất jsonServerRouter + adminRouter)
│   ├── middleware.ts            # Middleware tRPC (publicQuery — không auth, adminQuery — cần token)
│   ├── jsonServerRouter.ts     # Thủ tục CRUD tổng quát cho 6 tài nguyên (list, getById, create, update, delete, count)
│   ├── adminRouter.ts          # Thủ tục admin (auth: login/verify, settings: list/update, data: seed/resetDatabase)
│   ├── lib/
│   │   ├── env.ts              # Cấu hình môi trường tập trung với xác thực Zod
│   │   ├── adminAuth.ts        # Token session trong bộ nhớ với TTL 24h
│   │   ├── ratelimit.ts        # Redis Lua + in-memory LRU + circuit breaker
│   │   ├── redis.ts            # Redis client (ioredis) với cache helpers
│   │   └── vite.ts             # Phục vụ static file production qua `hono/serve-static`
│   └── __tests__/              # Bộ test backend (19 file)
├── db/
│   ├── schema.ts               # Schema Drizzle — 7 bảng (users, posts, comments, albums, photos, todos, settings)
│   ├── relations.ts            # Quan hệ Drizzle — users → posts → comments, users → albums → photos, v.v.
│   ├── seed.ts                 # Lấy dữ liệu từ JSONPlaceholder và insert qua Drizzle
│   ├── seed-settings.ts        # Nạp bảng settings từ biến .env
│   ├── seed-admin.ts           # Băm mật khẩu admin với Argon2 và lưu vào settings
│   └── migrations/             # File migration SQL đã sinh
├── web/                        # Frontend Vue 3
│   ├── main.ts                 # Entry app — tạo Vue app, cài router, plugin tRPC, Vue Query
│   ├── App.vue                 # Component gốc (bao bọc RouterView + Toaster)
│   ├── providers/trpc.ts       # tRPC client dạng Vue plugin với httpBatchLink
│   ├── composables/
│   │   ├── useAuth.ts          # Trạng thái auth admin (login/logout/session qua Vue Query)
│   │   ├── useTheme.ts         # Chế độ tối — auto/light/dark với lắng nghe hệ thống
│   │   └── useResourceCrud.ts  # CRUD tổng quát — list/create/update/delete qua tRPC
│   ├── components/
│   │   ├── AppLayout.vue       # Sidebar responsive + nội dung chính + header
│   │   ├── ResourcePage.vue    # Trang CRUD tái sử dụng — dialog create/edit/delete, tìm kiếm, sắp xếp, phân trang
│   │   ├── ResourceTable.vue   # Bảng dữ liệu với tiêu đề sắp xếp và phân trang
│   │   ├── ResourceSearch.vue  # Thanh tìm kiếm với chuyển đổi chế độ client/server
│   │   └── ui/                 # 10 component cơ bản (Button, Dialog, Input, Label, Table, v.v.)
│   ├── pages/                  # 8 component trang (Home, Users, Posts, Comments, Albums, Photos, Todos, Settings)
│   └── __tests__/              # Bộ test frontend (29 file)
└── manual/                     # Script curl test theo tài nguyên (REST + tRPC)
```

### Luồng khởi động

```
bin/ → vite.config.ts (dev) hoặc node dist/boot.js (production)
         │
         ├── api/lib/env.ts          — Tải .env, xác thực với schema Zod
         ├── api/lib/redis.ts        — Kết nối Redis (nếu được bật)
         ├── api/lib/ratelimit.ts   — Khởi tạo rate limiter (Redis hoặc in-memory)
         ├── api/lib/adminAuth.ts    — Khởi tạo session store
         ├── db/schema.ts            — Định nghĩa schema Drizzle
         └── api/router.ts           — Xây dựng tRPC router
                  │
         Hono Server (api/boot.ts)
           ├── CORS middleware
           ├── Body size limiter (50 MB)
           ├── Rate limiter middleware (/api/*)
           ├── tRPC handler (/api/trpc/*)
           ├── REST compatibility routes (/api/:resource)
           ├── Admin REST routes (/api/admin/...)
           └── Static files (production only)
```

### Luồng xử lý yêu cầu

**Yêu cầu REST:**
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
    │           ├── Xây dựng truy vấn Drizzle (select, where, orderBy, limit, offset)
    │           └── Trả về { data, total }
    │
    └── c.json(result) → JSON response
```

**Yêu cầu tRPC:**
```
POST /api/trpc
  Content-Type: application/json
  Body: {"batch":[{"procedure":"json.posts.list","input":{...}}]}
         │
    fetchRequestHandler({ router: appRouter, createContext })
         │
    ├── createContext({ req }) → inject rateLimiter, cache, adminAuth
    ├── middleware.ts publicQuery → xác thực truy cập công khai
    ├── jsonServerRouter.ts → handleList → truy vấn Drizzle
    └── Phản hồi được tuần tự hóa SuperJSON
```

---

## Ghi chú triển khai

### Thiết kế hai mặt API (REST + tRPC)

Các route REST trong `boot.ts` là adapter HTTP mỏng ủy thác cho tRPC router qua `appRouter.createCaller()`. Mỗi handler REST:

1. Xác thực tên tài nguyên với `VALID_RESOURCES`
2. Tạo tRPC caller từ context yêu cầu
3. Gọi thủ tục tRPC tương ứng
4. Trả về kết quả dạng JSON

Điều này đảm bảo business logic chỉ tồn tại một lần trong tRPC router. Lớp REST chỉ đơn thuần là chuyển đổi giao thức — không trùng lặp.

### Handler CRUD tổng quát

`api/jsonServerRouter.ts` xuất các hàm handler tái sử dụng (`handleList`, `handleCreate`, `handleUpdate`, `handleDelete`, `handleGetById`, `handleCount`) và cấu hình chúng cho từng tài nguyên với:

- **Tham chiếu bảng** — bảng Drizzle nào cần truy vấn
- **Trường có thể tìm kiếm** — cột nào được tìm kiếm bởi tham số `q`
- **Trường sắp xếp được phép** — danh sách trắng cho tham số `_sort` (NGĂN CHẶN SQL injection)
- **Tuần tự hóa** — serialize/deserialize tùy chỉnh cho trường JSON (vd: `address`/`company` của user)

Cấu hình tài nguyên là một mảng các đối tượng `ResourceConfig<TPrimary>` tham số hóa các handler tổng quát.

### Context tRPC

`api/context.ts` tạo đối tượng context cho mỗi yêu cầu chứa:

- **`req`** — đối tượng Request thô
- **`resHeaders`** — header có thể thay đổi cho phản hồi
- **`rateLimiter`** — thể hiện rate limiter đơn thể
- **`cache`** — helper cache Redis (hoặc null nếu bị tắt)
- **`adminAuth`** — trình quản lý session admin

Context được inject vào mọi thủ tục tRPC qua callback `createContext`. Middleware trong `middleware.ts` dùng `publicQuery` (không cần auth) và `adminQuery` (cần token session) để kiểm soát truy cập.

### Rate Limiter

`api/lib/ratelimit.ts` triển khai dự phòng ba tầng:

1. **Tầng Redis** — Lua script nguyên tử để đếm theo cửa sổ. Dùng `EVAL` với sorted set cho mỗi key, dọn các mục hết hạn qua `ZREMRANGEBYSCORE`.
2. **Tầng in-memory** — Map LRU (tối đa 10k mục) với dọn dẹp định kỳ. Loại bỏ mục cũ nhất khi đầy.
3. **Tầng cho phép tất cả** — Nếu cả Redis và in-memory đều không khả dụng, cho phép tất cả request (fail-open).

Circuit breaker theo dõi lỗi Redis: sau 3 lần lỗi liên tiếp, nó mở trong 30 giây, sau đó nửa mở. Thời gian chặn tăng dần sau các vi phạm liên tiếp (5 ph → 20 ph → 1 giờ). IP proxy đáng tin cậy được trích xuất từ `X-Forwarded-For` bằng CIDR matching.

### Xác thực Admin

`api/lib/adminAuth.ts` quản lý session trong bộ nhớ dùng `Map<string, AdminSession>`:

- Token được sinh qua `crypto.randomUUID()`
- Session hết hạn sau 24 giờ (kiểm tra khi truy cập)
- Đăng nhập xác thực với mật khẩu đã băm Argon2 trong bảng settings
- Đăng xuất hủy session ngay lập tức

### Schema Database

7 bảng với Drizzle ORM:

- **users** — `id`, `name`, `username`, `email`, `address` (chuỗi JSON), `phone`, `website`, `company` (chuỗi JSON)
- **posts** — `id`, `user_id`, `title`, `body`
- **comments** — `id`, `post_id`, `name`, `email`, `body`
- **albums** — `id`, `user_id`, `title`
- **photos** — `id`, `album_id`, `title`, `url`, `thumbnail_url`
- **todos** — `id`, `user_id`, `title`, `completed` (boolean)
- **settings** — `id`, `key` (duy nhất), `value`, `type`, `label`, `description`, `group`, `is_public` (boolean)

Quan hệ: `users → posts` (1:N), `posts → comments` (1:N), `users → albums` (1:N), `albums → photos` (1:N), `users → todos` (1:N).

`address` và `company` được lưu dưới dạng chuỗi JSON và được phân tích khi đọc qua `deserializeUser`/`serializeUser` trong tRPC router.

### Kiến trúc Frontend

- **Quản lý state**: TanStack Vue Query xử lý toàn bộ async state (caching, refetching, optimistic updates). Mutation CRUD hủy truy vấn danh sách khi thành công.
- **tRPC client**: Được tạo qua `createTRPCVueQueryClient()` với `httpBatchLink` trong `web/providers/trpc.ts`. Kết hợp với Vue Query để tự động quản lý cache.
- **CRUD tổng quát**: Composable `useResourceCrud` cung cấp các thao tác `list`, `create`, `update`, `delete` và trạng thái loading/error cho bất kỳ tài nguyên nào. Được dùng bởi tất cả 6 trang tài nguyên.
- **Component UI**: Các component cơ bản (Table, Button, Dialog, Input, v.v.) được xây dựng với `class-variance-authority` để quản lý biến thể và `tailwind-merge` để kết hợp class.
- **Theme**: Composable `useTheme` quản lý ref `theme` (auto/light/dark). Ở chế độ auto, lắng nghe thay đổi `prefers-color-scheme` và chuyển đổi class `.dark` trên `<html>`.

### Chiến lược Kiểm thử

**Backend (Vitest, môi trường `node`):**

- Test dùng database SQLite trong bộ nhớ (`:memory:`) để tránh tác dụng phụ
- `api/__tests__/vitest.setup.ts` đặt tất cả biến môi trường và tắt Redis/rate-limiting cho test
- 19 file test bao phủ: REST endpoints, tRPC procedures, rate limiter, Redis cache, admin auth, settings, env config, trường hợp biên
- Integration tests chạy với HTTP server thật qua `app.request()`

**Frontend (Vitest, môi trường `jsdom`):**

- Component được test với `@vue/test-utils` (shallowMount + mount)
- tRPC calls được giả lập để tránh phụ thuộc server
- Vue Router, Lucide icons, và window.matchMedia được giả lập
- 31 file test bao phủ: tất cả 14 components, 3 composables, 8 pages, hàm tiện ích

### Dev Server

Trong môi trường phát triển, `@hono/vite-dev-server` chạy Hono API server bên trong Vite dev server. Cả frontend và backend đều hưởng lợi từ hot module replacement (HMR). Vite tự động proxy các yêu cầu `/api/*` đến Hono server.
