> 🌐 Language / Ngôn ngữ: [English](inspect-db.md) | **Tiếng Việt**

# DB Inspector

Công cụ CLI để inspect và truy vấn trực tiếp SQLite database (libSQL) của dự án, hỗ trợ cả interactive mode và batch mode.

## File location

```
scripts/inspect-db.js
```

## Yêu cầu

- Node.js >= 18
- `@libsql/client` và `drizzle-orm` (đã có trong dependencies)
- File database tồn tại (mặc định `file:./local.db`)

## Database

Script tự động đọc `DATABASE_URL` từ environment, nếu không có sẽ dùng `file:./local.db`.

Các bảng trong database:

| Table | Description |
|-------|-------------|
| `users` | Người dùng (10 rows) |
| `posts` | Bài viết (100 rows) |
| `comments` | Bình luận (500 rows) |
| `albums` | Album ảnh (100 rows) |
| `photos` | Ảnh (5000 rows) |
| `todos` | Công việc (200 rows) |
| `settings` | Cài đặt hệ thống (13 rows) |

---

## Cách chạy

### Interactive mode

```bash
yarn db:inspect
# hoặc
node scripts/inspect-db.js
```

Khi chạy interactive, bạn sẽ thấy prompt `db>` để nhập lệnh. Gõ `exit` hoặc `q` để thoát.

### Batch mode

```bash
node scripts/inspect-db.js --<command> [args...]
```

Batch mode chạy 1 lệnh duy nhất rồi thoát, phù hợp cho scripts hoặc CI/CD.

---

## Commands

### `tables` - Liệt kê tất cả bảng

Hiển thị tên tất cả các bảng cùng số lượng dòng hiện có.

```bash
# Interactive
db> tables

# Batch
node scripts/inspect-db.js --tables
```

Output:

```
  users        10 rows
  posts        100 rows
  comments     500 rows
  albums       100 rows
  photos       5000 rows
  todos        200 rows
  settings     13 rows
```

---

### `schema <table>` - Xem cấu trúc bảng

Hiển thị thông tin cấu trúc bảng bằng `PRAGMA table_info`, bao gồm tên cột, kiểu dữ liệu, ràng buộc.

```bash
# Interactive
db> schema posts

# Batch
node scripts/inspect-db.js --schema posts
```

Output:

```
cid | name    | type    | notnull | dflt_value | pk
----+---------+---------+---------+------------+---
0   | id      | INTEGER | 1       | NULL       | 1
1   | user_id | INTEGER | 1       | NULL       | 0
2   | title   | TEXT    | 1       | NULL       | 0
3   | body    | TEXT    | 1       | NULL       | 0
```

---

### `select <table> [limit]` - Xem dữ liệu

Hiển thị dữ liệu từ bảng. Mặc định lấy 20 dòng, có thể chỉnh limit.

```bash
# Interactive - lấy 20 dòng mặc định
db> select users

# Lấy 5 dòng
db> select posts 5

# Batch
node scripts/inspect-db.js --select users 10
node scripts/inspect-db.js --select todos 3
```

---

### `where <table> <col> <op> <val>` - Filter dữ liệu

Lọc dữ liệu với toán tử so sánh. Giới hạn tối đa 50 kết quả.

**Toán tử hỗ trợ:** `=`, `!=`, `>`, `<`, `>=`, `<=`, `like`

```bash
# Interactive - tìm posts có userId = 1
db> where posts userId = 1

# Tìm todos đã hoàn thành
db> where todos completed = true

# Tìm posts có title chứa từ "qui" (dùng like)
db> where posts title like qui

# Batch
node scripts/inspect-db.js --where posts userId = 1
node scripts/inspect-db.js --where todos completed = true
node scripts/inspect-db.js --where comments postId = 5
```

---

### `find <table> <col> <value>` - Tìm chính xác

Shortcut cho `where ... =`. Tìm giá trị chính xác trong 1 cột.

```bash
# Interactive
db> find users id 3
db> find users username Bret

# Batch
node scripts/inspect-db.js --find users id 3
node scripts/inspect-db.js --find posts userId 1
```

---

### `search <table> <term>` - Tìm kiếm full-text

