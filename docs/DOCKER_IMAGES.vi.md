# Docker Images

> 🌐 Language / Ngôn ngữ: [English](DOCKER_IMAGES.md) | **Tiếng Việt**

Hướng dẫn này giải thích cách build và xuất bản **image container Linux đa kiến trúc** của ứng dụng lên **GitHub Container Registry (GHCR)**.

Image được xuất bản hỗ trợ:

- `linux/amd64` — máy chủ Linux Intel/AMD x86-64, Mac Intel qua Docker Desktop, và hầu hết PC Windows qua Docker Desktop/WSL2 dùng container Linux.
- `linux/arm64` — máy chủ Linux ARM64, Mac Apple Silicon qua Docker Desktop, và hệ thống Windows ARM64 dùng container Linux.

Với người dùng Docker hiện đại, hai nền tảng này bao phủ phần lớn các cài đặt Docker trên desktop, server, cloud, macOS và Windows. Đây là **image container Linux**, không phải image container Windows gốc.

Khi package GHCR được đặt ở chế độ **Public**, bất kỳ ai cũng có thể pull ẩn danh mà không cần tài khoản GitHub hay token.

## Tổng quan

Tồn tại một image xuất bản duy nhất:

| Image                                                           | Runtime             | Cổng | Health check  |
| --------------------------------------------------------------- | ------------------- | ---- | ------------- |
| `ghcr.io/dangkhoa2016/json-api-server-with-dashboard-ui:latest` | Node.js 26 (Alpine) | 3000 | `/api/health` |

Image này:

- Chạy server đã biên dịch (`node dist/boot.js`) dưới `tini` với user không phải root.
- Mở cổng **3000**.
- Chạy chuẩn bị database + seed đúng một lần khi khởi động lần đầu (`yarn db:prepare`), được kiểm soát bởi biến `SKIP_SEED` và tệp đánh dấu `.seeded` trong `/app/data`.
- Không đóng gói **bí mật nào**: toàn bộ cấu hình được cung cấp khi chạy qua biến môi trường (Docker build bỏ qua `.env` và `.env` lúc chạy là tùy chọn).
- Lưu database SQLite và dữ liệu seed dưới `/app/data`; hãy mount volume vào đây để giữ dữ liệu khi tạo lại container.

## Mục tiêu tương thích

Manifest xuất bản được khuyến nghị chứa:

```text
linux/amd64
linux/arm64
```

Điều này cho phép người dùng pull một tag duy nhất. Docker tự động chọn nền tảng phù hợp từ manifest đa nền tảng cho máy chủ của họ.

Ví dụ:

| Máy người dùng                       | Image được chọn |
| ------------------------------------ | --------------- |
| Linux trên Intel/AMD                 | `linux/amd64`   |
| Linux ARM64 / AWS Graviton           | `linux/arm64`   |
| macOS Intel + Docker Desktop         | `linux/amd64`   |
| macOS Apple Silicon + Docker Desktop | `linux/arm64`   |
| Windows x86-64 + Docker Desktop/WSL2 | `linux/amd64`   |
| Windows ARM64 + Docker Desktop       | `linux/arm64`   |

ARM 32-bit, x86 32-bit, PowerPC, s390x, RISC-V và container Windows gốc nằm ngoài phạm vi hỗ trợ trừ khi chúng được build và kiểm thử tường minh sau này.

## Chiến lược tag

Dự án này xuất bản một tag cố định duy nhất:

```text
ghcr.io/dangkhoa2016/json-api-server-with-dashboard-ui:latest
```

`latest` luôn phản ánh trạng thái hiện tại của nhánh `main`. Vì đây là tag có thể thay đổi, một triển khai ổn định nên ghim image theo **digest**:

```bash
docker buildx imagetools inspect \
  ghcr.io/dangkhoa2016/json-api-server-with-dashboard-ui:latest
```

Sao chép giá trị `Digest: sha256:...` từ kết quả rồi chạy:

```bash
docker run ... ghcr.io/dangkhoa2016/json-api-server-with-dashboard-ui@sha256:...
```

## Yêu cầu để xuất bản thủ công

