# Commit Coverage Verification Tool

> 🌐 Language / Ngôn ngữ: [English](README.md) | **Tiếng Việt**

Script tự động kiểm tra tỷ lệ test coverage của mỗi commit trong nhánh hiện tại.

## Cấu trúc

- `verify-commit-coverage.sh` — duyệt từng commit, chạy coverage, ghi report
- `verify-commit-coverage.test.sh` — fixture harness kiểm tra verifier trong kho lưu trữ tạm thời độc lập
- `coverage-report.md` — báo cáo markdown được tạo ra (đã gitignored)
- `results/` — log thô từng commit (đã gitignored)

## Ngữ nghĩa range

- **Không có tham số** — bao gồm mọi commit từ root đến `HEAD` (root-inclusive).
- **Explicit `BASE HEAD`** — dùng range `BASE..HEAD` theo chuẩn Git (base-exclusive).

## Sử dụng

```bash
# Kiểm tra tất cả commits, bao gồm root (mặc định)
bash manual-test-coverage/verify-commit-coverage.sh

# Kiểm tra BASE..HEAD (BASE bị loại trừ)
bash manual-test-coverage/verify-commit-coverage.sh <base-sha> <head-sha>

# Kiểm tra với threshold (mặc định 80%)
bash manual-test-coverage/verify-commit-coverage.sh --threshold 90

# Trỏ đến một project root khác
bash manual-test-coverage/verify-commit-coverage.sh --project-root /path/to/repo

# Inject lệnh test tùy chỉnh (mặc định: yarn test:coverage)
bash manual-test-coverage/verify-commit-coverage.sh --test-command "npm run coverage"

# Ghi report ra thư mục tùy chỉnh
bash manual-test-coverage/verify-commit-coverage.sh --output-dir /tmp/commit-coverage

# Bật cài đặt dependency (mặc định tắt để cách ly)
bash manual-test-coverage/verify-commit-coverage.sh --install

# Chạy safety harness của verifier (fixture độc lập, không phải coverage thật)
yarn test:coverage-verifier
```

## Yêu cầu

- Node.js, yarn
- `vitest` với `--coverage` được cấu hình (dùng `@vitest/coverage-v8`)

## Kết quả

Mỗi commit được checkout, chạy test coverage, kết quả được ghi vào:

- `coverage-report.md` — bảng markdown với coverage % của từng commit
- `results/<index>-<hash>-<message>.log` — output đầy đủ của từng commit