Tìm kiếm term trên tất cả các cột kiểu `text` của bảng. Sử dụng `LIKE %term%`.

```bash
# Interactive
db> search posts laboriosam
db> search todos mollitia
db> search users Graham

# Batch
node scripts/inspect-db.js --search posts laboriosam
node scripts/inspect-db.js --search users Graham
```

---

### `count <table>` - Đếm dòng

```bash
# Interactive
db> count users

# Batch
node scripts/inspect-db.js --count comments
```

---

### `relationships` - Xem mối quan hệ giữa các bảng

Hiển thị sơ đồ relationships giữa các bảng trong database.

```bash
# Interactive
db> relationships

# Batch
node scripts/inspect-db.js --relationships
```

Output:

```
  users
    ├─< posts       (users.id = posts.userId)
    ├─< albums      (users.id = albums.userId)
    └─< todos       (users.id = todos.userId)

  posts
    ├─> author      (posts.userId = users.id)
    └─< comments    (posts.id = comments.postId)

  comments
    └─> post        (comments.postId = posts.id)

  albums
    ├─> author      (albums.userId = users.id)
    └─< photos      (albums.id = photos.albumId)

  photos
    └─> album       (photos.albumId = albums.id)

  todos
    └─> author      (todos.userId = users.id)
```

---

## Settings Commands

Các lệnh chuyên biệt cho việc inspect bảng `settings` (key-value store).

### `settings` - Xem tất cả settings

Hiển thị tất cả settings, nhóm theo `group`. Mỗi setting hiển thị `key`, `value`, `type` và trạng thái `public/private`. Giá trị của private settings được ẩn thành `********` để bảo vệ thông tin nhạy cảm. Dùng `--reveal` để xem giá trị thật (cẩn trọng với logs/screenshots).

```bash
# Interactive - xem tất cả
db> settings

# Batch (mặc định ẩn private values)
node scripts/inspect-db.js --settings

# Batch (hiện rõ giá trị — cẩn thận khi share output)
node scripts/inspect-db.js --settings --reveal
```

Output:

```
  [general]
    APP_SECRET               = ********  (string, private)

  [redis]
    REDIS_ENABLED            = true  (boolean, public)
    REDIS_HOST               = localhost  (string, public)
    REDIS_PORT               = 6379  (number, public)
    REDIS_PASSWORD           = ********  (string, private)
    REDIS_TTL                = 60  (number, public)

  [rateLimit]
    RATE_LIMIT_ENABLED       = false  (boolean, public)
    RATE_LIMIT_MAX_REQUESTS  = 100  (number, public)
    RATE_LIMIT_WINDOW_MS     = 60000  (number, public)

  [debug]
    DEBUG_SQL                = false  (boolean, public)

  [auth]
    ADMIN_USERNAME           = admin  (string, private)
    ADMIN_PASSWORD_HASH      = ********  (string, private)

  [security]
    ADMIN_SESSION_SECRET     = ********  (string, private)

  (13 settings)
```

### `settings <group>` - Lọc settings theo group

Chỉ hiển thị settings thuộc 1 group cụ thể. Private values cũng được ẩn tương tự.

```bash
# Interactive
db> settings redis
db> settings auth
db> settings rateLimit

# Batch
node scripts/inspect-db.js --settings redis
node scripts/inspect-db.js --settings redis --reveal
```

Output (`settings redis`):

```
  [redis]
    REDIS_ENABLED            = true  (boolean, public)
    REDIS_HOST               = localhost  (string, public)
    REDIS_PORT               = 6379  (number, public)
    REDIS_PASSWORD           = ********  (string, private)
    REDIS_TTL                = 60  (number, public)

  (5 settings)
```

**Các group hiện có:**

| Group | Settings |
|-------|----------|
| `general` | APP_SECRET |
| `redis` | REDIS_ENABLED, REDIS_HOST, REDIS_PORT, REDIS_PASSWORD, REDIS_TTL |
| `rateLimit` | RATE_LIMIT_ENABLED, RATE_LIMIT_MAX_REQUESTS, RATE_LIMIT_WINDOW_MS |
| `debug` | DEBUG_SQL |
| `auth` | ADMIN_USERNAME, ADMIN_PASSWORD_HASH |
| `security` | ADMIN_SESSION_SECRET |

