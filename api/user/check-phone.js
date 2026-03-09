import * as db from '../_utils/db.js';
import { normalizePhone } from '../_utils/normalization.js';

export default async function handler(req, res) {
    if (req.method !== 'GET') {
        return res.status(405).json({ message: 'Method not allowed' });
    }

    const { phone } = req.query;

    if (!phone) {
        return res.status(400).json({ message: 'Phone is required' });
    }

    try {
        const normalizedPhone = normalizePhone(phone);
        const result = await db.query('SELECT id FROM users WHERE phone = $1 LIMIT 1', [normalizedPhone]);

        return res.status(200).json({
            success: true,
            exists: result.rows.length > 0
        });
    } catch (error) {
        console.error('[CheckPhone] Error:', error);
        return res.status(500).json({ message: 'Internal server error' });
    }
}
