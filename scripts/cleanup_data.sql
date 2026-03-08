-- SAFEALL Data Cleanup Script
-- Use this to clear all test data before final verification

-- 1. Wipe all orders
DELETE FROM orders;

-- 2. Wipe all users (except specific admin if you want to keep them, but cleaner to wipe all)
DELETE FROM users;

-- 3. Reset auto-incrementing IDs (optional but nice for clean logs)
ALTER SEQUENCE IF EXISTS orders_id_seq RESTART WITH 1;
ALTER SEQUENCE IF EXISTS users_id_seq RESTART WITH 1;

-- After running this, register a FRESH account on Device A.
