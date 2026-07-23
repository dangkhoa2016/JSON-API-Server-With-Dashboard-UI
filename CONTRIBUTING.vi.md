# Hướng dẫn Đóng góp cho JSON API Server

Cảm ơn bạn đã quan tâm đến việc đóng góp! Tài liệu này cung cấp các hướng dẫn và thông tin cho người đóng góp.

## Quy tắc Thông báo Commit

Dự án này sử dụng [Conventional Commits](https://www.conventionalcommits.org/) với [commitlint](https://commitlint.js.org/) để kiểm soát.

### Định dạng

```
<type>(<scope>): <description>

[optional body]

[optional footer(s)]
```

### Các loại Commit

| Loại | Mô tả | Ví dụ |
|------|-------|-------|
| `feat` | Tính năng mới | `feat(api): thêm xác thực người dùng` |
| `fix` | Sửa lỗi | `fix(frontend): sửa lỗi dark mode` |
| `docs` | Chỉ tài liệu | `docs: thêm tài liệu API endpoints` |
| `style` | Mã nguồn (định dạng, dấu chấm phẩy) | `style: format code với prettier` |
| `refactor` | Tái cấu trúc mã nguồn | `refactor(api): trích xuất auth middleware` |
| `perf` | Cải thiện hiệu suất | `perf(db): tối ưu hóa query` |
| `test` | Thêm/cập nhật test | `test(api): thêm test rate limiter` |
| `chore` | Thay đổi build/công cụ | `chore: cập nhật dependencies` |
| `ci` | Cấu hình CI | `ci: thêm GitHub Actions workflow` |
| `revert` | Hoàn tác commit trước | `revert: hoàn tác thay đổi auth` |

### Quy tắc

1. **Dòng chủ đề**: Sử dụng thể imperative, viết thường, không có dấu chấm, tối đa 72 ký tự
2. **Nội dung**: Sử dụng dấu đầu dòng với `- `, xuống dòng tại 100 ký tự
3. **Phạm vi**: Viết thường, ví dụ: `(api)`, `(frontend)`, `(db)`
4. **Thay đổi-breaking**: Thêm `BREAKING CHANGE:` trong footer

### Ví dụ

#### Đúng

```
feat(api): thêm endpoint xác thực người dùng

- Triển khai tạo token JWT
- Thêm mã hóa mật khẩu với bcrypt
- Bao gồm xoay vòng refresh token

Closes #123
```

```
fix(frontend): sửa lỗi dark mode không được lưu

- Lưu tùy chọn theme vào localStorage
- Áp dụng theme khi tải trang

Fixes #456
```

```
test(api): thêm test edge case cho rate limiter

- Test fallback in-memory khi Redis không khả dụng
- Ph coverage state transitions của circuit breaker
- Test edge case CIDR matching và IP normalization
```

#### Sai

```
Added new feature (thiếu type, không phải imperative)
```

```
fix stuff (quá mơ hồ)
```

```
FEAT(API): ADD USER AUTHENTICATION (viết hoa không được phép)
```

### Hướng dẫn Kích thước Commit

| Kích thước | Dòng | Khuyến nghị |
|------------|------|-------------|
| Nhỏ | <200 | Lý tưởng cho hầu hết các thay đổi |
| Trung bình | 200-500 | Chấp nhận cho tính năng có test |
| Lớn | >500 | Cân nhắc tách |
| Rất lớn | >1000 | Bắt buộc phải tách |

**Khi commit vượt quá 500 dòng, cân nhắc tách:**

1. Thay đổi triển khai trước
2. Cập nhật test trong commit riêng
3. Tài liệu trong commit khác

### Chạy Test trước Commit

```bash
# Chạy tất cả test
yarn test

# Chạy bộ test cụ thể
yarn test:api
yarn test:frontend

# Kiểm tra coverage
yarn test:coverage
```

### Pre-commit Hooks

Husky chạy tự động trước mỗi commit:
- ESLint để kiểm tra chất lượng code
- Prettier để định dạng
- Kiểm tra loại (type checking) với vue-tsc/tsc

## Quy trình Phát triển

### 1. Fork và Clone

```bash
git clone https://github.com/your-username/json-api-server-with-dashboard-ui.git
cd json-api-server-with-dashboard-ui
```

### 2. Cài đặt Dependencies

```bash
yarn install
```

### 3. Tạo Branch Tính năng

```bash
git checkout -b feat/ten-tinh-nang-cua-ban
```

### 4. Thực hiện thay đổi và Test

```bash
# Thực hiện thay đổi
yarn test  # Đảm bảo test pass
yarn lint  # Đảm bảo mã nguồn
```

### 5. Commit và Push

```bash
git add .
git commit -m "feat(scope): mô tả tính năng của bạn"
git push origin feat/ten-tinh-nang-cua-ban
```

### 6. Tạo Pull Request

- Cung cấp mô tả rõ ràng về các thay đổi
- Tham chiếu đến các issue liên quan
- Đảm bảo tất cả CI checks pass

## Phong cách Mã nguồn

- **TypeScript** cho tất cả mã backend
- **Vue 3 Composition API** cho frontend
- **Tailwind CSS** cho styling
- **ESLint + Prettier** cho định dạng

## Testing

- **Backend**: Vitest với mục tiêu coverage 100%
- **Frontend**: Vue Test Utils với jsdom
- **Integration**: Test SQLite + HTTP thực

## Câu hỏi?

Nếu bạn có câu hỏi, vui lòng mở issue hoặc liên hệ với các maintainers.
