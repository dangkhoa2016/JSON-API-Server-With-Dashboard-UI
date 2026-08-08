# Docker Images

> 🌐 Language / Ngôn ngữ: **English** | [Tiếng Việt](DOCKER_IMAGES.vi.md)

This guide explains how to build and publish **multi-architecture Linux container images** for the application to the **GitHub Container Registry (GHCR)**.

The published image targets:

- `linux/amd64` — Intel/AMD x86-64 Linux hosts, Intel Macs through Docker Desktop, and most Windows PCs through Docker Desktop/WSL2 using Linux containers.
- `linux/arm64` — ARM64 Linux servers, Apple Silicon Macs through Docker Desktop, and ARM64 Windows systems using Linux containers.

For modern Docker users, these two platforms cover the large majority of desktop, server, cloud, macOS, and Windows Docker installations. These are **Linux container images**, not native Windows-container images.

Once the GHCR package is made **public**, anyone can pull it anonymously without a GitHub login or package token.

## Overview

A single publishable image exists:

| Image                                                           | Runtime             | Port | Health check  |
| --------------------------------------------------------------- | ------------------- | ---- | ------------- |
| `ghcr.io/dangkhoa2016/json-api-server-with-dashboard-ui:latest` | Node.js 26 (Alpine) | 3000 | `/api/health` |

The image:

- Runs the compiled server (`node dist/boot.js`) under `tini` with a non-root user.
- Exposes port **3000**.
- Runs database preparation + seeding on first boot only (`yarn db:prepare`), gated by the `SKIP_SEED` variable and a `.seeded` marker file in `/app/data`.
- Ships **no secrets**: all configuration is provided at run time through environment variables (the Docker build ignores `.env` and the runtime `.env` is optional).
- Persists the SQLite database and seeds under `/app/data`; mount a volume there to keep data across container recreation.

## Compatibility target

The recommended published manifest contains:

```text
linux/amd64
linux/arm64
```

This gives users one image tag to pull. Docker automatically selects the correct platform from the multi-platform manifest for the host.

Examples:

| User machine                         | Selected image |
| ------------------------------------ | -------------- |
| Linux on Intel/AMD                   | `linux/amd64`  |
| Linux ARM64 / AWS Graviton           | `linux/arm64`  |
| macOS Intel + Docker Desktop         | `linux/amd64`  |
| macOS Apple Silicon + Docker Desktop | `linux/arm64`  |
| Windows x86-64 + Docker Desktop/WSL2 | `linux/amd64`  |
| Windows ARM64 + Docker Desktop       | `linux/arm64`  |

32-bit ARM, 32-bit x86, PowerPC, s390x, RISC-V, and native Windows containers are outside the supported target unless they are explicitly built and tested later.

## Tag strategy

This project publishes a single moving tag:

```text
ghcr.io/dangkhoa2016/json-api-server-with-dashboard-ui:latest
```

`latest` always reflects the current state of the `main` branch. Because it is a moving tag, a stable deployment should pin the image by **digest**:

```bash
docker buildx imagetools inspect \
  ghcr.io/dangkhoa2016/json-api-server-with-dashboard-ui:latest
```

Copy the `Digest: sha256:...` value from the output and run:

```bash
docker run ... ghcr.io/dangkhoa2016/json-api-server-with-dashboard-ui@sha256:...
```

## Requirements for manual publishing

- Docker with Buildx enabled (`docker buildx version`).
- For command-line publishing to GHCR: a **GitHub Personal Access Token (classic)** with the `write:packages` scope, owned by `dangkhoa2016` or the target account.
- Docker Desktop normally provides the required emulation support automatically. On a Linux Docker Engine host, QEMU/binfmt may need to be installed when building an architecture different from the host architecture.

> GitHub Packages authentication for command-line publishing uses a Personal Access Token **(classic)**. Do not document a fine-grained `packages:write` token as a replacement for this GHCR login flow.

## Step 1 — Log in to GHCR for manual publishing

Store the classic PAT in an environment variable instead of placing it directly in shell history:

```bash
echo "$PAT" | docker login ghcr.io -u dangkhoa2016 --password-stdin
```

Never commit or bake the PAT into the Docker image.

> If publishing with GitHub Actions from the repository itself, prefer the workflow's `GITHUB_TOKEN`; a personal PAT is normally unnecessary for that workflow.

## Step 2 — Create a multi-architecture builder

Create the builder once:

```bash
docker buildx create --name multiarch --driver docker-container --use
docker buildx inspect --bootstrap
```

If `multiarch` already exists, reuse it:

```bash
docker buildx use multiarch
docker buildx inspect --bootstrap
```

### QEMU / emulation

On **Docker Desktop**, manual QEMU installation is normally not required.

