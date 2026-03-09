import * as db from '../_utils/db.js';
import bcrypt from 'bcryptjs';
import { normalizePhone } from '../_utils/normalization.js';


export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ message: 'Method not allowed' });
    }

    try {
        const { query, pin } = req.body;
        if (!query || query.trim() === '') {
            return res.status(400).json({ message: 'Vui lòng nhập Mã đơn hàng hoặc Số điện thoại' });
        }
        if (!pin || pin.trim().length !== 6) {
            return res.status(400).json({ message: 'Vui lòng nhập mã PIN (6 số) để bảo mật tra cứu' });
        }

        const input = query.trim();
        const normalizedPhone = normalizePhone(input);
        const isOrderId = input.toUpperCase().startsWith('SA');

        console.log(`[TrackOrder] Input: "${input}" | Normalized: "${normalizedPhone}"`);

        let result;
        if (isOrderId) {
            result = await db.query(
                `SELECT * FROM orders WHERE order_id ILIKE $1 ORDER BY created_at DESC LIMIT 10`,
                [input]
            );
        } else {
            // Priority Search: Strict normalized, fallback to raw input matching
            result = await db.query(
                `SELECT * FROM orders WHERE customer_phone = $1 OR customer_phone = $2 OR customer_phone = $3 ORDER BY created_at DESC LIMIT 10`,
                [normalizedPhone, input, normalizedPhone.startsWith('0') ? '84' + normalizedPhone.substring(1) : normalizedPhone]
            );
        }


        if (result.rows.length === 0) {
            return res.status(404).json({ success: false, message: 'Không tìm thấy thông tin phù hợp, vui lòng kiểm tra lại.' });
        }

        // --- NEW SECURITY CHECK: Verify PIN using bcrypt ---
        const firstOrder = result.rows[0];
        const userId = firstOrder.user_id;
        const rawCustomerPhone = firstOrder.customer_phone;
        const normalizedCustomerPhone = normalizePhone(rawCustomerPhone);

        console.log(`[TrackOrder] Order found. Linked UserID: ${userId || 'GUEST'} | Order Phone: ${rawCustomerPhone}`);

        let userCheck;
        if (userId) {
            userCheck = await db.query('SELECT id, password, track_pin_hash, phone FROM users WHERE id = $1 LIMIT 1', [userId]);
        } else {
            // Robust fallback if user_id is missing (legacy orders)
            userCheck = await db.query('SELECT id, password, track_pin_hash, phone FROM users WHERE phone = $1 OR phone = $2 OR phone = $3 LIMIT 1',
                [normalizedCustomerPhone, rawCustomerPhone, normalizedCustomerPhone.startsWith('0') ? '84' + normalizedCustomerPhone.substring(1) : normalizedCustomerPhone]
            );
        }

        if (!userCheck || userCheck.rows.length === 0) {
            console.warn(`[TrackOrder] Verification FAIL: No matching user found for phone ${normalizedCustomerPhone}`);
            return res.status(401).json({ message: 'Thông tin tra cứu không chính xác. Hãy kiểm tra lại số điện thoại và mã PIN 6 số.' });
        }

        const user = userCheck.rows[0];
        const isMatch = await bcrypt.compare(pin, user.track_pin_hash || user.password);

        console.log(`[TrackOrder] User identified: ${user.id}. PIN Match: ${isMatch}`);

        if (!isMatch) {
            return res.status(401).json({ message: 'Thông tin tra cứu không chính xác. Hãy kiểm tra lại số điện thoại và mã PIN 6 số.' });
        }
        // --- END SECURITY CHECK ---

        const orders = result.rows.map(row => ({
            id: row.order_id,
            date: row.created_at,
            customer: {
                name: row.customer_name,
                phone: row.customer_phone,
                address: row.customer_address
            },
            items: typeof row.items === 'string' ? JSON.parse(row.items) : row.items,
            subtotal: row.subtotal,
            shippingFee: row.shipping_fee,
            total: row.total,
            status: row.status,
            paymentMethod: row.payment_method,
            note: row.note
        }));

        return res.status(200).json({ success: true, orders });
    } catch (error) {
        console.error('[TrackOrder] Error:', error);
        return res.status(500).json({ message: 'Lỗi máy chủ' });
    }
}
