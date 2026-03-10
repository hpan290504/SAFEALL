import * as db from '../_utils/db.js';
import jwt from 'jsonwebtoken';

/**
 * api/orders/status.js - Admin Status Update
 * 
 * Logic:
 * 1. Verify admin role.
 * 2. Update payment_status, fulfillment_status, or both.
 * 3. Update shipping/tracking info if provided.
 */
export default async function handler(req, res) {
    if (req.method !== 'PATCH') return res.status(405).json({ message: 'Method not allowed' });

    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ message: 'Unauthorized' });
    }

    const token = authHeader.split(' ')[1];

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        if (decoded.role !== 'admin') {
            return res.status(403).json({ success: false, message: 'Bạn không có quyền thực hiện thao tác này.' });
        }

        const { id, paymentStatus, fulfillmentStatus, trackingNumber, carrier } = req.body;

        if (!id) return res.status(400).json({ success: false, message: 'Thiếu ID đơn hàng.' });

        const client = await db.getClient();
        try {
            await client.query('BEGIN');

            const updates = [];
            const params = [];
            let i = 1;

            if (paymentStatus) {
                updates.push(`payment_status = $${i++}`);
                params.push(paymentStatus);
            }
            if (fulfillmentStatus) {
                updates.push(`fulfillment_status = $${i++}`);
                params.push(fulfillmentStatus);
            }

            if (updates.length > 0) {
                params.push(id);
                await client.query(
                    `UPDATE orders SET ${updates.join(', ')}, updated_at = CURRENT_TIMESTAMP WHERE id = $${i} OR short_id = $${i}`,
                    params
                );
            }

            // Handle Tracking / Shipment
            if (trackingNumber || carrier) {
                // Check if shipment exists
                const shipCheck = await client.query('SELECT id FROM shipments WHERE order_id = $1', [id]);
                if (shipCheck.rows.length > 0) {
                    await client.query(
                        `UPDATE shipments SET tracking_number = COALESCE($1, tracking_number), carrier = COALESCE($2, carrier) WHERE order_id = $3`,
                        [trackingNumber, carrier, id]
                    );
                } else {
                    await client.query(
                        `INSERT INTO shipments (order_id, tracking_number, carrier, status) VALUES ($1, $2, $3, 'pending')`,
                        [id, trackingNumber, carrier]
                    );
                }
            }

            await client.query('COMMIT');
            return res.status(200).json({ success: true, message: 'Cập nhật trạng thái thành công.' });

        } catch (e) {
            await client.query('ROLLBACK');
            throw e;
        } finally {
            client.release();
        }

    } catch (error) {
        console.error('[UpdateStatus] ERROR:', error);
        return res.status(500).json({ success: false, message: 'Lỗi hệ thống khi cập nhật trạng thái.' });
    }
}
