const db = require('../utils/db');
const jwt = require('jsonwebtoken');

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ message: 'Method not allowed' });
    }

    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ message: 'Unauthorized' });
    }

    const token = authHeader.split(' ')[1];

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        const { orderId, items, subtotal, shippingFee, total, paymentMethod, note, customer } = req.body;

        // Save order to PostgreSQL
        // Assuming orders table: id (SERIAL), order_id (TEXT UNIQUE), user_id (INT/NULL for guest), 
        // items (JSONB), total (DECIMAL), status (TEXT), created_at (TIMESTAMP)

        const userId = decoded.id === 'admin' ? null : decoded.id;

        await db.query(
            `INSERT INTO orders (order_id, user_id, customer_name, customer_phone, customer_address, items, subtotal, shipping_fee, total, payment_method, note, status) 
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`,
            [
                orderId,
                userId,
                customer.name,
                customer.phone,
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

        return res.status(201).json({ success: true, message: 'Order created successfully', orderId });
    } catch (error) {
        console.error('[CreateOrder] Error:', error);
        return res.status(500).json({ message: 'Internal server error', error: error.message });
    }
};
