import * as db from '../_utils/db.js';
import { normalizePhone } from '../_utils/normalization.js';
import { verifyPin } from '../_utils/auth.js';

/**
 * api/orders/track.js - REWRITTEN
 * 
 * Logic:
 * 1. Receive query (Order ID or Phone) and PIN.
 * 2. If query is Phone: Normalize and find the user first.
 * 3. If query is Order ID: Find the order first, then find the associated user.
 * 4. Verify PIN against the correct user.
 * 5. Return orders if PIN matches.
 */
export default async function handler(req, res) {
    if (req.method !== 'POST') return res.status(405).json({ message: 'Method not allowed' });

    try {
        const { query: searchQuery, pin } = req.body;

        if (!searchQuery || searchQuery.trim() === '') {
            return res.status(400).json({ message: 'Vui lòng nhập Mã đơn hàng hoặc Số điện thoại' });
        }
        if (!pin || pin.trim().length !== 6) {
            return res.status(400).json({ message: 'Vui lòng nhập mã PIN (6 số) để bảo mật tra cứu' });
        }

        const input = searchQuery.trim();
        const normalizedPhone = normalizePhone(input);
        const isOrderId = input.toUpperCase().startsWith('SA');

        console.log(`[TrackOrder] Search: "${input}" | IsOrderID: ${isOrderId}`);

        let user = null;
        let orders = [];

        if (isOrderId) {
            // LOOKUP BY ORDER ID
            const orderResult = await db.query(
                `SELECT o.*, u.id as db_user_id FROM orders o 
                 LEFT JOIN users u ON o.user_id = u.id 
                 WHERE o.order_id ILIKE $1 LIMIT 1`,
                [input]
            );

            if (orderResult.rows.length === 0) {
                return res.status(404).json({ message: 'Không tìm thấy thông tin đơn hàng này.' });
            }

            const order = orderResult.rows[0];

            // Find user associated with this order
            if (order.user_id) {
                const userResult = await db.query('SELECT * FROM users WHERE id = $1', [order.user_id]);
                user = userResult.rows[0];
            } else {
                // Fallback: try lookup user by the phone on the order for legacy/guest
                const userResult = await db.query('SELECT * FROM users WHERE phone = $1', [normalizePhone(order.customer_phone)]);
                user = userResult.rows[0];
            }
            orders = [order];
        } else {
            // LOOKUP BY PHONE
            const userResult = await db.query('SELECT * FROM users WHERE phone = $1', [normalizedPhone]);
            if (userResult.rows.length === 0) {
                return res.status(404).json({ message: 'Số điện thoại này chưa có đơn hàng nào hoặc chưa đăng ký.' });
            }
            user = userResult.rows[0];

            const ordersResult = await db.query(
                `SELECT * FROM orders WHERE user_id = $1 OR customer_phone = $2 ORDER BY created_at DESC LIMIT 20`,
                [user.id, normalizedPhone]
            );
            orders = ordersResult.rows;
        }

        // VERIFY PIN
        if (!user) {
            return res.status(401).json({ message: 'Thông tin tài khoản không khớp. Vui lòng liên hệ hỗ trợ.' });
        }

        const isMatch = await verifyPin(user, pin);
        if (!isMatch) {
            return res.status(401).json({ message: 'Mã PIN không chính xác. Vui lòng thử lại.' });
        }

        // FORMAT RESULTS
        const formattedOrders = orders.map(row => ({
            id: row.order_id,
            date: row.created_at,
            customer: {
                name: row.customer_name,
                phone: row.customer_phone,
                address: row.customer_address
            },
            items: typeof row.items === 'string' ? JSON.parse(row.items) : row.items,
            subtotal: parseFloat(row.subtotal),
            shippingFee: parseFloat(row.shipping_fee),
            total: parseFloat(row.total),
            status: row.status,
            paymentMethod: row.payment_method,
            note: row.note
        }));

        return res.status(200).json({ success: true, orders: formattedOrders });

    } catch (error) {
        console.error('[TrackOrder] ERROR:', error);
        return res.status(500).json({ message: 'Lỗi hệ thống khi tra cứu đơn hàng.' });
    }
}
