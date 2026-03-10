import * as db from './_utils/db.js';
import { normalizePhone } from './_utils/normalization.js';
import { verifyPin, hashPin } from './_utils/auth.js';
import crypto from 'crypto';
import jwt from 'jsonwebtoken';

export default async function handler(req, res) {
    const { pathname } = new URL(req.url, `http://${req.headers.host}`);
    const action = pathname.split('/').pop();

    try {
        if (action === 'create') return await handleCreate(req, res);
        if (action === 'my') return await handleMy(req, res);
        if (action === 'status') return await handleStatus(req, res);
        if (action === 'track') return await handleTrack(req, res);

        return res.status(404).json({ message: 'Order action not found' });
    } catch (error) {
        console.error(`[Orders] Error in ${action}:`, error);
        return res.status(500).json({ message: 'Internal Server Error', error: error.message });
    }
}

async function handleCreate(req, res) {
    if (req.method !== 'POST') return res.status(405).json({ message: 'Method not allowed' });
    const { items, subtotal, shippingFee, total, paymentMethod, note, customer, pin, clientToken } = req.body;
    if (!items?.length || !customer?.phone || !pin) return res.status(400).json({ message: 'Thiếu thông tin bắt buộc.' });

    const phone = normalizePhone(customer.phone);
    const client = await db.getClient();
    try {
        await client.query('BEGIN');

        // Idempotency check
        if (clientToken) {
            const existing = await client.query('SELECT short_id FROM orders WHERE client_token = $1', [clientToken]);
            if (existing.rows.length > 0) {
                await client.query('ROLLBACK');
                return res.status(200).json({ success: true, orderId: existing.rows[0].short_id, message: 'Re-delivered existing order.' });
            }
        }

        let userId;
        const userRes = await client.query('SELECT * FROM users WHERE phone = $1 LIMIT 1', [phone]);
        if (userRes.rows.length > 0) {
            if (!(await verifyPin(userRes.rows[0], pin))) throw new Error('Sai mã PIN.');
            userId = userRes.rows[0].id;
        } else {
            const hashedPin = await hashPin(pin);
            const newUser = await client.query('INSERT INTO users (name, phone, password, track_pin_hash) VALUES ($1, $2, $3, $4) RETURNING id', [customer.name, phone, hashedPin, hashedPin]);
            userId = newUser.rows[0].id;
        }

        const shortId = `SA-${crypto.randomBytes(3).toString('hex').toUpperCase()}`;
        const orderRes = await client.query(
            'INSERT INTO orders (short_id, client_token, user_id, subtotal, shipping_fee, total, payment_method) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id',
            [shortId, clientToken, userId, subtotal, shippingFee, total, paymentMethod]
        );
        const orderId = orderRes.rows[0].id;

        for (const item of items) {
            await client.query('INSERT INTO order_items (order_id, product_id, quantity, unit_price, total_price, title) VALUES ($1, $2, $3, $4, $5, $6)', [orderId, item.id, item.qty, item.price, item.total, item.title]);
        }
        await client.query('INSERT INTO order_addresses (order_id, full_name, phone, email, address_line) VALUES ($1, $2, $3, $4, $5)', [orderId, customer.name, phone, customer.email, customer.address]);

        await client.query('COMMIT');
        return res.status(201).json({ success: true, orderId: shortId });
    } catch (e) {
        await client.query('ROLLBACK');
        return res.status(e.message === 'Sai mã PIN.' ? 401 : 500).json({ message: e.message });
    } finally {
        client.release();
    }
}

async function handleMy(req, res) {
    const authHeader = req.headers.authorization;
    if (!authHeader) return res.status(401).json({ message: 'Unauthorized' });
    const decoded = jwt.verify(authHeader.split(' ')[1], process.env.JWT_SECRET);

    let queryText = `SELECT o.*, a.full_name, a.phone, a.address_line, (SELECT json_agg(i) FROM order_items i WHERE i.order_id = o.id) as items FROM orders o LEFT JOIN order_addresses a ON o.id = a.order_id`;
    let params = [];
    if (decoded.role !== 'admin') {
        queryText += ' WHERE o.user_id = $1';
        params.push(decoded.id);
    }
    queryText += ' ORDER BY o.created_at DESC';
    const result = await db.query(queryText, params);
    return res.status(200).json({ success: true, orders: result.rows });
}

async function handleStatus(req, res) {
    if (req.method !== 'PATCH') return res.status(405).json({ message: 'Method not allowed' });
    const decoded = jwt.verify(req.headers.authorization.split(' ')[1], process.env.JWT_SECRET);
    if (decoded.role !== 'admin') return res.status(403).json({ message: 'Forbidden' });

    const { id, paymentStatus, fulfillmentStatus } = req.body;
    await db.query('UPDATE orders SET payment_status = COALESCE($1, payment_status), fulfillment_status = COALESCE($2, fulfillment_status) WHERE id = $3 OR short_id = $3', [paymentStatus, fulfillmentStatus, id]);
    return res.status(200).json({ success: true });
}

async function handleTrack(req, res) {
    const { orderId, pin } = req.body;
    const normalizedPhone = normalizePhone(orderId);
    const isPhone = normalizedPhone.length >= 10;

    let userQuery = isPhone ? 'SELECT * FROM users WHERE phone = $1' : 'SELECT u.* FROM users u JOIN orders o ON u.id = o.user_id WHERE o.short_id = $1';
    const userRes = await db.query(userQuery, [isPhone ? normalizedPhone : orderId.toUpperCase()]);
    if (!userRes.rows[0] || !(await verifyPin(userRes.rows[0], pin))) return res.status(401).json({ message: 'Sai thông tin.' });

    const orders = await db.query('SELECT o.*, a.full_name, (SELECT json_agg(i) FROM order_items i WHERE i.order_id = o.id) as items FROM orders o JOIN order_addresses a ON o.id = a.order_id WHERE o.user_id = $1', [userRes.rows[0].id]);
    return res.status(200).json({ success: true, orders: orders.rows, order: orders.rows[0] });
}
