import * as db from '../_utils/db.js';
import { normalizePhone } from '../_utils/normalization.js';
import { verifyPin, hashPin } from '../_utils/auth.js';

/**
 * api/orders/create.js - REWRITTEN
 * 
 * Logic:
 * 1. Normalize Phone.
 * 2. Check if user exists with this phone.
 * 3. BRANCH A (Existing): Verify PIN. If fail, return 401.
 * 4. BRANCH B (New): Hash PIN, Create User.
 * 5. Create Order linked to user.
 */
export default async function handler(req, res) {
    if (req.method !== 'POST') return res.status(405).json({ message: 'Method not allowed' });

    try {
        const {
            orderId, items, subtotal, shippingFee, total,
            paymentMethod, note, customer, pin
        } = req.body;

        // Basic validation
        if (!customer?.phone) return res.status(400).json({ message: 'Số điện thoại là bắt buộc' });
        if (!pin || pin.length !== 6) return res.status(400).json({ message: 'Mã PIN 6 số là bắt buộc' });

        const phone = normalizePhone(customer.phone);
        let userId = null;

        console.log(`[CreateOrder] Processing: ${phone} | Order: ${orderId}`);

        // 1. Identify User Status
        const userCheck = await db.query('SELECT * FROM users WHERE phone = $1 LIMIT 1', [phone]);

        if (userCheck.rows.length > 0) {
            // SCENARIO A: Existing User
            const user = userCheck.rows[0];
            const isMatch = await verifyPin(user, pin);

            if (!isMatch) {
                return res.status(401).json({
                    success: false,
                    message: 'Mã PIN không chính xác. Vui lòng nhập đúng PIN cũ của số điện thoại này.'
                });
            }
            userId = user.id;

            // Sync user info if changed
            await db.query(
                `UPDATE users SET name = $1, email = $2, address = $3 WHERE id = $4`,
                [customer.name, customer.email || user.email, customer.address, userId]
            );
        } else {
            // SCENARIO B: New User
            const hashedPin = await hashPin(pin);
            const newUser = await db.query(
                `INSERT INTO users (name, phone, email, address, track_pin_hash, role) 
                 VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`,
                [customer.name, phone, customer.email || null, customer.address, hashedPin, 'user']
            );
            userId = newUser.rows[0].id;
            console.log(`[CreateOrder] Account created for new user: ID=${userId}`);
        }

        // 2. Insert Order
        await db.query(
            `INSERT INTO orders (
                order_id, user_id, customer_name, customer_phone, 
                customer_email, customer_address, items, subtotal, 
                shipping_fee, total, payment_method, note, status
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)`,
            [
                orderId, userId, customer.name, phone,
                customer.email || null, customer.address,
                JSON.stringify(items), subtotal, shippingFee,
                total, paymentMethod, note, 'pending'
            ]
        );

        return res.status(201).json({
            success: true,
            message: 'Đơn hàng tạo thành công!',
            orderId
        });

    } catch (error) {
        console.error('[CreateOrder] CRITICAL ERROR:', error);

        // Attempt automated schema check if columns are missing
        if (error.code === '42703' || error.message.includes('column')) {
            console.log('[CreateOrder] Schema mismatch. Running emergency migration...');
            try {
                await db.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS track_pin_hash TEXT`);
                await db.query(`ALTER TABLE orders ADD COLUMN IF NOT EXISTS customer_email TEXT`);
                return res.status(500).json({
                    success: false,
                    message: 'Hệ thống vừa cập nhật cấu trúc dữ liệu. Vui lòng nhấn nút "Xác nhận đơn hàng" một lần nữa.',
                    retry: true
                });
            } catch (migErr) {
                console.error('[CreateOrder] Emergency migration failed:', migErr.message);
            }
        }

        return res.status(500).json({
            success: false,
            message: 'Lỗi hệ thống khi tạo đơn hàng.',
            error: error.message
        });
    }
}
