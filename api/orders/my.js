import * as db from '../_utils/db.js';
import jwt from 'jsonwebtoken';

export default async function handler(req, res) {
    if (req.method !== 'GET') return res.status(405).json({ message: 'Method not allowed' });

    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ message: 'Unauthorized' });
    }

    const token = authHeader.split(' ')[1];

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);

        let queryText = `
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
            LEFT JOIN order_addresses a ON o.id = a.order_id
        `;

        let queryParams = [];

        if (decoded.role === 'admin') {
            queryText += ` ORDER BY o.created_at DESC`;
        } else {
            queryText += ` WHERE o.user_id = $1 ORDER BY o.created_at DESC`;
            queryParams.push(decoded.id);
        }

        const result = await db.query(queryText, queryParams);

        const orders = result.rows.map(row => ({
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

        return res.status(200).json({ success: true, orders });
    } catch (error) {
        console.error('[GetMyOrders] Error:', error);
        return res.status(500).json({ success: false, message: 'Lỗi máy chủ khi lấy danh sách đơn hàng.' });
    }
};
