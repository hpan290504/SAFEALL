import * as db from '../_utils/db.js';
import { normalizePhone } from '../_utils/normalization.js';
import { verifyPin, hashPin } from '../_utils/auth.js';

/**
 * api/orders/create.js - FINAL STABILIZED VERSION
 */
export default async function handler(req, res) {
    if (req.method !== 'POST') return res.status(405).json({ message: 'Method not allowed' });

    const {
        orderId, items, subtotal, shippingFee, total,
        paymentMethod, note, customer, pin
    } = req.body;

    const phone = normalizePhone(customer.phone);
    let userId = null;
    let step = 'Initialization';

    try {
        // Log DB Host for confirmation
        const dbUrl = process.env.DATABASE_URL || '';
        const dbHost = dbUrl.split('@')[1]?.split('/')[0] || 'Unknown';
        console.log(`[CreateOrder] START | Order: ${orderId} | Phone: ${phone} | DB: ${dbHost}`);

        // 1. User Identification
        step = 'User Lookup';
        const userCheck = await db.query('SELECT * FROM users WHERE phone = $1 LIMIT 1', [phone]);

        if (userCheck.rows.length > 0) {
            const user = userCheck.rows[0];

            step = 'PIN Verification';
            const isMatch = await verifyPin(user, pin);
            if (!isMatch) {
                return res.status(401).json({
                    success: false,
                    message: 'Mã PIN không chính xác. Vui lòng nhập đúng PIN cũ của số điện thoại này.'
                });
            }
            userId = user.id;

            step = 'User Profile Sync';
            await db.query(
                `UPDATE users SET name = $1, email = $2, address = $3 WHERE id = $4`,
                [customer.name, customer.email || user.email, customer.address, userId]
            );
        } else {
            step = 'New User Creation';
            const hashedPin = await hashPin(pin);
            const newUser = await db.query(
                `INSERT INTO users (name, phone, email, address, track_pin_hash, role) 
                 VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`,
                [customer.name, phone, customer.email || null, customer.address, hashedPin, 'user']
            );
            userId = newUser.rows[0].id;
        }

        // 2. Order Insertion
        step = 'Order Insertion';
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

        console.log(`[CreateOrder] SUCCESS | Order ${orderId} created for User ${userId}`);
        return res.status(201).json({
            success: true,
            message: 'Đơn hàng tạo thành công!',
            orderId
        });

    } catch (error) {
        console.error(`[CreateOrder] FAILED at step [${step}] | Error:`, error.message);

        return res.status(500).json({
            success: false,
            message: 'Lỗi hệ thống khi tạo đơn hàng.',
            category: error.category || 'System Error',
            step: step,
            code: error.code || 'NO_CODE',
            error: error.message,
            rawError: JSON.stringify(error, Object.getOwnPropertyNames(error))
        });
    }
}
