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

## Bước 4: Xem nhật ký

```bash
docker compose logs -f mongodb
```

## Bước 5: Khởi tạo bộ bản sao

```bash
docker exec -it nest-mongodb mongosh -u root -p 123456 --authenticationDatabase admin
Trong mongosh:
rs.initiate({
  _id: "rs0",
  members: [{ _id: 0, host: "mongodb:27017" }]
})

// Kiểm tra
rs.status()

// Thoát
exit

```

## Bước 6: Khởi động toàn bộ

```bash
docker compose up -d
```

<!--
## Bước 4: Kiểm tra log của container `mongo-setup`

```bash
docker compose logs mongo-setup
```

## Bước 5: Kiểm tra replica set

```bash
# Truy cập Mongo Shell
docker exec -it nest-mongodb mongosh -u root -p 123456 --authenticationDatabase admin --eval "rs.status()"

``` -->
