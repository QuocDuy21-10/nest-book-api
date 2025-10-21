# Hướng Dẫn Khởi Tạo MongoDB Replica Set với Docker Compose

## Bước 1: Tạo `keyfile`

MongoDB yêu cầu một keyfile để xác thực giữa các node trong một Replica Set.

```bash
# Tạo file keyfile với chuỗi ngẫu nhiên
openssl rand -base64 756 > mongo-keyfile

# Thiết lập quyền truy cập đúng (MongoDB yêu cầu 400 hoặc 600)
chmod 400 mongo-keyfile
```

## Bước 2: Dừng và xóa các container cũ (nếu có)

```bash
docker compose down -v
```

## Bước 3: Khởi động MongoDB

```bash
docker compose up -d mongodb
```

## Bước 4: Kiểm tra log MongoDB

```bash
docker compose logs mongodb
```

## Bước 5: Khởi tạo Replica Set

```bash
# Truy cập Mongo Shell
docker exec -it nest-mongodb mongosh -u root -p 123456 --authenticationDatabase admin

```

```bash
# Khởi tạo Replica Set
rs.initiate({
  _id: "rs0",
  members: [{ _id: 0, host: "mongodb:27017" }]
})

# Kiểm tra trạng thái Replica Set
rs.status()

# Thoát shell
exit

```

## Bước 6: Khởi động toàn bộ các dịch vụ khác

```bash
docker-compose up -d
```
