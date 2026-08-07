# Release Check Scripts

> 🌐 Language / Ngôn ngữ: [English](README.md) | **Tiếng Việt**

Các script kiểm tra phát hành (release) trước khi triển khai cho dự án **JSON API Server With Dashboard UI**. Chúng chạy các bài kiểm tra hồi quy tự động chống lại một server đang chạy — có thể là server bạn tự khởi động, hoặc một container mới build từ Docker image của dự án.

---

## Nội dung thư mục

| Script                          | Mục đích                                                                                        |
| ------------------------------- | ----------------------------------------------------------------------------------------------- |
| `test-endpoints.sh`             | Bộ kiểm tra hồi quy API đầy đủ (REST, Admin API, tRPC, edge cases) chống lại server đang chạy. |
| `endpoint-regression-test.sh`   | Các kiểm tra endpoint hồi quy trọng điểm (health, tRPC, CRUD, admin) với tùy chọn test phá hủy. |
| `release-check-docker.sh`       | Điều phối: build Docker image, khởi động container với `.env` của dự án, chạy cả 2 script × 2 lần. |

---

## Yêu cầu

- **bash**, **curl**, **jq** (cả hai script test đều dùng `curl` và `jq`)
- **Docker** (chỉ cần cho `release-check-docker.sh`)
- File `.env` của dự án ở thư mục gốc, cung cấp `ADMIN_USERNAME` / `ADMIN_PASSWORD`
  (các script test tự động nạp thông tin admin từ `.env`; có thể ghi đè bằng biến môi trường
  `ADMIN_USER`/`ADMIN_PASS` hoặc `ADMIN_USERNAME`/`ADMIN_PASSWORD`).

> **Lưu ý:** rate limiting tự động bị tắt trong lúc chạy test và được khôi phục về giá trị ban đầu
> sau khi kết thúc, để các bộ test có nhiều request không bị giới hạn.

---

## Khởi động nhanh — luồng Docker đầy đủ

```bash
bash release-check-scripts/release-check-docker.sh
```

Script này thực hiện toàn bộ cổng kiểm tra phát hành:

1. **Build** image `json-api-server-with-dashboard-ui`.
2. **Chạy** một container với file `.env` của dự án được mount chỉ-đọc tại `/app/.env` và gắn vào
   port loopback động (`127.0.0.1::3000`), sau đó chờ `/api/health` (tối đa 60 giây).
3. **Test** — chạy `test-endpoints.sh` và `endpoint-regression-test.sh`, mỗi script **2 lần**, chống lại container.
4. **Dọn dẹp** — dừng và xóa container (giữ lại image).

Mã thoát là `0` khi mọi lần chạy đều pass, `1` nếu có bất kỳ lần chạy nào báo lỗi.

| Tùy chọn             | Mô tả                                                              | Mặc định                             |
| -------------------- | ------------------------------------------------------------------ | ------------------------------------ |
| `[ENV_FILE]`         | Đường dẫn file env được mount vào container.                       | `$PROJECT_DIR/.env`                  |
| `IMAGE_NAME` (env)   | Tên/tag Docker image để build và chạy.                             | `json-api-server-with-dashboard-ui`  |

Ví dụ với file env và tên image tùy chỉnh:

```bash
IMAGE_NAME=my-registry/app:1.0 bash release-check-scripts/release-check-docker.sh /path/to/.env
```

---

## Các script

### `test-endpoints.sh`

Bộ test hồi quy API đầy đủ dùng cho việc xác minh trước khi triển khai.

```bash
bash release-check-scripts/test-endpoints.sh [BASE_URL]
```

| Tham số     | Mặc định                                                          |
| ----------- | ----------------------------------------------------------------- |
| `BASE_URL`  | Biến môi trường `$TARGET_URL`, hoặc `http://localhost:3000` nếu trống |

**Phạm vi kiểm tra (6 suite, 60 checks):**

1. **System health & baseline metadata** — `/api/health`, `/api/counts`, `/api/feature-cards`.
2. **REST listings & query filtering** — phân trang, sắp xếp, tìm kiếm text, escape wildcard, tham số sai.
3. **CRUD lifecycle & payload validation** — tạo/đọc/cập nhật/xóa, JSON sai định dạng, giới hạn body 50 MB, xử lý 404/413.
4. **Admin REST auth & protected routes** — login, tái sử dụng token, 401 khi chưa xác thực, settings seed/reset.
5. **tRPC procedures & routers** — các route `ping`, `json.*`, `admin.*`.
6. **Router fallback & edge cases** — route không tồn tại trả về 404.

Thoát với mã `0` khi tất cả checks pass, `1` nếu có bất kỳ lỗi nào (kèm tóm tắt lỗi).

### `endpoint-regression-test.sh`

Các kiểm tra hồi quy endpoint, kèm chế độ admin-data phá hủy tùy chọn.

```bash
bash release-check-scripts/endpoint-regression-test.sh [--admin-data]
```

| Cờ           | Mô tả                                                                                          |
| ------------ | ---------------------------------------------------------------------------------------------- |
| `--admin-data`| Chạy thêm các kiểm tra phá hủy `POST /api/admin/data/seed` và `POST /api/admin/data/reset`.     |

| Biến môi trường | Mô tả                                        | Mặc định                      |
| --------------- | -------------------------------------------- | ----------------------------- |
| `BASE_URL`      | Base URL của server mục tiêu.                | `http://localhost:3000`       |
| `ADMIN_USERNAME`| Admin user cho các kiểm tra xác thực.        | giá trị từ `.env` hoặc `admin`|
| `ADMIN_PASSWORD`| Admin password cho các kiểm tra xác thực.    | giá trị từ `.env`             |

**Phạm vi kiểm tra (10 phần, ~100 checks, thêm 2 checks với `--admin-data`):**

1. Health · 2. tRPC · 3. Counts · 4. Feature cards · 5. Hình dạng danh sách resource
6. Get by id · 7. Tính năng query danh sách · 8. Xử lý lỗi · 9. Vòng đời CRUD
10. Admin (settings + auth) · 11. Admin data (seed/reset, chỉ khi có `--admin-data`)

Thoát với mã `0` khi tất cả checks pass, `1` nếu có bất kỳ lỗi nào.

---

## Vai trò trong pipeline phát hành

Chạy các script trực tiếp chống lại một server bạn đã khởi động (ví dụ `yarn start` hoặc dev server),
hoặc dùng `release-check-docker.sh` để xác thực chính Docker image trước khi deploy:

```bash
# Chống lại server đang chạy (ví dụ http://localhost:3000)
bash release-check-scripts/test-endpoints.sh
BASE_URL=http://localhost:3000 bash release-check-scripts/endpoint-regression-test.sh

# Xác thực Docker image đầy đủ (build + chạy + test 2 lần + dọn dẹp)
bash release-check-scripts/release-check-docker.sh
```

Các script thoát với mã khác 0 khi có bất kỳ hồi quy nào, phù hợp để nối vào CI hoặc cổng kiểm tra
trước khi triển khai.
