const db = require('../utils/db');
const jwt = require('jsonwebtoken');

module.exports = async (req, res) => {
    if (req.method !== 'GET') {
        return res.status(405).json({ message: 'Method not allowed' });
    }

    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ message: 'Unauthorized' });
    }

    const token = authHeader.split(' ')[1];

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);

        let result;
        if (decoded.role === 'admin') {
            // Admin sees all orders
            result = await db.query('SELECT * FROM orders ORDER BY created_at DESC');
        } else {
            // User sees their own orders
            result = await db.query('SELECT * FROM orders WHERE user_id = $1 ORDER BY created_at DESC', [decoded.id]);
        }

        // Map database fields to frontend camelCase if necessary
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
        console.error('[GetMyOrders] Error:', error);
        return res.status(500).json({ message: 'Internal server error' });
    }
};
