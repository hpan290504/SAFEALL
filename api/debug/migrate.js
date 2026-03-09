import * as db from '../_utils/db.js';
import { normalizePhone } from '../_utils/normalization.js';

export default async function handler(req, res) {
    try {
        const results = {
            usersUpdated: 0,
            ordersUpdated: 0,
            errors: []
        };

        // 1. Normalize USERS table
        const users = await db.query('SELECT id, phone FROM users');
        for (const user of users.rows) {
            const normalized = normalizePhone(user.phone);
            if (normalized !== user.phone) {
                try {
                    await db.query('UPDATE users SET phone = $1 WHERE id = $2', [normalized, user.id]);
                    results.usersUpdated++;
                } catch (e) {
                    results.errors.push(`User ${user.id} update failed: ${e.message}`);
                }
            }
        }

        // 2. Normalize ORDERS table
        const orders = await db.query('SELECT id, customer_phone FROM orders');
        for (const order of orders.rows) {
            const normalized = normalizePhone(order.customer_phone);
            if (normalized !== order.customer_phone) {
                try {
                    await db.query('UPDATE orders SET customer_phone = $1 WHERE id = $2', [normalized, order.id]);
                    results.ordersUpdated++;
                } catch (e) {
                    results.errors.push(`Order ${order.id} update failed: ${e.message}`);
                }
            }
        }

        return res.status(200).json(results);
    } catch (error) {
        return res.status(500).json({ error: error.message });
    }
}
