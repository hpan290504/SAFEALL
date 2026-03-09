import * as db from '../_utils/db.js';
import jwt from 'jsonwebtoken';

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ message: 'Method not allowed' });
    }

    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ message: 'Unauthorized' });
    }

    const token = authHeader.split(' ')[1];

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        const { name, address, sale_deadline } = req.body;

        if (decoded.id === 'admin') {
            return res.status(403).json({ message: 'Admin profile cannot be updated via this endpoint' });
        }

        // Build dynamic query
        const updates = [];
        const params = [];
        let idx = 1;

        if (name !== undefined) {
            updates.push(`name = $${idx++}`);
            params.push(name);
        }
        if (address !== undefined) {
            updates.push(`address = $${idx++}`);
            params.push(address);
        }
        if (sale_deadline !== undefined) {
            updates.push(`sale_deadline = $${idx++}`);
            params.push(sale_deadline);
        }

        if (updates.length === 0) {
            return res.status(400).json({ message: 'No fields to update' });
        }

        params.push(decoded.id);
        const queryText = `UPDATE users SET ${updates.join(', ')} WHERE id = $${idx} RETURNING *`;

        await db.query(queryText, params);

        return res.status(200).json({ success: true, message: 'Profile updated successfully' });
    } catch (error) {
        console.error('[UpdateProfile] Error:', error);
        return res.status(500).json({ message: 'Internal server error', error: error.message });
    }
};
