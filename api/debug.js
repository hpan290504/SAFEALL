import * as db from './_utils/db.js';

export default async function handler(req, res) {
    const { pathname } = new URL(req.url, `http://${req.headers.host}`);
    const action = pathname.split('/').pop();

    if (req.query.key !== process.env.DEBUG_KEY && process.env.NODE_ENV === 'production') {
        return res.status(403).json({ message: 'Forbidden' });
    }

    try {
        if (action === 'migrate') {
            await db.query('CREATE TABLE IF NOT EXISTS users (...)'); // Simplified placeholder
            return res.status(200).json({ success: true, message: 'Migration complete' });
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
