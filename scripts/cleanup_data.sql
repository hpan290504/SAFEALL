-- SAFEALL Data Cleanup Script (Absolute Wipe)
-- Note: Ensure `users.phone` has a UNIQUE constraint to prevent duplicate registrations.
-- Lệnh này sẽ xóa sạch user/order cũ để bạn test từ đầu 100%.

-- 1. Xóa sạch bảng và reset số thứ tự (ID)
TRUNCATE TABLE orders, users RESTART IDENTITY CASCADE;

-- 2. (Tùy chọn) Kiểm tra lại
-- SELECT count(*) FROM users;
-- SELECT count(*) FROM orders;

-- Sau khi chạy lệnh này, hãy thực hiện Đăng ký mới trên máy A và Đăng nhập trên máy B.