- Docker có bật Buildx (`docker buildx version`).
- Để xuất bản GHCR từ dòng lệnh: **Personal Access Token (classic) của GitHub** có quyền `write:packages`, thuộc sở hữu của `dangkhoa2016` hoặc tài khoản đích.
- Docker Desktop thường hỗ trợ emulation sẵn. Trên Linux Docker Engine, có thể cần cài QEMU/binfmt khi build kiến trúc khác với kiến trúc của máy chủ.

> Xác thực GitHub Packages khi xuất bản từ dòng lệnh dùng Personal Access Token **(classic)**. Không dùng token chi tiết `packages:write` thay cho luồng đăng nhập GHCR này.

## Bước 1 — Đăng nhập GHCR để xuất bản thủ công

Lưu PAT classic vào biến môi trường thay vì đặt trực tiếp trong lịch sử shell:

```bash
echo "$PAT" | docker login ghcr.io -u dangkhoa2016 --password-stdin
```

Không bao giờ commit hoặc nhúng PAT vào Docker image.

> Nếu xuất bản bằng GitHub Actions từ chính repository, hãy ưu tiên `GITHUB_TOKEN` của workflow; thông thường không cần PAT cá nhân cho workflow đó.

## Bước 2 — Tạo builder đa kiến trúc

Tạo builder một lần:

```bash
docker buildx create --name multiarch --driver docker-container --use
docker buildx inspect --bootstrap
```

Nếu `multiarch` đã tồn tại, hãy tái sử dụng:

```bash
docker buildx use multiarch
docker buildx inspect --bootstrap
```

### QEMU / emulation

Trên **Docker Desktop**, thường không cần cài QEMU thủ công.

Trên **Linux Docker Engine**, nếu builder không build được `linux/arm64` từ máy x86-64 (hoặc ngược lại), hãy cài binfmt/QEMU rồi bootstrap lại builder:

```bash
docker run --privileged --rm tonistiigi/binfmt --install arm64
docker buildx inspect --bootstrap
```

Kiểm tra các nền tảng builder hỗ trợ:

```bash
docker buildx inspect
```

Danh sách nền tảng nên có cả `linux/amd64` và `linux/arm64`.

## Bước 3 — Build và push image

Build từ cây làm việc `main` hiện tại:

````bash
REPOSITORY="https://github.com/dangkhoa2016/JSON-API-Server-With-Dashboard-UI"

docker buildx build \ --platform linux/amd64,linux/arm64 \ --label "org.opencontainers.image.source=$REPOSITORY" \ -t ghcr.io/dangkhoa2016/json-api-server-with-dashboard-ui:latest \ --push . ```

Ghi chú:

- `--push` xuất bản trực tiếp manifest đa nền tảng; không cần `docker tag` hay `docker push` riêng.
- Docker sẽ tự kéo đúng kiến trúc khi người dùng pull tag này.
- Label OCI `org.opencontainers.image.source` gắn metadata image với repository nguồn, giúp dễ truy vết artifact đã xuất bản.
- Image chính thức `node:26-alpine` là đa kiến trúc. Ứng dụng và mọi dependency gốc (như `@node-rs/argon2`) vẫn phải build thành công trên mọi nền tảng bạn xuất bản.
- Chỉ thêm `--provenance=false` nếu công cụ hạ nguồn không xử lý được build attestations. Nếu không, hãy giữ hành vi provenance mặc định.

## Bước 4 — Kiểm tra manifest đa nền tảng đã xuất bản

Đừng giả định push đã tạo ra cả hai kiến trúc. Hãy kiểm tra tag đã xuất bản:

```bash
docker buildx imagetools inspect \
  ghcr.io/dangkhoa2016/json-api-server-with-dashboard-ui:latest
````

Kết quả nên chứa cả hai:

```text
linux/amd64
linux/arm64
```

Bạn cũng có thể thử pull riêng cho từng kiến trúc trên máy có hỗ trợ hoặc emulation phù hợp:

````bash
docker pull --platform linux/amd64 \
  ghcr.io/dangkhoa2016/json-api-server-with-dashboard-ui:latest

