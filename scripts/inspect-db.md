> 🌐 Language / Ngôn ngữ: **English** | [Tiếng Việt](inspect-db.vi.md)

# DB Inspector

A CLI tool to inspect and query the project's SQLite database (libSQL) directly, supporting both interactive mode and batch mode.

## File location

```
scripts/inspect-db.js
```

## Requirements

- Node.js >= 18
- `@libsql/client` and `drizzle-orm` (already included in dependencies)
- A database file must exist (defaults to `file:./local.db`)

## Database

The script reads `DATABASE_URL` from the environment automatically; if not set, it uses `file:./local.db`.

Tables in the database:

| Table | Description |
|-------|-------------|
| `users` | Users (10 rows) |
| `posts` | Posts (100 rows) |
| `comments` | Comments (500 rows) |
| `albums` | Photo albums (100 rows) |
| `photos` | Photos (5000 rows) |
| `todos` | Todos (200 rows) |
| `settings` | System settings (13 rows) |

---

## How to run

### Interactive mode

```bash
yarn db:inspect
# or
node scripts/inspect-db.js
```

When running interactively, you'll see a `db>` prompt to enter commands. Type `exit` or `q` to quit.

### Batch mode

```bash
node scripts/inspect-db.js --<command> [args...]
```

Batch mode runs a single command and exits, suitable for scripts or CI/CD.

---

## Commands

### `tables` - List all tables

Shows the names of all tables along with their current row counts.

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

### `schema <table>` - View table structure

Shows table structure information using `PRAGMA table_info`, including column names, data types, and constraints.

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

### `select <table> [limit]` - View data

Shows data from a table. Defaults to 20 rows; you can adjust the limit.

```bash
# Interactive - fetch 20 rows by default
db> select users

# Fetch 5 rows
db> select posts 5

# Batch
node scripts/inspect-db.js --select users 10
node scripts/inspect-db.js --select todos 3
```

---

### `where <table> <col> <op> <val>` - Filter data

Filters data with comparison operators. Limited to 50 results maximum.

**Supported operators:** `=`, `!=`, `>`, `<`, `>=`, `<=`, `like`

```bash
# Interactive - find posts with userId = 1
db> where posts userId = 1

# Find completed todos
db> where todos completed = true

# Find posts whose title contains "qui" (using like)
db> where posts title like qui

# Batch
node scripts/inspect-db.js --where posts userId = 1
node scripts/inspect-db.js --where todos completed = true
node scripts/inspect-db.js --where comments postId = 5
```

---

### `find <table> <col> <value>` - Exact search

A shortcut for `where ... =`. Finds an exact value in a column.

```bash
# Interactive
db> find users id 3
db> find users username Bret

# Batch
node scripts/inspect-db.js --find users id 3
node scripts/inspect-db.js --find posts userId 1
```

---

### `search <table> <term>` - Full-text search

Searches for a term across all `text` columns of the table. Uses `LIKE %term%`.

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

### `count <table>` - Count rows

```bash
# Interactive
db> count users

# Batch
node scripts/inspect-db.js --count comments
```

---

### `relationships` - View relationships between tables

Displays a relationship diagram between the tables in the database.

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

Dedicated commands for inspecting the `settings` table (a key-value store).

### `settings` - View all settings

Shows all settings, grouped by `group`. Each setting shows `key`, `value`, `type`, and its `public/private` status. Values of private settings are masked as `********` to protect sensitive information. Use `--reveal` to see the real values (be careful with logs/screenshots).

