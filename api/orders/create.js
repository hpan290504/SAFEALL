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

        // 1. Identify or Create User
        const userCheck = await db.query('SELECT * FROM users WHERE phone = $1 LIMIT 1', [normalizedPhone]);

        if (userCheck.rows.length > 0) {
            // EXISTING USER: Must verify PIN
            const user = userCheck.rows[0];
            const isMatch = await verifyPin(user, pin);

            if (!isMatch) {
                return res.status(401).json({
                    message: 'Mã PIN không chính xác cho số điện thoại này. Nếu quên, hãy dùng chức năng Quên mã PIN.'
                });
            }
            userId = user.id;

            // Optional: Update email if provided
            if (customer.email && !user.email) {
                await db.query('UPDATE users SET email = $1 WHERE id = $2', [customer.email, userId]);
            }
        } else {
            // NEW USER: Create account with PIN
            if (!pin || pin.length !== 6) {
                return res.status(400).json({ message: 'Vui lòng cung cấp mã PIN 6 số để tạo tài khoản tra cứu.' });
            }

            const hashedPin = await hashPin(pin);
            const newUser = await db.query(
                'INSERT INTO users (name, phone, email, track_pin_hash, role) VALUES ($1, $2, $3, $4, $5) RETURNING id',
                [customer.name, normalizedPhone, customer.email || null, hashedPin, 'user']
            );
            userId = newUser.rows[0].id;
        }

        // 2. Save Order
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

        // 3. Update profile details
        await db.query('UPDATE users SET address = $1, name = $2 WHERE id = $3', [customer.address, customer.name, userId]);

        return res.status(201).json({ success: true, message: 'Đơn hàng đã được tạo thành công!', orderId });
    } catch (error) {
        console.error('[CreateOrder] Error:', error);
        return res.status(500).json({ message: 'Lỗi hệ thống khi tạo đơn hàng.', error: error.message });
    }
};