### `setting <key>` - Xem chi tiết 1 setting

Hiển thị đầy đủ thông tin của 1 setting theo key name: value, type, label, description, group, isPublic. Nếu setting là private, value hiển thị là `********`; dùng `--reveal` để xem giá trị thật.

```bash
# Interactive
db> setting REDIS_HOST
db> setting APP_SECRET
db> setting RATE_LIMIT_MAX_REQUESTS

# Batch (mặc định ẩn)
node scripts/inspect-db.js --setting REDIS_HOST
node scripts/inspect-db.js --setting APP_SECRET

# Batch (hiện rõ)
node scripts/inspect-db.js --setting APP_SECRET --reveal
```

Output (`setting REDIS_HOST` — public, hiện rõ):

```
  REDIS_HOST
  ├─ value       : localhost
  ├─ type        : string
  ├─ label       : Redis Host
  ├─ description : Redis server hostname
  ├─ group       : redis
  └─ isPublic    : Yes
```

Output (`setting APP_SECRET` — mặc định, private bị ẩn):

```
  APP_SECRET
  ├─ value       : ********
  ├─ type        : string
  ├─ label       : App Secret
  ├─ description :
  ├─ group       : general
  └─ isPublic    : No
```

### Dùng generic commands với settings

Ngoài 3 lệnh chuyên biệt, bạn vẫn có thể dùng các lệnh generic:

```bash
# Xem raw data dạng bảng
db> select settings 20

# Lọc settings public
db> where settings isPublic = true

# Tìm settings theo key chính xác
db> find settings key REDIS_HOST

# Tìm settings chứa từ "redis" (tìm trong tất cả text columns)
db> search settings redis

# Đếm tổng settings
db> count settings

# Xem schema bảng settings
db> schema settings
```

---

### `help` - Trợ giúp

```bash
db> help
node scripts/inspect-db.js --help
```

### `exit` / `q` - Thoát

```bash
db> exit
```

---

## Ví dụ thực tế

### Kiểm tra database sau khi seed

```bash
node scripts/inspect-db.js --tables
```

### Xem schema trước khi thêm migration

```bash
node scripts/inspect-db.js --schema users
node scripts/inspect-db.js --schema settings
```

### Debug dữ liệu

```bash
# Tìm user theo email
node scripts/inspect-db.js --find users email Sincere@april.biz

# Xem tất cả posts của user id 1
node scripts/inspect-db.js --where posts userId = 1

# Tìm todos chưa hoàn thành
node scripts/inspect-db.js --where todos completed = false

# Tìm comments chứa từ "est"
node scripts/inspect-db.js --search comments est

# Đem tổng số comments
node scripts/inspect-db.js --count comments
```

### Kiểm tra settings

```bash
# Xem tất cả settings theo group (private values masked)
node scripts/inspect-db.js --settings

# Xem settings với giá trị thật (cẩn thận logs/screenshots!)
node scripts/inspect-db.js --settings --reveal

# Xem settings trong group redis
node scripts/inspect-db.js --settings redis

# Xem chi tiết 1 setting (masked nếu private)
node scripts/inspect-db.js --setting REDIS_HOST
node scripts/inspect-db.js --setting APP_SECRET

# Xem chi tiết với giá trị thật
node scripts/inspect-db.js --setting APP_SECRET --reveal

# Tìm settings public
node scripts/inspect-db.js --where settings isPublic = true

# Tìm settings theo key
node scripts/inspect-db.js --find settings key RATE_LIMIT_ENABLED
```

---

## Custom database

Để inspect một database khác, set environment variable `DATABASE_URL`:

```bash
DATABASE_URL="file:./production.db" node scripts/inspect-db.js --tables

# Hoặc dùng SQLite TCP
DATABASE_URL="libsql://your-db.turso.io" node scripts/inspect-db.js --tables
```

---

## Thêm vào package.json

Script đã được thêm sẵn:

```json
"db:inspect": "node scripts/inspect-db.js"
```

Chạy trực tiếp qua npm:

```bash
yarn db:inspect
```