```bash
# Interactive - view all
db> settings

# Batch (private values masked by default)
node scripts/inspect-db.js --settings

# Batch (reveal values — be careful when sharing output)
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

### `settings <group>` - Filter settings by group

Only shows settings belonging to a specific group. Private values are masked the same way.

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

**Available groups:**

| Group | Settings |
|-------|----------|
| `general` | APP_SECRET |
| `redis` | REDIS_ENABLED, REDIS_HOST, REDIS_PORT, REDIS_PASSWORD, REDIS_TTL |
| `rateLimit` | RATE_LIMIT_ENABLED, RATE_LIMIT_MAX_REQUESTS, RATE_LIMIT_WINDOW_MS |
| `debug` | DEBUG_SQL |
| `auth` | ADMIN_USERNAME, ADMIN_PASSWORD_HASH |
| `security` | ADMIN_SESSION_SECRET |

### `setting <key>` - View a single setting

Shows full information for a setting by key name: value, type, label, description, group, isPublic. If the setting is private, the value is shown as `********`; use `--reveal` to see the real value.

```bash
# Interactive
db> setting REDIS_HOST
db> setting APP_SECRET
db> setting RATE_LIMIT_MAX_REQUESTS

# Batch (masked by default)
node scripts/inspect-db.js --setting REDIS_HOST
node scripts/inspect-db.js --setting APP_SECRET

# Batch (revealed)
node scripts/inspect-db.js --setting APP_SECRET --reveal
```

Output (`setting REDIS_HOST` — public, revealed):

```
  REDIS_HOST
  ├─ value       : localhost
  ├─ type        : string
  ├─ label       : Redis Host
  ├─ description : Redis server hostname
  ├─ group       : redis
  └─ isPublic    : Yes
```

Output (`setting APP_SECRET` — default, private masked):

```
  APP_SECRET
  ├─ value       : ********
  ├─ type        : string
  ├─ label       : App Secret
  ├─ description :
  ├─ group       : general
  └─ isPublic    : No
```

### Using generic commands with settings

In addition to the 3 dedicated commands, you can still use the generic commands:

```bash
# View raw data as a table
db> select settings 20

# Filter public settings
db> where settings isPublic = true

# Find settings by exact key
db> find settings key REDIS_HOST

# Search settings for "redis" (searches all text columns)
db> search settings redis

# Count total settings
db> count settings

# View the settings table schema
db> schema settings
```

---

### `help` - Help

```bash
db> help
node scripts/inspect-db.js --help
```

### `exit` / `q` - Quit

```bash
db> exit
```

---

## Practical examples

### Check the database after seeding

```bash
node scripts/inspect-db.js --tables
```

### View the schema before adding a migration

```bash
node scripts/inspect-db.js --schema users
node scripts/inspect-db.js --schema settings
```

### Debug data

```bash
# Find a user by email
node scripts/inspect-db.js --find users email Sincere@april.biz

# View all posts for user id 1
node scripts/inspect-db.js --where posts userId = 1

# Find incomplete todos
node scripts/inspect-db.js --where todos completed = false

# Find comments containing "est"
node scripts/inspect-db.js --search comments est

# Count total comments
node scripts/inspect-db.js --count comments
```

### Check settings

```bash
# View all settings by group (private values masked)
node scripts/inspect-db.js --settings

# View settings with real values (be careful with logs/screenshots!)
node scripts/inspect-db.js --settings --reveal

# View settings in the redis group
node scripts/inspect-db.js --settings redis

# View a single setting (masked if private)
node scripts/inspect-db.js --setting REDIS_HOST
node scripts/inspect-db.js --setting APP_SECRET

# View details with real values
node scripts/inspect-db.js --setting APP_SECRET --reveal

# Find public settings
node scripts/inspect-db.js --where settings isPublic = true

# Find settings by key
node scripts/inspect-db.js --find settings key RATE_LIMIT_ENABLED
```

---

## Custom database

To inspect a different database, set the `DATABASE_URL` environment variable:

```bash
DATABASE_URL="file:./production.db" node scripts/inspect-db.js --tables

# Or use SQLite over TCP
DATABASE_URL="libsql://your-db.turso.io" node scripts/inspect-db.js --tables
```

---

## Add to package.json

The script is already added:

```json
"db:inspect": "node scripts/inspect-db.js"
```

Run it directly via npm:

```bash
yarn db:inspect
```
