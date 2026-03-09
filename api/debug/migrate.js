import * as db from '../_utils/db.js';

export default async function handler(req, res) {
    // Only allow GET for easy browser access
    if (req.method !== 'GET') return res.status(405).json({ message: 'Method not allowed' });

    const report = {
        checkTime: new Date().toISOString(),
        steps: []
    };

    try {
        // Step 1: Audit users table
        report.steps.push({ name: 'Verify users table' });
        const userColsResult = await db.query(`
            SELECT column_name, data_type 
            FROM information_schema.columns 
            WHERE table_name = 'users'
        `);
        const userCols = userColsResult.rows.map(r => `${r.column_name} (${r.data_type})`);
        report.users = { schema: userCols, added: [] };

        const existingColNames = userColsResult.rows.map(r => r.column_name);

        const requiredUserCols = [
            { name: 'email', type: 'TEXT' },
            { name: 'track_pin_hash', type: 'TEXT' },
            { name: 'reset_token', type: 'TEXT' },
            { name: 'reset_token_expiry', type: 'TIMESTAMP' },
            { name: 'address', type: 'TEXT' },
            { name: 'phone', type: 'TEXT' }
        ];

        for (const col of requiredUserCols) {
            if (!existingColNames.includes(col.name)) {
                await db.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS ${col.name} ${col.type}`);
                report.users.added.push(col.name);
            }
        }

        // Step 2: Audit orders table
        report.steps.push({ name: 'Verify orders table' });
        const orderColsResult = await db.query(`
            SELECT column_name, data_type 
            FROM information_schema.columns 
            WHERE table_name = 'orders'
        `);
        const orderCols = orderColsResult.rows.map(r => `${r.column_name} (${r.data_type})`);
        report.orders = { schema: orderCols, added: [] };

        const existingOrderColNames = orderColsResult.rows.map(r => r.column_name);

        const requiredOrderCols = [
            { name: 'order_id', type: 'TEXT PRIMARY KEY' },
            { name: 'user_id', type: 'INTEGER' },
            { name: 'customer_name', type: 'TEXT' },
            { name: 'customer_phone', type: 'TEXT' },
            { name: 'customer_address', type: 'TEXT' },
            { name: 'items', type: 'TEXT' },
            { name: 'subtotal', type: 'NUMERIC' },
            { name: 'shipping_fee', type: 'NUMERIC' },
            { name: 'total', type: 'NUMERIC' },
            { name: 'payment_method', type: 'TEXT' },
            { name: 'note', type: 'TEXT' },
            { name: 'status', type: 'TEXT' },
            { name: 'created_at', type: 'TIMESTAMP DEFAULT NOW()' }
        ];

        // If orders table doesn't exist at all, we create it
        if (existingOrderColNames.length === 0) {
            report.steps.push({ name: 'Creating orders table' });
            await db.query(`
                CREATE TABLE IF NOT EXISTS orders (
                    order_id TEXT PRIMARY KEY,
                    user_id INTEGER,
                    customer_name TEXT,
                    customer_phone TEXT,
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
            report.orders.created = true;
        } else {
            for (const col of requiredOrderCols) {
                if (!existingOrderColNames.includes(col.name)) {
                    // Avoid adding PRIMARY KEY to ALTER TABLE
                    const type = col.type.replace(' PRIMARY KEY', '').replace(' DEFAULT NOW()', '');
                    await db.query(`ALTER TABLE orders ADD COLUMN IF NOT EXISTS ${col.name} ${type}`);
                    report.orders.added.push(col.name);
                }
            }
        }

        return res.status(200).json({ success: true, report });
    } catch (error) {
        console.error('[MigrationDebug] Error:', error);
        return res.status(500).json({
            success: false,
            message: 'Migration failed',
            error: error.message,
            stack: error.stack
        });
    }
}
