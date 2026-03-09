import jwt from 'jsonwebtoken';
import * as db from '../_utils/db.js';

export default async function handler(req, res) {
    console.log(`[AuthMe] ${req.method} request received`);

    if (req.method !== 'GET') {
        console.warn(`[AuthMe] Method Not Allowed: ${req.method}`);
        return res.status(405).json({ message: 'Method not allowed. Use GET to fetch profile.' });
    }

    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ message: 'Unauthorized' });
    }

    const token = authHeader.split(' ')[1];

    try {
        console.log(`[AuthMe] Verifying token...`);
        if (!process.env.JWT_SECRET) {
            console.error(`[AuthMe] ERROR: JWT_SECRET is missing!`);
            throw new Error('JWT_SECRET is not configured');
        }

        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        console.log(`[AuthMe] Token verified for ID: ${decoded.id}`);

        // Admin exception
        if (decoded.id === 'admin') {
            return res.status(200).json({
                success: true,
                user: { phone: 'admin', name: 'Administrator', role: 'admin', gender: 'male' }
            });
        }

        // Fetch fresh user data from DB
        console.log(`[AuthMe] Querying database for user ID: ${decoded.id}`);
        const result = await db.query('SELECT name, phone, gender, role, address, sale_deadline FROM users WHERE id = $1', [decoded.id]);
        const user = result.rows[0];

        if (!user) {
            console.log(`[AuthMe] Fail: User ${decoded.id} no longer exists`);
            return res.status(401).json({ message: 'User no longer exists' });
        }

        console.log(`[AuthMe] Success: User ${user.phone} profile fetched`);
        return res.status(200).json({
            success: true,
            user: {
                phone: user.phone,
                name: user.name,
                role: user.role,
                gender: user.gender,
                address: user.address || '',
                sale_deadline: user.sale_deadline ? parseInt(user.sale_deadline) : null
            }
        });
    } catch (error) {
        console.error('[AuthMe] EXCEPTION:', error.message);
        return res.status(401).json({
            message: 'Invalid or expired token',
            error: error.message
        });
    }
};
