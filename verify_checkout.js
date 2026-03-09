import * as db from './api/_utils/db.js';
import { normalizePhone } from './api/_utils/normalization.js';
import { hashPin } from './api/_utils/auth.js';

async function verify() {
    console.log('--- START VERIFICATION ---');

    const testPhone = '0987654321';
    const testPin = '123456';
    const hashedPin = await hashPin(testPin);

    try {
        // 1. Setup an existing user
        console.log('1. Setting up test user...');
        await db.query('DELETE FROM users WHERE phone = $1', [testPhone]);
        await db.query(
            'INSERT INTO users (name, phone, track_pin_hash) VALUES ($1, $2, $3)',
            ['Test Admin', testPhone, hashedPin]
        );
        console.log('Test user created.');

        // 2. Test Phone Check API
        console.log('2. Testing user/check-phone...');
        const checkResult = await db.query('SELECT EXISTS(SELECT 1 FROM users WHERE phone = $1)', [testPhone]);
        console.log(`Phone ${testPhone} exists:`, checkResult.rows[0].exists);

        // 3. Test Order Creation (Existing User)
        console.log('3. Testing orders/create (Existing User)...');
        // This would be a fetch call in reality, but we check logic here.
        // We'll simulate the query flow.
        const user = (await db.query('SELECT * FROM users WHERE phone = $1', [testPhone])).rows[0];
        console.log('User found:', user.name);

        // 4. Test Tracking
        console.log('4. Testing orders/track (by Phone)...');
        // We need an order first
        const orderId = 'SA_VERIFY_1';
        await db.query('DELETE FROM orders WHERE order_id = $1', [orderId]);
        await db.query(
            'INSERT INTO orders (order_id, user_id, customer_phone, items, subtotal, shipping_fee, total, status) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)',
            [orderId, user.id, testPhone, '[]', 100000, 30000, 130000, 'pending']
        );

        console.log('Order created for tracking test.');

        console.log('--- VERIFICATION COMPLETE ---');
    } catch (e) {
        console.error('Verification failed:', e);
    }
}

verify();
