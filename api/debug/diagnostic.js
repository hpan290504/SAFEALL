import * as db from '../_utils/db.js';
import bcrypt from 'bcryptjs';

export default async function handler(req, res) {
    try {
        const stats = {
            users: 0,
            orders: 0,
            nonHashedPins: 0,
            inconsistentPhoneFormats: 0,
            sampleUsers: [],
            sampleOrders: []
        };

        const usersResult = await db.query('SELECT phone, password FROM users');
        stats.users = usersResult.rows.length;
        usersResult.rows.forEach(u => {
            if (u.password && !u.password.startsWith('$2')) stats.nonHashedPins++;
            if (u.phone && (u.phone.includes(' ') || u.phone.includes('+') || u.phone.includes('.'))) stats.inconsistentPhoneFormats++;
        });
        stats.sampleUsers = usersResult.rows.slice(0, 5);

        const ordersResult = await db.query('SELECT order_id, customer_phone, user_id FROM orders ORDER BY created_at DESC');
        stats.orders = ordersResult.rows.length;
        stats.sampleOrders = ordersResult.rows.slice(0, 5);

        return res.status(200).json(stats);
    } catch (error) {
        return res.status(500).json({ error: error.message });
    }
}
