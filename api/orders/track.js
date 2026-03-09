import * as db from '../_utils/db.js';
import { normalizePhone } from '../_utils/normalization.js';
import { verifyPin } from '../_utils/auth.js';

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ message: 'Method not allowed' });
    }

    try {
        const { query: searchQuery, pin } = req.body;
        if (!searchQuery || searchQuery.trim() === '') {
            return res.status(400).json({ message: 'Vui lòng nhập Mã đơn hàng hoặc Số điện thoại' });
        }
        if (!pin || pin.trim().length !== 6) {
            return res.status(400).json({ message: 'Vui lòng nhập mã PIN (6 số) để bảo mật tra cứu' });
        }

        const input = searchQuery.trim();
        const normalizedInput = normalizePhone(input);
        const isOrderId = input.toUpperCase().startsWith('SA');

        console.log(`[TrackOrder] Input: "${input}" | Normalized: "${normalizedInput}"`);

        let result;
        if (isOrderId) {
            result = await db.query(
                `SELECT * FROM orders WHERE order_id ILIKE $1 ORDER BY created_at DESC LIMIT 10`,
                [input]
            );
        } else {
            // Find orders by phone (strict lookup)
            result = await db.query(
                `SELECT * FROM orders WHERE customer_phone = $1 ORDER BY created_at DESC LIMIT 10`,
                [normalizedInput]
            );
        }

        if (result.rows.length === 0) {
            return res.status(404).json({ success: false, message: 'Không tìm thấy thông tin đơn hàng phù hợp.' });
        }

        // --- SECURITY VERIFICATION ---
        const firstOrder = result.rows[0];
        const userId = firstOrder.user_id;
        const customerPhone = firstOrder.customer_phone;

        let user;
        if (userId) {
            const userCheck = await db.query('SELECT * FROM users WHERE id = $1 LIMIT 1', [userId]);
            user = userCheck.rows[0];
        } else {
            // Fallback for guest/legacy orders: lookup user by the phone on the order
            const userCheck = await db.query('SELECT * FROM users WHERE phone = $1 LIMIT 1', [normalizePhone(customerPhone)]);
            user = userCheck.rows[0];
        }

        if (!user) {
            console.warn(`[TrackOrder] No user record found for order link. Access denied.`);
            return res.status(401).json({ message: 'Thông tin xác thực không khả dụng. Vui lòng liên hệ hỗ trợ.' });
        }

        const isMatch = await verifyPin(user, pin);
        if (!isMatch) {
            return res.status(401).json({ message: 'Mã PIN tra cứu không chính xác. Vui lòng thử lại.' });
        }
        // --- END SECURITY VERIFICATION ---

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
        return res.status(500).json({ message: 'Lỗi hệ thống khi tra cứu đơn hàng.' });
    }
}
