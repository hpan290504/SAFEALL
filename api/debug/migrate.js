import * as db from '../_utils/db.js';

export default async function handler(req, res) {
    if (req.method !== 'GET') return res.status(405).json({ message: 'Method not allowed' });

    const report = {
        checkTime: new Date().toISOString(),
        steps: []
    };

    try {
        // Log connection info
        const dbUrl = process.env.DATABASE_URL || '';
        const dbHost = dbUrl.split('@')[1]?.split('/')[0] || 'Unknown';
        report.dbHost = dbHost;

        // 1. Audit users table
        report.steps.push({ name: 'Force Update Users Table' });
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

        const requiredUserCols = {
            'email': 'TEXT',
            'address': 'TEXT',
            'track_pin_hash': 'TEXT',
            'role': 'TEXT',
            'reset_token': 'TEXT',
            'reset_token_expiry': 'TIMESTAMP'
        };

        for (const [col, type] of Object.entries(requiredUserCols)) {
            await db.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS ${col} ${type}`).catch(() => { });
        }

        // 2. Audit orders table
        report.steps.push({ name: 'Force Update Orders Table' });
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

        const requiredOrderCols = {
            'customer_email': 'TEXT',
            'customer_address': 'TEXT',
            'user_id': 'INTEGER',
            'shipping_fee': 'NUMERIC',
            'payment_method': 'TEXT',
            'subtotal': 'NUMERIC',
            'total': 'NUMERIC'
        };

        for (const [col, type] of Object.entries(requiredOrderCols)) {
            await db.query(`ALTER TABLE orders ADD COLUMN IF NOT EXISTS ${col} ${type}`).catch(() => { });
        }

        return res.status(200).json({ success: true, report });
    } catch (error) {
        console.error('[Migration] Error:', error);
        return res.status(500).json({
            success: false,
            message: 'Migration failed',
            error: error.message
        });
    }
}
