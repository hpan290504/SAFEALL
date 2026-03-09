import * as db from '../_utils/db.js';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { normalizePhone } from '../_utils/normalization.js';


export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ message: 'Method not allowed' });
    }

    const authHeader = req.headers.authorization;
    let userId = null;

    if (authHeader && authHeader.startsWith('Bearer ')) {
        const token = authHeader.split(' ')[1];
        try {
            const decoded = jwt.verify(token, process.env.JWT_SECRET);
            userId = decoded.id === 'admin' ? null : decoded.id;
        } catch (e) {
            console.warn('[CreateOrder] Invalid optional token, proceeding as guest');
        }
    }

    try {
        const { orderId, items, subtotal, shippingFee, total, paymentMethod, note, customer, pin } = req.body;

        if (!customer || !customer.phone) {
            return res.status(400).json({ message: 'Customer phone is required' });
        }

        // Auto-link or Create User based on PIN
        if (!userId) {
            if (!pin || pin.length !== 6) {
                return res.status(400).json({ message: 'Vui lòng cung cấp mã PIN hợp lệ (6 số) để tra cứu đơn hàng.' });
            }

            const normalizedPhone = normalizePhone(customer.phone);
            const userCheck = await db.query('SELECT id, password FROM users WHERE phone = $1 OR phone = $2 LIMIT 1', [normalizedPhone, customer.phone]);

            if (userCheck.rows.length > 0) {
                // Return User: Verify PIN
                const user = userCheck.rows[0];
                const isMatch = await bcrypt.compare(pin, user.password);
                if (!isMatch) {
                    return res.status(401).json({ message: 'Mã PIN tra cứu không chính xác.' });
                }
                userId = user.id;
            } else {
                // New User: Create PIN (Hash)
                const salt = await bcrypt.genSalt(10);
                const hashedPin = await bcrypt.hash(pin, salt);

                const normalizedPhoneForUser = normalizePhone(customer.phone);
                const newUser = await db.query(
                    'INSERT INTO users (name, phone, password, role) VALUES ($1, $2, $3, $4) RETURNING id',
                    [customer.name, normalizedPhoneForUser, hashedPin, 'user']
                );

                userId = newUser.rows[0].id;
            }
        }

        // 1. Save order to PostgreSQL
        await db.query(
            `INSERT INTO orders (order_id, user_id, customer_name, customer_phone, customer_address, items, subtotal, shipping_fee, total, payment_method, note, status) 
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`,
            [
                orderId,
                userId,
                customer.name,
                normalizePhone(customer.phone),
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

        // 2. Synchronize address to user profile if logged in
        if (userId) {
            await db.query('UPDATE users SET address = $1 WHERE id = $2', [customer.address, userId]);
        }

        return res.status(201).json({ success: true, message: 'Order created successfully', orderId });
    } catch (error) {
        console.error('[CreateOrder] Error:', error);
        return res.status(500).json({ message: 'Internal server error', error: error.message });
    }
};
