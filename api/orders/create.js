import * as db from '../_utils/db.js';
import jwt from 'jsonwebtoken';
import { normalizePhone } from '../_utils/normalization.js';
import { verifyPin, hashPin } from '../_utils/auth.js';

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ message: 'Method not allowed' });
    }

    try {
        const { orderId, items, subtotal, shippingFee, total, paymentMethod, note, customer, pin } = req.body;

        if (!customer || !customer.phone) {
            return res.status(400).json({ message: 'Số điện thoại là bắt buộc' });
        }

        const normalizedPhone = normalizePhone(customer.phone);
        let userId = null;

        console.log(`[CreateOrder] Start: OrderID=${orderId}, Phone=${normalizedPhone}`);

        // 1. Identify or Create User
        console.log(`[CreateOrder] Stage 1: Identifying user...`);
        let userCheck;
        try {
            userCheck = await db.query('SELECT * FROM users WHERE phone = $1 LIMIT 1', [normalizedPhone]);
        } catch (dbErr) {
            console.error('[CreateOrder] Stage 1 FAIL (User Lookup):', dbErr.message);
            throw new Error(`Lỗi tìm kiếm người dùng: ${dbErr.message}`);
        }

        if (userCheck.rows.length > 0) {
            // EXISTING USER: Must verify PIN
            const user = userCheck.rows[0];
            console.log(`[CreateOrder] Existing User Found: ID=${user.id}`);

            const isMatch = await verifyPin(user, pin);
            if (!isMatch) {
                return res.status(401).json({
                    message: 'Mã PIN không chính xác cho số điện thoại này. Nếu quên, hãy dùng chức năng Quên mã PIN.'
                });
            }
            userId = user.id;

            // Optional: Update email if provided
            if (customer.email && !user.email) {
                console.log(`[CreateOrder] Updating email for user ${userId}...`);
                try {
                    await db.query('UPDATE users SET email = $1 WHERE id = $2', [customer.email, userId]);
                } catch (emailErr) {
                    console.warn('[CreateOrder] Email update failed (non-critical):', emailErr.message);
                    // Continue anyway, email might be missing in schema
                }
            }
        } else {
            // NEW USER: Create account with PIN
            console.log(`[CreateOrder] Stage 1b: Creating NEW user...`);
            if (!pin || pin.length !== 6) {
                return res.status(400).json({ message: 'Vui lòng cung cấp mã PIN 6 số để tạo tài khoản tra cứu.' });
            }

            const hashedPin = await hashPin(pin);
            try {
                const newUser = await db.query(
                    'INSERT INTO users (name, phone, email, track_pin_hash, role) VALUES ($1, $2, $3, $4, $5) RETURNING id',
                    [customer.name, normalizedPhone, customer.email || null, hashedPin, 'user']
                );
                userId = newUser.rows[0].id;
                console.log(`[CreateOrder] New User Created: ID=${userId}`);
            } catch (createErr) {
                console.error('[CreateOrder] Stage 1b FAIL (User Insert):', createErr.message);
                throw new Error(`Lỗi tạo tài khoản: ${createErr.message}. Có thể schema DB chưa cập nhật cột track_pin_hash.`);
            }
        }

        // 2. Save Order
        console.log(`[CreateOrder] Stage 2: Saving order...`);
        try {
            await db.query(
                `INSERT INTO orders (order_id, user_id, customer_name, customer_phone, customer_address, items, subtotal, shipping_fee, total, payment_method, note, status) 
                 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`,
                [
                    orderId,
                    userId,
                    customer.name,
                    normalizedPhone,
                    customer.address,
                    JSON.stringify(items),
                    subtotal,
                    shippingFee,
                    total,
                    paymentMethod,
                    note,
                    'pending'
                ]
            );
            console.log(`[CreateOrder] Order Saved Successfully.`);
        } catch (orderErr) {
            console.error('[CreateOrder] Stage 2 FAIL (Order Insert):', orderErr.message);
            throw new Error(`Lỗi lưu đơn hàng: ${orderErr.message}`);
        }

        // 3. Update profile details
        console.log(`[CreateOrder] Stage 3: Syncing profile address...`);
        try {
            await db.query('UPDATE users SET address = $1, name = $2 WHERE id = $3', [customer.address, customer.name, userId]);
        } catch (addrErr) {
            console.warn('[CreateOrder] Profile sync failed (non-critical):', addrErr.message);
        }

        return res.status(201).json({ success: true, message: 'Đơn hàng đã được tạo thành công!', orderId });
    } catch (error) {
        console.error('[CreateOrder] Final Catch:', error.message);

        // SELF-HEALING: If error is about missing columns, attempt auto-fix once
        if (error.code === '42703' && (error.message.includes('track_pin_hash') || error.message.includes('email'))) {
            console.log('[CreateOrder] Detected missing columns. Attempting auto-migration...');
            try {
                await db.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS email TEXT`);
                await db.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS track_pin_hash TEXT`);
                await db.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS reset_token TEXT`);
                await db.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS reset_token_expiry TIMESTAMP`);
                console.log('[CreateOrder] Auto-migration successful. Please retry your order.');
                return res.status(500).json({
                    message: 'Hệ thống vừa cập nhật dữ liệu để tương thích. Vui lòng nhấn "Xác nhận đơn hàng" một lần nữa.',
                    retry: true
                });
            } catch (migErr) {
                console.error('[CreateOrder] Auto-migration failed:', migErr.message);
            }
        }

        return res.status(500).json({
            message: 'Lỗi hệ thống khi tạo đơn hàng.',
            error: error.message,
            category: error.category || 'Unknown',
            tip: error.message.includes('track_pin_hash') ? 'Vui lòng chạy migration để thêm cột track_pin_hash vào bảng users.' : 'Vui lòng kiểm tra lại thông tin hoặc liên hệ admin.'
        });
    }
};
