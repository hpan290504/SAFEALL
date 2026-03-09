import * as db from './api/_utils/db.js';

/**
 * Migration Script V2: Normalize all phone numbers in DB
 */
function normalizePhone(phone) {
    if (!phone) return '';
    let normalized = phone.toString().replace(/\D/g, '');
    if (normalized.startsWith('84') && normalized.length > 9) {
        normalized = '0' + normalized.substring(2);
    }
    return normalized;
}

async function migrate() {
    try {
        console.log("--- STARTING MIGRATION ---");

        // 1. Normalize USERS table
        console.log("Normalizing 'users' table...");
        const users = await db.query('SELECT id, phone FROM users');
        for (const user of users.rows) {
            const normalized = normalizePhone(user.phone);
            if (normalized !== user.phone) {
                console.log(`  Updating User ${user.id}: ${user.phone} -> ${normalized}`);
                await db.query('UPDATE users SET phone = $1 WHERE id = $2', [normalized, user.id]);
            }
        }

        // 2. Normalize ORDERS table
        console.log("Normalizing 'orders' table...");
        const orders = await db.query('SELECT id, customer_phone FROM orders');
        for (const order of orders.rows) {
            const normalized = normalizePhone(order.customer_phone);
            if (normalized !== order.customer_phone) {
                console.log(`  Updating Order ID ${order.id}: ${order.customer_phone} -> ${normalized}`);
                await db.query('UPDATE orders SET customer_phone = $1 WHERE id = $2', [normalized, order.id]);
            }
        }

        console.log("--- MIGRATION COMPLETED SUCCESSFULY ---");
    } catch (error) {
        console.error("Migration failed:", error);
    }
}

migrate();
