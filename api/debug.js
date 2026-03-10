import * as db from './_utils/db.js';

export default async function handler(req, res) {
    const { pathname } = new URL(req.url, `http://${req.headers.host}`);
    const action = pathname.split('/').pop();

    /* 
    if (req.query.key !== process.env.DEBUG_KEY && process.env.NODE_ENV === 'production') {
        return res.status(403).json({ message: 'Forbidden' });
    }
    */

    try {
        if (action === 'migrate') {
            --Robust Alterations for existing tables
                DO $$
            BEGIN
            --USERS transformations
                    IF EXISTS(SELECT 1 FROM information_schema.tables WHERE table_name = 'users') THEN
                        ALTER TABLE users ADD COLUMN IF NOT EXISTS track_pin_hash TEXT;
                        ALTER TABLE users ADD COLUMN IF NOT EXISTS reset_token TEXT;
                        ALTER TABLE users ADD COLUMN IF NOT EXISTS reset_token_expiry TIMESTAMP;
                        ALTER TABLE users ALTER COLUMN password DROP NOT NULL;
                    END IF;

            --ORDERS transformations
                    IF EXISTS(SELECT 1 FROM information_schema.tables WHERE table_name = 'orders') THEN
            --Identify if it's the old schema (numeric ID)
                        IF EXISTS(SELECT 1 FROM information_schema.columns WHERE table_name = 'orders' AND column_name = 'order_id') THEN
            --This is the REALLY old schema, might need a purge or rename
            --For now, let's just make sure short_id exists
                        END IF;
                        
                        ALTER TABLE orders ADD COLUMN IF NOT EXISTS short_id VARCHAR(12);
                        ALTER TABLE orders ADD COLUMN IF NOT EXISTS payment_status VARCHAR(20) DEFAULT 'pending';
                        ALTER TABLE orders ADD COLUMN IF NOT EXISTS fulfillment_status VARCHAR(20) DEFAULT 'unfulfilled';
                    END IF;
                END $$;

            --End - state Schema
                CREATE TABLE IF NOT EXISTS users(
                id SERIAL PRIMARY KEY,
                name TEXT,
                phone TEXT UNIQUE,
                email TEXT,
                password TEXT,
                track_pin_hash TEXT,
                role TEXT DEFAULT 'user',
                reset_token TEXT,
                reset_token_expiry TIMESTAMP,
                created_at TIMESTAMP DEFAULT NOW()
            );

                CREATE TABLE IF NOT EXISTS orders(
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                short_id VARCHAR(12) UNIQUE NOT NULL,
                user_id INTEGER REFERENCES users(id),
                payment_status VARCHAR(20) DEFAULT 'pending',
                fulfillment_status VARCHAR(20) DEFAULT 'unfulfilled',
                subtotal DECIMAL(12, 2) NOT NULL,
                shipping_fee DECIMAL(12, 2) DEFAULT 0,
                total DECIMAL(12, 2) NOT NULL,
                payment_method VARCHAR(30),
                customer_note TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );

                CREATE TABLE IF NOT EXISTS order_items(
                id SERIAL PRIMARY KEY,
                order_id UUID REFERENCES orders(id) ON DELETE CASCADE,
                product_id INTEGER,
                quantity INTEGER NOT NULL,
                unit_price DECIMAL(12, 2) NOT NULL,
                total_price DECIMAL(12, 2) NOT NULL,
                title TEXT
            );

                CREATE TABLE IF NOT EXISTS order_addresses(
                order_id UUID PRIMARY KEY REFERENCES orders(id) ON DELETE CASCADE,
                full_name TEXT NOT NULL,
                phone VARCHAR(20) NOT NULL,
                email TEXT,
                address_line TEXT NOT NULL,
                city TEXT,
                province TEXT,
                postal_code VARCHAR(10)
            );
            `);
            return res.status(200).json({ success: true, message: 'Migration complete (v5 forced)' });
        }
        if (action === 'purge') {
            await db.query('TRUNCATE TABLE orders, order_items, order_addresses, users RESTART IDENTITY CASCADE');
            return res.status(200).json({ success: true, message: 'Database purged' });
        }
        return res.status(404).json({ message: 'Debug action not found' });
    } catch (e) {
        return res.status(500).json({ success: false, error: e.message });
    }
}
