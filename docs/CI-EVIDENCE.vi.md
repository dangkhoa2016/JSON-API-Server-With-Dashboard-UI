# Hướng dẫn về Bằng chứng CI

> 🌐 Language / Ngôn ngữ: [English](CI-EVIDENCE.md) | **Tiếng Việt**

> Vì sao và làm thế nào để đính kèm bằng chứng CI khi bạn mở pull request hoặc yêu cầu review.

## Mục đích

Kho lưu trữ này kiểm soát chất lượng thông qua GitHub Actions CI. Khi bạn mở PR hoặc
yêu cầu review, người review cần bằng chứng có thể kiểm chứng rằng pipeline CI thực
sự đã chạy và vượt qua cho đúng phiên bản đang được review.

Chạy test cục bộ và các báo cáo coverage được sinh ra không **tự chứng minh nguồn
gốc**: bất kỳ ai cũng có thể sinh chúng ở máy local. Bằng chứng CI gắn một commit cụ
thể với một workflow run được thực thi trên hạ tầng của GitHub.

## Vì sao Không Commit Link Artifact?

Job `test` tải lên các artifact coverage cho từng phiên bản Node (`coverage-report-22`,
`coverage-report-24`, `coverage-report-26`). Chúng hữu ích, nhưng link tải **không
bền vững**:

- `actions/upload-artifact` mặc định giữ artifact trong **90 ngày**.
- Mỗi link gắn với một run ID cụ thể và yêu cầu xác thực.

Commit link artifact nghĩa là sau ~3 tháng các link sẽ chết. Thay vào đó, hãy dùng
**workflow run URL** (trang GitHub cố định) cùng với **HEAD SHA** — cả hai đều bền
vững và kiểm chứng được ngay lập tức.

## Checklist Trước khi Submit

- [ ] Mọi kiểm tra cục bộ đều qua (`yarn check`, `yarn lint`, `yarn test`)
- [ ] CI workflow run cho nhánh của bạn xanh
- [ ] Ghi lại HEAD SHA
- [ ] Ghi lại workflow run URL
- [ ] Dán cả hai vào mô tả PR/review

### 1. Ghi lại HEAD SHA

```bash
git rev-parse HEAD
```

### 2. Mở trang workflow CI

```text
https://github.com/dangkhoa2016/JSON-API-Server-With-Dashboard-UI/actions/workflows/ci.yml
```

Mở run cho nhánh của bạn, xác nhận nó xanh, và sao chép run URL.

### 3. Dán cả hai vào mô tả

Dùng template hai dòng này ở đầu mô tả PR hoặc review:

```markdown
**CI:** [workflow run](workflow-run-url)
**HEAD SHA:** `<full-sha>`
```

Job `commit-policy` bên trong run sẽ đăng báo cáo coverage từng commit vào step summary
của nó (step "Post commit-policy summary"). Chỉ cho người review tới đó để xem coverage
từng commit, chính sách commit message, và kiểm tra kích thước commit.

## Các Job CI và Nơi Xem Kết Quả

| Job               | Mục đích                                                             | Nơi xem kết quả                                                                     |
| ----------------- | -------------------------------------------------------------------- | ----------------------------------------------------------------------------------- |
| `test`            | Ma trận trên Node 22/24/26: cài đặt, typecheck, lint, test coverage  | Job log; artifact coverage theo Node `coverage-report-<node>` (hết hạn sau 90 ngày) |
| `commit-policy`   | Commit message, kích thước commit, và khôi phục coverage từng commit | Step summary "Post commit-policy summary" trong job log                             |
| `container-smoke` | Build Docker + smoke test trong container                            | Job log                                                                             |
| `e2e`             | Playwright browser tests với server dùng Redis                       | Job log; artifact `playwright-report` khi thất bại                                  |

## Ghi chú

- Badge CI trong README là bằng chứng bền vững, luôn hiển thị rằng CI đạt trên `main`.
  Workflow run URL trong PR chứng minh điều đó cho nhánh cụ thể của bạn.
- Đừng commit link tải artifact — chúng hết hạn sau 90 ngày.
- Nếu một job CI thất bại, đừng submit review cho đến khi nó được sửa; nếu lỗi không
  liên quan đến thay đổi của bạn, hãy nói rõ và link run đang thất bại.
