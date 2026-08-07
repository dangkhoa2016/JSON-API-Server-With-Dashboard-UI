# Release Check Scripts

> 🌐 Language / Ngôn ngữ: **English** | [Tiếng Việt](README.vi.md)

Pre-deployment release verification scripts for the **JSON API Server With Dashboard UI** project. They run automated regression checks against a live server — either one you started yourself, or a fresh container built from the project Docker image.

---

## Contents

| Script                          | Purpose                                                                                          |
| ------------------------------- | ------------------------------------------------------------------------------------------------ |
| `test-endpoints.sh`             | Full API regression suite (REST, Admin API, tRPC, edge cases) against a running server.          |
| `endpoint-regression-test.sh`   | Focused endpoint regression checks (health, tRPC, CRUD, admin) with optional destructive tests.  |
| `release-check-docker.sh`       | Orchestrator: builds the Docker image, boots it with the project `.env`, runs both scripts twice. |

---

## Requirements

- **bash**, **curl**, **jq** (both test scripts use `curl` and `jq`)
- **Docker** (only for `release-check-docker.sh`)
- The project `.env` file at the repository root, providing `ADMIN_USERNAME` / `ADMIN_PASSWORD`
  (the test scripts load admin credentials automatically from `.env`; `ADMIN_USER`/`ADMIN_PASS` or
  `ADMIN_USERNAME`/`ADMIN_PASSWORD` environment variables override them).

> **Note:** rate limiting is automatically disabled during the test runs and restored to its
> original value afterwards, so request-heavy suites are not throttled.

---

## Quick start — full Docker flow

```bash
bash release-check-scripts/release-check-docker.sh
```

This performs the complete release gate:

1. **Build** the image `json-api-server-with-dashboard-ui`.
2. **Run** a container with the project `.env` mounted read-only at `/app/.env` and bound to a
   dynamic loopback port (`127.0.0.1::3000`), then wait for `/api/health` (up to 60 s).
3. **Test** — runs `test-endpoints.sh` and `endpoint-regression-test.sh`, each **twice**, against the container.
4. **Clean up** — stops and removes the container (the image is kept).

Exit code is `0` when every run passes, `1` if any run reports failures.

| Option              | Description                                                             | Default                                |
| ------------------- | ----------------------------------------------------------------------- | -------------------------------------- |
| `[ENV_FILE]`        | Path to the env file mounted into the container.                        | `$PROJECT_DIR/.env`                    |
| `IMAGE_NAME` (env)  | Docker image name/tag to build and run.                                 | `json-api-server-with-dashboard-ui`    |

Example with a custom env file and image name:

```bash
IMAGE_NAME=my-registry/app:1.0 bash release-check-scripts/release-check-docker.sh /path/to/.env
```

---

## Scripts

### `test-endpoints.sh`

Full API regression test suite for pre-deployment verification.

```bash
bash release-check-scripts/test-endpoints.sh [BASE_URL]
```

| Argument   | Default                                                             |
| ---------- | ------------------------------------------------------------------- |
| `BASE_URL` | `$TARGET_URL` env, or `http://localhost:3000` if unset              |

**Coverage (6 suites, 60 checks):**

1. **System health & baseline metadata** — `/api/health`, `/api/counts`, `/api/feature-cards`.
2. **REST listings & query filtering** — pagination, sorting, text search, wildcard escaping, invalid params.
3. **CRUD lifecycle & payload validation** — create/read/update/delete, malformed JSON, 50 MB body limit, 404/413 handling.
4. **Admin REST auth & protected routes** — login, token reuse, 401s without auth, settings seed/reset.
5. **tRPC procedures & routers** — `ping`, `json.*`, `admin.*` routes.
6. **Router fallback & edge cases** — unknown routes return 404.

Exits `0` when all checks pass, `1` if any fail (with a failure summary).

### `endpoint-regression-test.sh`

Endpoint regression checks with an optional destructive admin-data mode.

```bash
bash release-check-scripts/endpoint-regression-test.sh [--admin-data]
```

| Flag          | Description                                                                                        |
| ------------- | -------------------------------------------------------------------------------------------------- |
| `--admin-data`| Also run destructive `POST /api/admin/data/seed` and `POST /api/admin/data/reset` checks.           |

| Env var          | Description                                            | Default                       |
| ---------------- | ------------------------------------------------------ | ----------------------------- |
| `BASE_URL`       | Target server base URL.                                | `http://localhost:3000`       |
| `ADMIN_USERNAME` | Admin user for authenticated checks.                   | value from `.env` or `admin`  |
| `ADMIN_PASSWORD` | Admin password for authenticated checks.               | value from `.env`             |

**Coverage (10 sections, ~100 checks, plus 2 with `--admin-data`):**

1. Health · 2. tRPC · 3. Counts · 4. Feature cards · 5. Resource list shape
6. Get by id · 7. List query features · 8. Error handling · 9. CRUD lifecycle
10. Admin (settings + auth) · 11. Admin data (seed/reset, only with `--admin-data`)

Exits `0` when all checks pass, `1` if any fail.

---

## How it fits the release pipeline

Run the scripts standalone against a server you already started (e.g. `yarn start` or a dev server),
or use `release-check-docker.sh` to validate the actual Docker image end-to-end before deploy:

```bash
# Against an already-running server (e.g. http://localhost:3000)
bash release-check-scripts/test-endpoints.sh
BASE_URL=http://localhost:3000 bash release-check-scripts/endpoint-regression-test.sh

# Full Docker image validation (build + run + test twice + cleanup)
bash release-check-scripts/release-check-docker.sh
```

The scripts exit non-zero on any regression, which makes them suitable for wiring into CI or a
pre-deploy gate.
