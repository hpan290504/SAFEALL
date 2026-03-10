import * as db from './_utils/db.js';
import { normalizePhone } from './_utils/normalization.js';
import { verifyPin, hashPin } from './_utils/auth.js';
import crypto from 'crypto';
import jwt from 'jsonwebtoken';

// ========== AUTO-MIGRATION: runs once per cold start ==========
let migrated = false;

async function ensureSchema() {
    if (migrated) return;
    console.log('[Orders] Running auto-migration...');

    // Each statement runs independently so one failure doesn't block the rest
    const statements = [
        // Users table (safe to keep - additive only)
        `CREATE TABLE IF NOT EXISTS users (
            id SERIAL PRIMARY KEY, name TEXT, phone TEXT UNIQUE, email TEXT,
            password TEXT, track_pin_hash TEXT, role TEXT DEFAULT 'user',
            reset_token TEXT, reset_token_expiry TIMESTAMP,
            created_at TIMESTAMP DEFAULT NOW()
        )`,
        `ALTER TABLE users ADD COLUMN IF NOT EXISTS track_pin_hash TEXT`,
        `ALTER TABLE users ADD COLUMN IF NOT EXISTS reset_token TEXT`,
        `ALTER TABLE users ADD COLUMN IF NOT EXISTS reset_token_expiry TIMESTAMP`,

        // Recreate with correct UUID schema - NO DROPS, just additive/idempotent

        // Recreate with correct UUID schema
        `CREATE TABLE IF NOT EXISTS orders (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            short_id VARCHAR(12) UNIQUE NOT NULL,
            client_token VARCHAR(50),
            user_id INTEGER REFERENCES users(id),
            payment_status VARCHAR(20) DEFAULT 'pending',
            fulfillment_status VARCHAR(20) DEFAULT 'unfulfilled',
            subtotal DECIMAL(12,2) NOT NULL,
            shipping_fee DECIMAL(12,2) DEFAULT 0,
            total DECIMAL(12,2) NOT NULL,
            payment_method VARCHAR(30),
            customer_note TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            carrier_tracking_code VARCHAR(100),
            access_code VARCHAR(20)
        )`,

        `CREATE TABLE IF NOT EXISTS order_items (
            id SERIAL PRIMARY KEY,
            order_id UUID REFERENCES orders(id) ON DELETE CASCADE,
            product_id TEXT, quantity INTEGER NOT NULL,
            unit_price DECIMAL(12,2) NOT NULL,
            total_price DECIMAL(12,2) NOT NULL,
            title TEXT
        )`,

        `ALTER TABLE orders ADD COLUMN IF NOT EXISTS carrier_tracking_code VARCHAR(100)`,
        `ALTER TABLE orders ADD COLUMN IF NOT EXISTS access_code VARCHAR(20)`,
        `CREATE TABLE IF NOT EXISTS order_addresses (
            order_id UUID PRIMARY KEY REFERENCES orders(id) ON DELETE CASCADE,
            full_name TEXT NOT NULL, phone VARCHAR(20) NOT NULL,
            email TEXT, address_line TEXT NOT NULL,
            city TEXT, province TEXT, postal_code VARCHAR(10)
        )`
    ];

    for (const sql of statements) {
        try {
            await db.query(sql);
        } catch (e) {
            console.error('[Orders] Migration statement failed:', e.message, '| SQL:', sql.substring(0, 80));
        }
    }

    migrated = true;
    console.log('[Orders] Auto-migration complete.');
}

// ========== HANDLER ==========
export default async function handler(req, res) {
    await ensureSchema();

    // Robust path parsing
    const urlObj = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
    const action = urlObj.pathname.split('/').filter(Boolean).pop();

    try {
        if (action === 'create') return await handleCreate(req, res);
        if (action === 'my') return await handleMy(req, res);
        if (action === 'status') return await handleStatus(req, res);
        if (action === 'track-quick') return await handleTrackQuick(req, res);
        if (action === 'track-detail') return await handleTrackDetail(req, res);

        return res.status(404).json({ message: 'Order action not found' });
    } catch (error) {
        console.error(`[Orders] Error in ${action}:`, error);
        return res.status(500).json({ message: 'Internal Server Error', error: error.message });
    }
}

// ========== CREATE ==========
async function handleCreate(req, res) {
    if (req.method !== 'POST') return res.status(405).json({ message: 'Method not allowed' });

    // Aligned with js/checkout.js payload
    const { items, subtotal, shippingFee, total, paymentMethod, note, customer, pin, clientToken } = req.body;

    if (!items?.length || !customer?.phone || !pin) {
        console.warn('[Orders] Missing required fields:', { items: !!items?.length, phone: !!customer?.phone, pin: !!pin });
        return res.status(400).json({ message: 'Thiếu thông tin bắt buộc (sản phẩm, SĐT hoặc mã PIN).' });
    }

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
        const accessCode = crypto.randomBytes(4).toString('hex').toUpperCase(); // 8 char unique code
        const orderRes = await client.query(
            'INSERT INTO orders (short_id, client_token, user_id, subtotal, shipping_fee, total, payment_method, customer_note, access_code) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING id',
            [shortId, clientToken || null, userId, subtotal, shippingFee, total, paymentMethod, note || null, accessCode]
        );
        const orderId = orderRes.rows[0].id;

        for (const item of items) {
            const itemTotal = (item.qty || 1) * (item.price || 0);
            await client.query('INSERT INTO order_items (order_id, product_id, quantity, unit_price, total_price, title) VALUES ($1, $2, $3, $4, $5, $6)', [orderId, item.id, item.qty, item.price, itemTotal, item.title]);
        }
        await client.query('INSERT INTO order_addresses (order_id, full_name, phone, email, address_line) VALUES ($1, $2, $3, $4, $5)', [orderId, customer.name, phone, customer.email || null, customer.address]);

        await client.query('COMMIT');
        return res.status(201).json({ success: true, orderId: shortId });
    } catch (e) {
        if (client) await client.query('ROLLBACK');
        console.error('[Orders] Create failed:', e.message, e.stack);
        return res.status(e.message === 'Sai mã PIN.' ? 401 : 500).json({
            message: e.message,
            debug: process.env.NODE_ENV === 'development' ? e.stack : undefined
        });
    } finally {
        client.release();
    }
}