docker pull --platform linux/arm64 \ ghcr.io/dangkhoa2016/json-api-server-with-dashboard-ui:latest ```

## Bước 5 — Đặt package GHCR ở chế độ Public

Khi package GHCR được xuất bản lần đầu, chế độ hiển thị mặc định là **private**. Hãy đổi thành **Public** trước khi mong đợi người dùng ẩn danh pull được.

Trên GitHub:

1. Mở trang package `json-api-server-with-dashboard-ui`.
2. Mở **Package settings**.
3. Trong **Danger Zone**, chọn **Change visibility**.
4. Đổi package thành **Public**.
5. Xác nhận việc đổi chế độ hiển thị.

Package container GHCR ở chế độ Public có thể được pull ẩn danh, nên người dùng cuối không cần tài khoản GitHub, PAT hay `docker login` chỉ để chạy image.

Sau khi đặt package Public, hãy kiểm tra ẩn danh bằng Docker client đã đăng xuất:

```bash
docker logout ghcr.io 2>/dev/null || true
docker pull ghcr.io/dangkhoa2016/json-api-server-with-dashboard-ui:latest
````

## Bước 6 — Chạy image

Để tương thích rộng rãi nhất trên các nền tảng, hãy ưu tiên `--env-file` thay cho cú pháp biến môi trường nội dòng phụ thuộc shell. Nó hoạt động nhất quán với Docker CLI trên Linux, macOS, Windows PowerShell, WSL và các môi trường phổ biến khác.

### Biến môi trường bắt buộc

| Biến             | Mục đích                                                                                             |
| ---------------- | ---------------------------------------------------------------------------------------------------- |
| `APP_SECRET`     | Bí mật ứng dụng dùng để ký phiên HMAC                                                                |
| `ADMIN_PASSWORD` | Mật khẩu đăng nhập admin (được hash bằng Argon2 khi seed lần đầu)                                    |
| `CORS_ORIGINS`   | Danh sách origin được phép, phân cách bằng dấu phẩy (bắt buộc ở production; wildcard `*` bị từ chối) |

### Biến môi trường tùy chọn

| Biến                                                                      | Mặc định               | Mục đích                                                               |
| ------------------------------------------------------------------------- | ---------------------- | ---------------------------------------------------------------------- |
| `ADMIN_USERNAME`                                                          | `admin`                | Tên đăng nhập admin                                                    |
| `DATABASE_URL`                                                            | `file:./data/local.db` | Chuỗi kết nối libSQL (file cục bộ hoặc Turso từ xa)                    |
| `PORT`                                                                    | `3000`                 | Cổng lắng nghe của server                                              |
| `SKIP_SEED`                                                               | `false`                | Đặt `true` để bỏ qua seed database khi khởi động lần đầu               |
| `REDIS_ENABLED`                                                           | `false`                | Bật rate limiting dùng Redis                                           |
| `REDIS_HOST` / `REDIS_PORT` / `REDIS_PASSWORD` / `REDIS_DB`               | —                      | Cấu hình kết nối Redis                                                 |
| `CACHE_ENABLED` / `CACHE_TTL_SECONDS`                                     | `false` / `300`        | Cache phản hồi tùy chọn                                                |
| `RATE_LIMIT_ENABLED` / `RATE_LIMIT_MAX_REQUESTS` / `RATE_LIMIT_WINDOW_MS` | —                      | Tinh chỉnh rate limit                                                  |
| `TRUSTED_PROXY_CIDRS`                                                     | —                      | Dải CIDR proxy tin cậy, phân cách bằng dấu phẩy, để xác định IP client |

### Tạo bí mật ứng dụng

Dùng OpenSSL trên máy chủ:

```bash
openssl rand -hex 64
```

Hoặc dùng chính image Node để máy chủ không cần OpenSSL:

