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

## Bước 3: Start tất cả - replica set sẽ tự động init

```bash
docker-compose up -d
```

## Bước 4: Kiểm tra log của container `mongo-setup`

```bash
docker-compose logs mongo-setup
```

## Bước 5: Kiểm tra replica set

```bash
# Truy cập Mongo Shell
docker exec -it nest-mongodb mongosh -u root -p 123456 --authenticationDatabase admin --eval "rs.status()"

```
