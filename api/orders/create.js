import * as db from '../_utils/db.js';
import { normalizePhone } from '../_utils/normalization.js';
import { verifyPin, hashPin } from '../_utils/auth.js';

/**
 * api/orders/create.js - REWRITTEN
 * 
 * Logic:
 * 1. Normalize Phone.
 * 2. Check if user exists with this phone.
 * 3. BRANCH A (Existing): Verify PIN. If fail, return 401.
 * 4. BRANCH B (New): Hash PIN, Create User.
 * 5. Create Order linked to user.
 */
export default async function handler(req, res) {
    if (req.method !== 'POST') return res.status(405).json({ message: 'Method not allowed' });

    // Internal retry flag to prevent infinite loops
    let hasRetried = false;

    async function execute() {
        const {
            orderId, items, subtotal, shippingFee, total,
            paymentMethod, note, customer, pin
        } = req.body;

        // Basic validation
        if (!customer?.phone) return res.status(400).json({ message: 'Số điện thoại là bắt buộc' });
        if (!pin || pin.length !== 6) return res.status(400).json({ message: 'Mã PIN 6 số là bắt buộc' });

        const phone = normalizePhone(customer.phone);
        let userId = null;

        console.log(`[CreateOrder] Processing: ${phone} | Order: ${orderId} | Attempt: ${hasRetried ? '2' : '1'}`);

        try {
            // Log DB Connection Info for verification
            const dbUrl = process.env.DATABASE_URL || '';
            const dbHost = dbUrl.split('@')[1]?.split('/')[0] || 'Unknown';
            console.log(`[CreateOrder] Connecting to DB Host: ${dbHost}`);

            // 1. Identify User Status
            const userCheck = await db.query('SELECT * FROM users WHERE phone = $1 LIMIT 1', [phone]);

            if (userCheck.rows.length > 0) {
                // SCENARIO A: Existing User
                const user = userCheck.rows[0];
                const isMatch = await verifyPin(user, pin);

                if (!isMatch) {
                    throw { status: 401, message: 'Mã PIN không chính xác. Vui lòng nhập đúng PIN cũ của số điện thoại này.' };
                }
                userId = user.id;

                // Sync user info if changed
                await db.query(
                    `UPDATE users SET name = $1, email = $2, address = $3 WHERE id = $4`,
                    [customer.name, customer.email || user.email, customer.address, userId]
                );
            } else {
                // SCENARIO B: New User
                const hashedPin = await hashPin(pin);
                const newUser = await db.query(
                    `INSERT INTO users (name, phone, email, address, track_pin_hash, role) 
                     VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`,
                    [customer.name, phone, customer.email || null, customer.address, hashedPin, 'user']
                );
                userId = newUser.rows[0].id;
                console.log(`[CreateOrder] Account created for new user: ID=${userId}`);
            }

            // 2. Insert Order
            await db.query(
                `INSERT INTO orders (
                    order_id, user_id, customer_name, customer_phone, 
                    customer_email, customer_address, items, subtotal, 
                    shipping_fee, total, payment_method, note, status
                ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)`,
                [
                    orderId, userId, customer.name, phone,
                    customer.email || null, customer.address,
                    JSON.stringify(items), subtotal, shippingFee,
                    total, paymentMethod, note, 'pending'
                ]
            );

            return res.status(201).json({
                success: true,
                message: 'Đơn hàng tạo thành công!',
                orderId
            });

        } catch (error) {
            // Check if it's a validation error we threw manually
            if (error.status) {
                return res.status(error.status).json({ success: false, message: error.message });
            }

            console.error(`[CreateOrder] Error during step at attempt ${hasRetried ? '2' : '1'}:`, error.message);

            // SCHEMA FIXING LOGIC
            const isSchemaError = error.code === '42703' || error.code === '42P01' || error.message.includes('column') || error.message.includes('relation');

            if (isSchemaError && !hasRetried) {
                console.log('[CreateOrder] Schema mismatch. Running SILENT repair and INTERNAL retry...');
                try {
                    // 1. Ensure users table is robust
                    await db.query(`
                        CREATE TABLE IF NOT EXISTS users (
                            id SERIAL PRIMARY KEY,
                            name TEXT,
                            phone TEXT UNIQUE,
                            email TEXT,
                            address TEXT,
                            track_pin_hash TEXT,
                            role TEXT DEFAULT 'user',
                            reset_token TEXT,
                            reset_token_expiry TIMESTAMP,
                            created_at TIMESTAMP DEFAULT NOW()
                        )
                    `);

                    const userCols = {
                        'email': 'TEXT',
                        'address': 'TEXT',
                        'track_pin_hash': 'TEXT',
                        'role': 'TEXT',
                        'reset_token': 'TEXT',
                        'reset_token_expiry': 'TIMESTAMP'
                    };
                    for (const [col, type] of Object.entries(userCols)) {
                        await db.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS ${col} ${type}`).catch(() => { });
                    }

                    // 2. Ensure orders table is robust
                    await db.query(`
                        CREATE TABLE IF NOT EXISTS orders (
                            order_id TEXT PRIMARY KEY,
                            user_id INTEGER REFERENCES users(id),
                            customer_name TEXT,
                            customer_phone TEXT,
                            customer_email TEXT,
                            customer_address TEXT,
                            items TEXT,
                            subtotal NUMERIC,
                            shipping_fee NUMERIC,
                            total NUMERIC,
                            payment_method TEXT,
                            note TEXT,
                            status TEXT DEFAULT 'pending',
                            created_at TIMESTAMP DEFAULT NOW()
                        )
                    `);

                    const orderCols = {
                        'customer_email': 'TEXT',
                        'customer_address': 'TEXT',
                        'user_id': 'INTEGER',
                        'shipping_fee': 'NUMERIC',
                        'payment_method': 'TEXT',
                        'subtotal': 'NUMERIC',
                        'total': 'NUMERIC'
                    };
                    for (const [col, type] of Object.entries(orderCols)) {
                        await db.query(`ALTER TABLE orders ADD COLUMN IF NOT EXISTS ${col} ${type}`).catch(() => { });
                    }

                    console.log('[CreateOrder] Silent migration completed. Retrying logic now...');
                    hasRetried = true;
                    return execute(); // RECURSIVE INTERNAL RETRY
                } catch (migErr) {
                    console.error('[CreateOrder] Silent migration failed:', migErr.message);
                }
            }

            // Final fallback failure
            return res.status(500).json({
                success: false,
                message: 'Lỗi hệ thống khi tạo đơn hàng.',
                error: error.message,
                code: error.code,
                step: hasRetried ? 'Retry Execution' : 'First Execution'
            });
        }
    }

    return execute();
}