```bash
docker run --rm node:26-alpine \
  node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Sao chép giá trị đã tạo vào tệp môi trường cục bộ **không commit** lên repository.

### Chạy với database SQLite cục bộ

Tạo `.env.production.local`:

```dotenv
APP_SECRET=replace-with-a-random-secret
ADMIN_USERNAME=admin
ADMIN_PASSWORD=change-me
CORS_ORIGINS=https://your-frontend.example.com
```

Chạy:

```bash
docker run -d \
  --name json-api-server \
  --env-file .env.production.local \
  -p 3000:3000 \
  -v json_api_storage:/app/data \
  ghcr.io/dangkhoa2016/json-api-server-with-dashboard-ui:latest
```

Các tệp database SQLite nằm trong `/app/data` bên trong container. Volume có tên giúp giữ dữ liệu qua các lần tạo lại container.

### Docker Compose

`docker-compose.yml` ở thư mục gốc repository ghi rõ hai tùy chọn: pull image đã build sẵn từ GitHub Packages hoặc build từ mã nguồn cục bộ.

### Kiểm tra

```bash
curl -s http://localhost:3000/api/health
```

Kết quả mong đợi: HTTP `200 OK`.

Sau đó đăng nhập dashboard bằng thông tin admin đã cấu hình.

## Khuyến nghị — Tự động xuất bản bằng GitHub Actions

Với repository GitHub công khai, GitHub Actions tốt hơn việc xuất bản thủ công từ máy phát triển. Workflow có thể dùng `GITHUB_TOKEN` với quyền `packages: write` thay vì lưu PAT cá nhân cho việc xuất bản thông thường của repository.

Mỗi push lên `main` (và mỗi lần chạy `workflow_dispatch` thủ công) đều xuất bản image `latest` đa nền tảng. Workflow:

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

Với workflow production dài hạn, hãy cân nhắc ghim các GitHub Actions của bên thứ ba vào toàn bộ commit SHA thay vì tag phiên bản. GitHub khuyến nghị điều này vì sự ổn định của chuỗi cung ứng.

Sau lần xuất bản đầu tiên của workflow, vẫn phải kiểm tra chế độ hiển thị package GHCR là **Public** nếu cần pull ẩn danh.

## Xử lý sự cố

- **`exec format error` trên máy ARM** — kiểm tra manifest GHCR. Tag có thể chỉ chứa `linux/amd64`; hãy xuất bản lại với cả `linux/amd64` và `linux/arm64`.
- **401 Unauthorized khi `docker pull`** — kiểm tra package GHCR đã thực sự Public. Package trong Container registry ở chế độ Public hỗ trợ pull ẩn danh.
- **Repository công khai hiển thị nhưng `docker pull` vẫn yêu cầu xác thực** — chế độ hiển thị của repository và package là hai khái niệm riêng biệt. Hãy kiểm tra cài đặt của chính package.
- **Build `arm64` chậm trên builder x86-64** — emulation QEMU chậm hơn builder ARM64 gốc. Điều này là bình thường.
- **Build chạy được trên `amd64` nhưng lỗi trên `arm64`** — hãy kiểm tra các native dependency, package OS và binary biên dịch sẵn. Base image đa kiến trúc không đảm bảo mọi dependency của ứng dụng (như `@node-rs/argon2`) hỗ trợ mọi kiến trúc.
- **Builder không liệt kê `linux/arm64`** — trên Linux Engine, cài binfmt/QEMU rồi chạy lại `docker buildx inspect --bootstrap`. Docker Desktop thường tự xử lý việc này.
- **Người dùng Windows không chạy được image như container Windows gốc** — dự án này xuất bản container Linux. Người dùng Windows nên chạy Docker Desktop/WSL2 ở chế độ container Linux.

## Tham khảo chính thức

- Docker multi-platform builds: https://docs.docker.com/build/building/multi-platform/
- Docker multi-platform GitHub Actions: https://docs.docker.com/build/ci/github-actions/multi-platform/
- GitHub Container registry: https://docs.github.com/packages/working-with-a-github-packages-registry/working-with-the-container-registry
- GitHub package permissions and visibility: https://docs.github.com/packages/learn-github-packages/about-permissions-for-github-packages
- GitHub Actions Docker publishing: https://docs.github.com/actions/guides/publishing-docker-images
- Node.js Docker official images: https://hub.docker.com/_/node
````