// ========== MY ORDERS ==========
async function handleMy(req, res) {
    const authHeader = req.headers.authorization;
    if (!authHeader) return res.status(401).json({ message: 'Unauthorized' });
    const decoded = jwt.verify(authHeader.split(' ')[1], process.env.JWT_SECRET);

    if (decoded.role === 'admin') {
        // Admin gets everything
        const result = await db.query(`
            SELECT o.*, a.full_name, a.phone, a.address_line, 
            (SELECT json_agg(i) FROM order_items i WHERE i.order_id = o.id) as items 
            FROM orders o 
            LEFT JOIN order_addresses a ON o.id = a.order_id
            ORDER BY o.created_at DESC
        `);
        return res.status(200).json({ success: true, orders: result.rows });
    }

    // Regular users can only see their own orders based on their user_id
    const result = await db.query(`
        SELECT o.*, a.full_name, a.phone, a.address_line, 
        (SELECT json_agg(i) FROM order_items i WHERE i.order_id = o.id) as items 
        FROM orders o 
        LEFT JOIN order_addresses a ON o.id = a.order_id
        WHERE o.user_id = $1
        ORDER BY o.created_at DESC
    `, [decoded.id]);
    return res.status(200).json({ success: true, orders: result.rows });
}

// ========== STATUS UPDATE ==========
async function handleStatus(req, res) {
    if (req.method !== 'PATCH') return res.status(405).json({ message: 'Method not allowed' });
    const decoded = jwt.verify(req.headers.authorization.split(' ')[1], process.env.JWT_SECRET);
    if (decoded.role !== 'admin') return res.status(403).json({ message: 'Forbidden' });

    const { id, paymentStatus, fulfillmentStatus, carrierTrackingCode } = req.body;
    await db.query(`
        UPDATE orders 
        SET payment_status = COALESCE($1, payment_status), 
            fulfillment_status = COALESCE($2, fulfillment_status),
            carrier_tracking_code = COALESCE($3, carrier_tracking_code),
            updated_at = NOW()
        WHERE id = $4 OR short_id = $4
    `, [paymentStatus, fulfillmentStatus, carrierTrackingCode, id]);
    return res.status(200).json({ success: true });
}

// ========== TRACK QUICK (Tier 1: Phone Only) ==========
async function handleTrackQuick(req, res) {
    const { phone } = req.body;
    if (!phone) return res.status(400).json({ message: 'Vui lòng cung cấp số điện thoại' });
    const normalizedPhone = normalizePhone(phone);

    // Only return minimal, non-sensitive info
    const orders = await db.query(`
        SELECT short_id, fulfillment_status, payment_status, created_at 
        FROM orders o 
        JOIN order_addresses a ON o.id = a.order_id 
        WHERE a.phone = $1 OR EXISTS (SELECT 1 FROM users u WHERE u.id = o.user_id AND u.phone = $1)
        ORDER BY o.created_at DESC
    `, [normalizedPhone]);

    return res.status(200).json({ success: true, orders: orders.rows });
}

// ========== TRACK DETAIL (Tier 2: Phone + PIN) ==========
async function handleTrackDetail(req, res) {
    const { phone, pin } = req.body;
    if (!phone || !pin) return res.status(400).json({ message: 'Thiếu số điện thoại hoặc mã PIN.' });
    const normalizedPhone = normalizePhone(phone);

    // Join with users to check PIN
    const result = await db.query(`
        SELECT o.*, a.full_name, a.phone, a.address_line, u.track_pin_hash,
        (SELECT json_agg(i) FROM order_items i WHERE i.order_id = o.id) as items 
        FROM orders o 
        JOIN order_addresses a ON o.id = a.order_id 
        JOIN users u ON o.user_id = u.id
        WHERE (a.phone = $1 OR u.phone = $1)
        ORDER BY o.created_at DESC
    `, [normalizedPhone]);

    if (result.rows.length === 0) {
        return res.status(404).json({ message: 'Không tìm thấy đơn hàng cho số điện thoại này.' });
    }

    // Since one phone can have multiple orders, we should ideally verify PIN first
    // and then maybe return all or the specific one. Usually PIN is per user.
    const user = result.rows[0];
    const isPinValid = await verifyPin(user, pin);

    if (!isPinValid) {
        return res.status(401).json({ message: 'Mã PIN không chính xác.' });
    }

    // Strip sensitive hash before returning
    const orders = result.rows.map(row => {
        const { track_pin_hash, ...orderData } = row;
        return orderData;
    });

    return res.status(200).json({
        success: true,
        orders: orders // Return all orders for this user since they verified their PIN
    });
}
