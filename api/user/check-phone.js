import * as db from '../_utils/db.js';

export default async function handler(req, res) {
    if (req.method !== 'GET') {
        return res.status(405).json({ message: 'Method not allowed' });
    }

    const { phone } = req.query;

    if (!phone) {
        return res.status(400).json({ message: 'Phone is required' });
    }

    try {
        const result = await db.query('SELECT id FROM users WHERE phone = $1 LIMIT 1', [phone]);

        if (result.rows.length > 0) {
            return res.status(200).json({ success: true, exists: true });
        } else {
            return res.status(200).json({ success: true, exists: false });
        }
    } catch (error) {
        console.error('[CheckPhone] Error:', error);
        return res.status(500).json({ message: 'Internal server error' });
    }
}
