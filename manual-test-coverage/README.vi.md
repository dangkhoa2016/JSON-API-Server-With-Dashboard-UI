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

# Thất bại khi có checkout lỗi, timeout, không có dữ liệu bất thường,
# lỗi thật, hoặc coverage không phục hồi trong cửa sổ quy định
bash manual-test-coverage/verify-commit-coverage.sh --strict

# Điều chỉnh số commit kề nhau để LOW phải phục hồi (mặc định 2)
bash manual-test-coverage/verify-commit-coverage.sh --max-recovery-commits 2

# Ghi đè timeout test từng commit (giây, mặc định 600)
bash manual-test-coverage/verify-commit-coverage.sh --timeout 600

# Chạy safety harness của verifier (fixture độc lập, không phải coverage thật)
yarn test:coverage-verifier
```

## Phân loại trạng thái

Ngưỡng áp dụng cho **cả bốn metric coverage** — statements, branches,
functions, và lines. Một commit chỉ là `PASS` khi mọi metric parse được đều đạt
ngưỡng; ngược lại là `LOW` và report liệt kê từng metric dưới ngưỡng (ví dụ
`LOW (Branches 60% < 80%)`).

- `PASS` — cả bốn metric đều đạt ngưỡng.
- `LOW` rồi `RECOVERED` — ít nhất một metric tụt dưới ngưỡng nhưng cả bốn metric
  đều phục hồi lên ngưỡng trong `--max-recovery-commits` commit kề nhau (được
  chấp nhận).
- `UNRECOVERED` — coverage vẫn dưới ngưỡng (nợ cần xử lý).
- `NO DATA` — một trong bốn metric bị thiếu, rỗng, hoặc không phải số, nên
  không thể tin cậy dòng coverage.
- `BOOTSTRAP` — commit ra đời trước file lockfile, nên không chạy test được
  (không phải lỗi ứng dụng).
- `NOT APPLICABLE` — commit không thay đổi mã có thể test (chỉ config, tài liệu,
  asset sinh ra hoặc tĩnh).
- `CHECKOUT FAIL`, `TIMEOUT`, `NO DATA`, `INSTALL FAIL`, `FAIL` — lỗi hạ tầng
  hoặc lỗi test thật. `--strict` khiến verifier thoát mã khác 0 với các
  trường hợp này.

Exit code khác 0 chỉ được xem là `LOW` phục hồi được khi **tất cả** điều sau
đúng: output xác nhận vi phạm ngưỡng coverage toàn cục (`does not meet global
threshold`), cả bốn metric parse thành công, và tóm tắt test chứng minh suite
đã pass — dòng `Test Files ... passed` / `Tests ... passed` dương và không có
failed tests, failed suites, hoặc unhandled errors. Lỗi test thật luôn là
`FAIL` nghiêm khắc, kể cả khi coverage cũng dưới ngưỡng, và không bao giờ bị
hạ xuống `LOW` hoặc `RECOVERED`. Quy tắc phục hồi coverage vì thế không bao giờ
che giấu lỗi test thực tế.

Chế độ dependency được ghi trong report: worktree lịch sử tái sử dụng
`node_modules` hiện tại (`reuse`) cho nhanh, hoặc cài với
`yarn install --immutable` khi bật `--install`. Nếu cài immutable thất bại,
commit được đánh dấu `INSTALL FAIL` và không bao giờ fallback sang cài
non-immutable. Lưu ý `reuse` phản ánh dependency của working tree hiện tại,
không phải snapshot độc lập của từng commit.

## Yêu cầu

- Node.js, yarn
- `vitest` với `--coverage` được cấu hình (dùng `@vitest/coverage-v8`)

## Kết quả

Mỗi commit được checkout, chạy test coverage, kết quả được ghi vào:

- `coverage-report.md` — bảng markdown với coverage % của từng commit
- `results/<index>-<hash>-<message>.log` — output đầy đủ của từng commit
