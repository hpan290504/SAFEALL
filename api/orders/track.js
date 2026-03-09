import * as db from '../_utils/db.js';

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ message: 'Method not allowed' });
    }

    try {
        const { query } = req.body;
        if (!query || query.trim() === '') {
            return res.status(400).json({ message: 'Vui lòng nhập Mã đơn hàng hoặc Số điện thoại' });
        }

        const searchTerm = query.trim();

        // Check if length suggests phone number (e.g. 10 digits) vs OrderID (e.g. SAXXXXXX)
        // We will just search both:
        const result = await db.query(
            `SELECT * FROM orders 
             WHERE order_id ILIKE $1 OR customer_phone = $1 
             ORDER BY created_at DESC LIMIT 10`,
            [searchTerm]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ success: false, message: 'Không tìm thấy đơn hàng' });
        }

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
