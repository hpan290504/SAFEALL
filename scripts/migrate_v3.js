import * as db from '../api/_utils/db.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function migrate() {
    console.log('--- STARTING V3 MIGRATION ---');
    try {
        const schemaPath = path.join(__dirname, '..', 'brain', '3fd7aaba-80e1-4c59-92d0-4ea26c21c28f', 'db_schema.sql');
        // If not found in brain (e.g. on server), use a local copy or hardcode
        let sql;
        if (fs.existsSync(schemaPath)) {
            sql = fs.readFileSync(schemaPath, 'utf8');
        } else {
            // Fallback to hardcoded core schema for robustness
            sql = `
                CREATE TABLE IF NOT EXISTS orders (
                    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                    short_id VARCHAR(12) UNIQUE NOT NULL,
                    user_id INTEGER,
                    payment_status VARCHAR(20) DEFAULT 'pending',
                    fulfillment_status VARCHAR(20) DEFAULT 'unfulfilled',
                    subtotal DECIMAL(12,2) NOT NULL,
                    shipping_fee DECIMAL(12,2) DEFAULT 0,
                    total DECIMAL(12,2) NOT NULL,
                    payment_method VARCHAR(30),
                    customer_note TEXT,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                );

                CREATE TABLE IF NOT EXISTS order_items (
                    id SERIAL PRIMARY KEY,
                    order_id UUID REFERENCES orders(id) ON DELETE CASCADE,
                    product_id INTEGER,
                    quantity INTEGER NOT NULL,
                    unit_price DECIMAL(12,2) NOT NULL,
                    total_price DECIMAL(12,2) NOT NULL,
                    title TEXT
                );

                CREATE TABLE IF NOT EXISTS order_addresses (
                    order_id UUID PRIMARY KEY REFERENCES orders(id) ON DELETE CASCADE,
                    full_name TEXT NOT NULL,
                    phone VARCHAR(20) NOT NULL,
                    email TEXT,
                    address_line TEXT NOT NULL,
                    city TEXT,
                    province TEXT,
                    postal_code VARCHAR(10)
                );
             `;
        }

        console.log('Executing SQL...');
        await db.query(sql);
        console.log('--- MIGRATION SUCCESSFUL ---');
    } catch (err) {
        console.error('--- MIGRATION FAILED ---');
        console.error(err);
        process.exit(1);
    }
}

migrate();
