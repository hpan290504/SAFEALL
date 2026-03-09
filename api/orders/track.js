import * as db from '../_utils/db.js';
import bcrypt from 'bcryptjs';

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
        const normalizedPhone = input.replace(/\D/g, ''); // Keep only digits
        const isOrderId = input.toUpperCase().startsWith('SA');

        let result;
        if (isOrderId) {
            result = await db.query(
                `SELECT * FROM orders WHERE order_id ILIKE $1 ORDER BY created_at DESC LIMIT 10`,
                [input]
            );
        } else {
            // Search by normalized phone or exact entered string
            result = await db.query(
                `SELECT * FROM orders WHERE customer_phone = $1 OR customer_phone = $2 ORDER BY created_at DESC LIMIT 10`,
                [normalizedPhone, input]
            );
        }

        if (result.rows.length === 0) {
            return res.status(404).json({ success: false, message: 'Không tìm thấy thông tin phù hợp, vui lòng kiểm tra lại.' });
        }

        // --- NEW SECURITY CHECK: Verify PIN using bcrypt ---
        const firstOrder = result.rows[0];
        const userId = firstOrder.user_id;
        const rawCustomerPhone = firstOrder.customer_phone;
        const normalizedCustomerPhone = rawCustomerPhone ? rawCustomerPhone.replace(/\D/g, '') : '';

        let userCheck;
        if (userId) {
            // Priority 1: Search by user_id linked to the order
            userCheck = await db.query('SELECT id, password FROM users WHERE id = $1 LIMIT 1', [userId]);
        } else {
            // Priority 2: Fallback to phone search for legacy/unlinked orders
            userCheck = await db.query('SELECT id, password FROM users WHERE phone = $1 OR phone = $2 LIMIT 1', [normalizedCustomerPhone, rawCustomerPhone]);
        }

        if (!userCheck || userCheck.rows.length === 0) {
            return res.status(401).json({ message: 'Không tìm thấy thông tin xác thực. Vui lòng liên hệ Hotline.' });
        }

        const user = userCheck.rows[0];
        const isMatch = await bcrypt.compare(pin, user.password);
        if (!isMatch) {
            return res.status(401).json({ message: 'Mã PIN không chính xác' });
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