On **Linux Docker Engine**, if the builder cannot build `linux/arm64` from an x86-64 host (or vice versa), install binfmt/QEMU and then bootstrap the builder again:

```bash
docker run --privileged --rm tonistiigi/binfmt --install arm64
docker buildx inspect --bootstrap
```

Check the builder's supported platforms:

```bash
docker buildx inspect
```

The platform list should include both `linux/amd64` and `linux/arm64`.

## Step 3 — Build and push the image

Build from the current `main` working tree:

````bash
REPOSITORY="https://github.com/dangkhoa2016/JSON-API-Server-With-Dashboard-UI"

docker buildx build \ --platform linux/amd64,linux/arm64 \ --label "org.opencontainers.image.source=$REPOSITORY" \ -t ghcr.io/dangkhoa2016/json-api-server-with-dashboard-ui:latest \ --push . ```

Notes:

- `--push` publishes the multi-platform manifest directly; no separate `docker tag` or `docker push` is required.
- Docker will pull the correct architecture automatically when a user pulls the tag.
- The OCI `org.opencontainers.image.source` label associates the image metadata with the source repository and makes the published artifact easier to trace.
- The `node:26-alpine` official image is multi-architecture. The application and all native dependencies (such as `@node-rs/argon2`) must still build successfully for every platform you publish.
- Add `--provenance=false` only if downstream tooling specifically cannot handle build attestations. Otherwise leave the default provenance behaviour enabled.

## Step 4 — Verify the published multi-platform manifest

Do not assume a push produced both architectures. Inspect the published tag:

```bash
docker buildx imagetools inspect \
  ghcr.io/dangkhoa2016/json-api-server-with-dashboard-ui:latest
````

The result should contain both:

```text
linux/amd64
linux/arm64
```

You can also explicitly test pulls for each architecture on a machine with suitable native support or emulation:

````bash
docker pull --platform linux/amd64 \
  ghcr.io/dangkhoa2016/json-api-server-with-dashboard-ui:latest

docker pull --platform linux/arm64 \ ghcr.io/dangkhoa2016/json-api-server-with-dashboard-ui:latest ```

## Step 5 — Make the GHCR package public

When a GHCR package is published for the first time, its default visibility is **private**. Change it to **Public** before expecting anonymous users to pull it.

In GitHub:

1. Open the package page for `json-api-server-with-dashboard-ui`.
2. Open **Package settings**.
3. Under **Danger Zone**, choose **Change visibility**.
4. Change the package to **Public**.
5. Confirm the visibility change.

A public GHCR container package can be pulled anonymously, so end users do not need a GitHub account, PAT, or `docker login` just to run the image.

After making the package public, verify anonymously from a logged-out Docker client:

```bash
docker logout ghcr.io 2>/dev/null || true
docker pull ghcr.io/dangkhoa2016/json-api-server-with-dashboard-ui:latest
````

## Step 6 — Run the image

For the widest cross-platform compatibility, prefer `--env-file` over shell-specific inline environment-variable syntax. It works consistently with Docker CLI on Linux, macOS, Windows PowerShell, WSL, and other common environments.

### Required environment variables

| Variable         | Purpose                                                                            |
| ---------------- | ---------------------------------------------------------------------------------- |
| `APP_SECRET`     | Application secret used for HMAC session signing                                   |
| `ADMIN_PASSWORD` | Password for admin login (hashed with Argon2 on first seed)                        |
| `CORS_ORIGINS`   | Comma-separated allowed origins (required in production; wildcard `*` is rejected) |

### Optional environment variables

| Variable                                                                  | Default                | Purpose                                                            |
| ------------------------------------------------------------------------- | ---------------------- | ------------------------------------------------------------------ |
| `ADMIN_USERNAME`                                                          | `admin`                | Username for admin login                                           |
| `DATABASE_URL`                                                            | `file:./data/local.db` | libSQL connection string (local file or Turso remote)              |
| `PORT`                                                                    | `3000`                 | Server listen port                                                 |
| `SKIP_SEED`                                                               | `false`                | Set to `true` to skip database seeding on first boot               |
| `REDIS_ENABLED`                                                           | `false`                | Enable Redis-backed rate limiting                                  |
| `REDIS_HOST` / `REDIS_PORT` / `REDIS_PASSWORD` / `REDIS_DB`               | —                      | Redis connection settings                                          |
| `CACHE_ENABLED` / `CACHE_TTL_SECONDS`                                     | `false` / `300`        | Optional response caching                                          |
| `RATE_LIMIT_ENABLED` / `RATE_LIMIT_MAX_REQUESTS` / `RATE_LIMIT_WINDOW_MS` | —                      | Rate-limit tuning                                                  |
| `TRUSTED_PROXY_CIDRS`                                                     | —                      | Comma-separated trusted proxy CIDR ranges for client IP resolution |

