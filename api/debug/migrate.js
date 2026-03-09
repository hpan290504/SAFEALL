import * as db from '../_utils/db.js';

export default async function handler(req, res) {
    if (req.method !== 'GET') return res.status(405).json({ message: 'Method not allowed' });

    const report = {
        checkTime: new Date().toISOString(),
        dbHost: 'Unknown',
        usersTable: { status: 'Checking', columns: {} },
        ordersTable: { status: 'Checking', columns: {} }
    };

    try {
        const dbUrl = process.env.DATABASE_URL || '';
        report.dbHost = dbUrl.split('@')[1]?.split('/')[0] || 'Unknown';

        // 1. Sync Users Table
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
        report.usersTable.status = 'Ready';

        const userCols = {
            'id': 'SERIAL PRIMARY KEY',
            'name': 'TEXT',
            'phone': 'TEXT UNIQUE',
            'email': 'TEXT',
            'address': 'TEXT',
            'track_pin_hash': 'TEXT',
            'role': 'TEXT',
            'reset_token': 'TEXT',
            'reset_token_expiry': 'TIMESTAMP'
        };

        for (const [col, type] of Object.entries(userCols)) {
            try {
                await db.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS ${col} ${type.replace(' PRIMARY KEY', '').replace(' UNIQUE', '')}`);
                report.usersTable.columns[col] = 'OK';
            } catch (e) {
                report.usersTable.columns[col] = `Skipped/Error: ${e.message}`;
            }
        }

        // 2. Sync Orders Table
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
        report.ordersTable.status = 'Ready';

        const orderCols = {
            'order_id': 'TEXT PRIMARY KEY',
            'user_id': 'INTEGER',
            'customer_name': 'TEXT',
            'customer_phone': 'TEXT',
            'customer_email': 'TEXT',
            'customer_address': 'TEXT',
            'items': 'TEXT',
            'subtotal': 'NUMERIC',
            'shipping_fee': 'NUMERIC',
            'total': 'NUMERIC',
            'payment_method': 'TEXT',
            'note': 'TEXT',
            'status': 'TEXT'
        };

        for (const [col, type] of Object.entries(orderCols)) {
            try {
                await db.query(`ALTER TABLE orders ADD COLUMN IF NOT EXISTS ${col} ${type.replace(' PRIMARY KEY', '')}`);
                report.ordersTable.columns[col] = 'OK';
            } catch (e) {
                report.ordersTable.columns[col] = `Skipped/Error: ${e.message}`;
            }
        }

        return res.status(200).json({ success: true, report });

    } catch (error) {
        return res.status(500).json({ success: false, error: error.message });
    }
}
