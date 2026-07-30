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
2. **Nội dung**: Bắt buộc (sử dụng dấu đầu dòng với `- `, xuống dòng tại 100 ký tự). Commit merge và revert được miễn trừ.
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

### Kích thước Commit

Các thay đổi đã stage (staged) được kiểm tra bởi hook pre-commit. CI kiểm tra từng commit riêng lẻ trong PR.

| Tổng số dòng +/- | Hành động |
|------------------|-----------|
| >600 | Cảnh báo |
| >1000 | Hook chặn commit với lỗi |

Bộ kiểm tra sử dụng `git diff --cached --numstat` trên máy local và `git diff <commit>^ <commit> --numstat` trong CI, tính tổng cả thêm và xóa. Các tệp lock, minified, snapshot, migration và binary được miễn trừ.

**Khi commit vượt quá 500 dòng, cân nhắc tách:**

1. Thay đổi triển khai trước
2. Cập nhật test trong commit riêng
3. Tài liệu trong commit khác

### Hướng dẫn Thứ tự Commit

Tuân thủ thứ tự kiến trúc lớp (layered architecture):

```
Hạ tầng → Cơ sở dữ liệu → Nhân API → Tính năng API → Tích hợp API
→ Vỏ Frontend → Thành phần Frontend → Trang Frontend
→ Công cụ → Tài liệu
```

**Quy tắc:** Commit các phụ thuộc trước các thứ phụ thuộc vào nó. Ví dụ: Schema DB trước API handlers.

### Mẫu Feature → Test

Mẫu chấp nhận được để tách các thay đổi lớn:

1. `feat(scope): thêm triển khai tính năng` — chỉ code
2. `test(scope): thêm test cho tính năng` — test cho tính năng đó

**Lưu ý:**
- Commit tính năng có thể có coverage thấp tạm thời
- Commit test đưa coverage trở lại 100%
- Cả hai commit cùng nhau phải đạt ngưỡng coverage

### Các tệp Tự động tạo

- Commit `yarn.lock` / `package-lock.json` cùng với `package.json`
- Không commit các tệp tự động tạo riêng lẻ
- Không review các tệp tự động tạo trong PR

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