### Generate an application secret

Use the host's OpenSSL:

```bash
openssl rand -hex 64
```

Or the Node image itself, so the host does not need OpenSSL:

```bash
docker run --rm node:26-alpine \
  node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Copy the generated value into a local environment file that is **not committed**.

### Run with a local SQLite database

Create `.env.production.local`:

```dotenv
APP_SECRET=replace-with-a-random-secret
ADMIN_USERNAME=admin
ADMIN_PASSWORD=change-me
CORS_ORIGINS=https://your-frontend.example.com
```

Run:

```bash
docker run -d \
  --name json-api-server \
  --env-file .env.production.local \
  -p 3000:3000 \
  -v json_api_storage:/app/data \
  ghcr.io/dangkhoa2016/json-api-server-with-dashboard-ui:latest
```

The SQLite database files live in `/app/data` inside the container. The named volume keeps them across container recreation.

### Docker Compose

`docker-compose.yml` in the repository root documents both options: pull the pre-built image from GitHub Packages or build from local source.

### Verify

```bash
curl -s http://localhost:3000/api/health
```

Expected result: HTTP `200 OK`.

Then sign in to the dashboard with the configured admin credentials.

## Recommended — Publish automatically with GitHub Actions

For a public GitHub repository, GitHub Actions is preferable to manually publishing from a developer workstation. The workflow can use `GITHUB_TOKEN` with `packages: write` instead of storing a personal PAT for ordinary repository-owned publishing.

Every push to `main` (and every manual `workflow_dispatch` run) publishes the `latest` multi-platform image. The workflow:

````yaml
name: Publish Docker image

on: workflow_dispatch: push: branches: [main]

permissions: contents: read packages: write

jobs: publish: runs-on: ubuntu-latest steps:
- uses: actions/checkout@v7

- name: Set up QEMU uses: docker/setup-qemu-action@v4

- name: Set up Docker Buildx uses: docker/setup-buildx-action@v4

- name: Log in to GHCR uses: docker/login-action@v4 with: registry: ghcr.io username: ${{ github.actor }} password: ${{ secrets.GITHUB_TOKEN }}

- name: Build and push uses: docker/build-push-action@v7 with: context: . platforms: linux/amd64,linux/arm64 push: true tags: ghcr.io/dangkhoa2016/json-api-server-with-dashboard-ui:latest labels: | org.opencontainers.image.source=https://github.com/dangkhoa2016/JSON-API-Server-With-Dashboard-UI org.opencontainers.image.revision=${{ github.sha }} ```

For long-lived production workflows, consider pinning third-party GitHub Actions to full commit SHAs instead of moving version tags. GitHub explicitly recommends this for supply-chain stability.

After the first workflow publish, still verify that the GHCR package visibility is **Public** if anonymous pulls are required.

## Troubleshooting

- **`exec format error` on an ARM machine** — inspect the GHCR manifest. The tag may contain only `linux/amd64`; republish with both `linux/amd64` and `linux/arm64`.
- **401 Unauthorized on `docker pull`** — verify the GHCR package is actually Public. Public Container registry packages support anonymous pulls.
- **The public repository is visible but `docker pull` still requires authentication** — repository visibility and package visibility are separate concepts. Check the package's own settings.
- **`arm64` build is slow on an x86-64 builder** — QEMU emulation is slower than a native ARM64 builder. This is expected.
- **Build works on `amd64` but fails on `arm64`** — inspect native gems, OS packages, and any precompiled binaries. A multi-architecture base image alone does not guarantee every application dependency (such as `@node-rs/argon2`) supports every architecture.
- **Builder does not list `linux/arm64`** — on Linux Engine, install binfmt/QEMU and rerun `docker buildx inspect --bootstrap`. Docker Desktop normally handles this automatically.
- **Windows user cannot run the image as a native Windows container** — this project publishes Linux containers. Windows users should run Docker Desktop/WSL2 in Linux container mode.

## Official references

- Docker multi-platform builds: https://docs.docker.com/build/building/multi-platform/
- Docker multi-platform GitHub Actions: https://docs.docker.com/build/ci/github-actions/multi-platform/
- GitHub Container registry: https://docs.github.com/packages/working-with-a-github-packages-registry/working-with-the-container-registry
- GitHub package permissions and visibility: https://docs.github.com/packages/learn-github-packages/about-permissions-for-github-packages
- GitHub Actions Docker publishing: https://docs.github.com/actions/guides/publishing-docker-images
- Node.js Docker official images: https://hub.docker.com/_/node
````
