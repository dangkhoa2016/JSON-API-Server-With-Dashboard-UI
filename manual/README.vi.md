# Kiểm thử thủ công (Manual Testing)

> 🌐 Language / Ngôn ngữ: [English](README.md) | **Tiếng Việt**

Script curl dùng để kiểm tra thủ công API trên cả **REST** lẫn **tRPC**.

## Cấu trúc

| Đường dẫn      | Mô tả                                                            |
|----------------|------------------------------------------------------------------|
| `run-all.sh`   | Chạy lần lượt tất cả script trong `rest/` rồi đến `trpc/`        |
| `rest/*.sh`    | Mỗi script cho một resource/vùng, gọi REST API (`/api/...`)      |
| `trpc/*.sh`    | Coverage tương tự, gọi tRPC API (`/api/trpc/...`)                 |
| `output/`      | File log do `run-all.sh` tạo ra (tự tạo, bị git-ignore)          |

## Điều kiện tiên quyết

Khởi động API server trước để nó lắng nghe tại `http://localhost:3000`.

## Chạy toàn bộ

```bash
bash manual/run-all.sh
```

Output được in ra màn hình và ghi vào `manual/output/run-<timestamp>.log`.

## Chạy từng script

```bash
bash manual/rest/posts.sh    # chỉ REST
bash manual/trpc/posts.sh    # chỉ tRPC
```

## Trỏ tới server khác

Các script mặc định dùng `http://localhost:3000`. Có thể ghi đè bằng biến môi trường `BASE_URL`:

```bash
BASE_URL=http://localhost:8080 bash manual/run-all.sh
```

## Script admin / cần xác thực

`rest/admin.sh` và `trpc/admin.sh` cover các endpoint admin cần token:

1. Chạy script và copy token trả về từ lệnh login.
2. Thay `export TOKEN="..."` trong script.
3. Chạy lại script; các lệnh cần xác thực sẽ dùng token.

## Đặc thù tRPC

- Query procedure dùng `GET`; mutation dùng `POST`.
- Input được serialize bằng [superjson](https://superjson.org): `?input={"json":{...}}` cho GET, body `{"json":{...}}` cho POST.

## Danh sách script

| Script       | Nội dung                                                       |
|--------------|----------------------------------------------------------------|
| `admin.sh`   | Login, settings (list/get/update/reset), seed và reset dữ liệu |
| `albums.sh`  | CRUD + lọc theo `userId`                                       |
| `comments.sh`| CRUD + lọc theo `postId` + tìm kiếm full-text                  |
| `photos.sh`  | CRUD + lọc theo `albumId`                                      |
| `posts.sh`   | CRUD + phân trang + lọc + tìm kiếm full-text + sắp xếp         |
| `todos.sh`   | CRUD + lọc theo `userId` / `completed`                         |
| `users.sh`   | CRUD + lọc + tìm kiếm wildcard + full-text + sắp xếp           |
