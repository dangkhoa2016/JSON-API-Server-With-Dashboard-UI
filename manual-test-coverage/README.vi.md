# Commit Coverage Verification Tool

> 🌐 Language / Ngôn ngữ: [English](README.md) | **Tiếng Việt**

Script tự động kiểm tra tỷ lệ test coverage của mỗi commit trong nhánh hiện tại.

## Cấu trúc

- `verify-commit-coverage.sh` — duyệt từng commit, chạy `yarn test:coverage`, ghi report
- `coverage-report.md` — báo cáo markdown được tạo ra (đã gitignored)
- `results/` — log thô từng commit (đã gitignored)

## Sử dụng

```bash
# Kiểm tra tất cả commits từ root commit đến HEAD
bash manual-test-coverage/verify-commit-coverage.sh

# Kiểm tra với threshold (mặc định 80%)
bash manual-test-coverage/verify-commit-coverage.sh --threshold 90

# Kiểm tra trong khoảng commits cụ thể
bash manual-test-coverage/verify-commit-coverage.sh <base-sha> <head-sha>

# Kết hợp threshold với khoảng commits
bash manual-test-coverage/verify-commit-coverage.sh --threshold 85 <base-sha> <head-sha>
```

## Yêu cầu

- Node.js, yarn
- `vitest` với `--coverage` được cấu hình (dùng `@vitest/coverage-v8`)

## Kết quả

Mỗi commit được checkout, chạy test coverage, kết quả được ghi vào:

- `coverage-report.md` — bảng markdown với coverage % của từng commit
- `results/<index>-<hash>-<message>.log` — output đầy đủ của từng commit
