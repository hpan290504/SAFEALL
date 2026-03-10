import * as db from '../_utils/db.js';
import { normalizePhone } from '../_utils/normalization.js';
import { verifyPin } from '../_utils/auth.js';

export default async function handler(req, res) {
    if (req.method !== 'POST') return res.status(405).json({ message: 'Method not allowed' });

    try {
        const { orderId, pin } = req.body;

        if (!orderId || !pin) {
            return res.status(400).json({ success: false, message: 'Vui lòng nhập Mã đơn hàng/SĐT và Mã PIN.' });
        }

        const input = orderId.trim();
        const normalizedPhone = normalizePhone(input);
        const isPhone = normalizedPhone.length >= 10;

        // 1. Find the user first to verify PIN
        let userQuery = isPhone
            ? 'SELECT * FROM users WHERE phone = $1 LIMIT 1'
            : 'SELECT u.* FROM users u JOIN orders o ON u.id = o.user_id WHERE o.short_id = $1 LIMIT 1';

        const userRes = await db.query(userQuery, [isPhone ? normalizedPhone : input.toUpperCase()]);

        if (userRes.rows.length === 0) {
            return res.status(404).json({ success: false, message: 'Không tìm thấy thông tin đơn hàng.' });
        }

        const user = userRes.rows[0];
        const isPinValid = await verifyPin(user, pin);

        if (!isPinValid) {
            return res.status(401).json({ success: false, message: 'Mã PIN tra cứu không chính xác.' });
        }

        // 2. Fetch orders for this user
        // We show either the specific order if it was a short_id, or all orders if it was a phone
        let orderQuery = `
            SELECT o.*, 
                   a.full_name, a.phone as customer_phone, a.email as customer_email, a.address_line,
                   (
                       SELECT json_agg(item)
                       FROM (
                           SELECT id, product_id, quantity, unit_price, total_price, title
                           FROM order_items
                           WHERE order_id = o.id
                       ) item
                   ) as items
            FROM orders o
            JOIN order_addresses a ON o.id = a.order_id
            WHERE o.user_id = $1
        `;
        let queryParams = [user.id];

        if (!isPhone) {
            orderQuery += ' AND o.short_id = $2';
            queryParams.push(input.toUpperCase());
        }

        orderQuery += ' ORDER BY o.created_at DESC';

        const ordersRes = await db.query(orderQuery, queryParams);

        if (ordersRes.rows.length === 0) {
            return res.status(200).json({ success: true, orders: [], message: 'Bạn chưa có đơn hàng nào.' });
        }

        const orders = ordersRes.rows.map(row => ({
            id: row.short_id,
            uuid: row.id,
            date: row.created_at,
            customer: {
                name: row.full_name,
                phone: row.customer_phone,
                email: row.customer_email,
                address: row.address_line
            },
            items: row.items || [],
            subtotal: parseFloat(row.subtotal),
            shippingFee: parseFloat(row.shipping_fee),
            total: parseFloat(row.total),
            paymentStatus: row.payment_status,
            fulfillmentStatus: row.fulfillment_status,
            paymentMethod: row.payment_method,
            note: row.customer_note
        }));

        // For frontend compatibility, if it's a single order search, we return 'order' too
        return res.status(200).json({
            success: true,
            orders,
            order: orders[0]
        });

    } catch (error) {
        console.error('[TrackOrder] ERROR:', error);
        return res.status(500).json({ success: false, message: 'Lỗi hệ thống khi tra cứu đơn hàng.' });
    }
}
