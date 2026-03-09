import * as db from '../_utils/db.js';
import { normalizePhone } from '../_utils/normalization.js';

/**
 * Combined Migration: Normalize Phones & Separate PIN Hash
 * Allows user to fix legacy data through the browser.
 */
export default async function handler(req, res) {
    try {
        console.log("--- STARTING COMBINED MIGRATION ---");
        const results = {
            schemaUpdated: false,
            usersNormalized: 0,
            ordersNormalized: 0,
            pinHashesMigrated: 0,
            errors: []
        };

        // 1. Schema Update: Add track_pin_hash if missing
        try {
            await db.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS track_pin_hash VARCHAR(255);`);
            results.schemaUpdated = true;
        } catch (e) {
            results.errors.push(`Table Alter Error: ${e.message}`);
        }

        // 2. Normalize & Migrate Users
        const users = await db.query('SELECT id, phone, password, track_pin_hash FROM users');
        for (const user of users.rows) {
            let needsUpdate = false;
            let finalPhone = user.phone;
            let finalPinHash = user.track_pin_hash;

            // Phone Normalization
            const normalized = normalizePhone(user.phone);
            if (normalized !== user.phone) {
                finalPhone = normalized;
                needsUpdate = true;
                results.usersNormalized++;
            }

            // PIN Migration (Copy password to track_pin_hash if empty)
            if (!user.track_pin_hash && user.password) {
                finalPinHash = user.password;
                needsUpdate = true;
                results.pinHashesMigrated++;
            }

            if (needsUpdate) {
                await db.query(
                    'UPDATE users SET phone = $1, track_pin_hash = $2 WHERE id = $3',
                    [finalPhone, finalPinHash, user.id]
                );
            }
        }

        // 3. Normalize Orders
        const orders = await db.query('SELECT id, customer_phone FROM orders');
        for (const order of orders.rows) {
            const normalized = normalizePhone(order.customer_phone);
            if (normalized !== order.customer_phone) {
                await db.query('UPDATE orders SET customer_phone = $1 WHERE id = $2', [normalized, order.id]);
                results.ordersNormalized++;
            }
        }

        return res.status(200).json({ success: true, results });
    } catch (error) {
        console.error("Migration failed:", error);
        return res.status(500).json({ success: false, error: error.message });
    }
}
