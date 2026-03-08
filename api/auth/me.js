const jwt = require('jsonwebtoken');
const db = require('../utils/db');

module.exports = async (req, res) => {
    if (req.method !== 'GET') {
        return res.status(405).json({ message: 'Method not allowed' });
    }

    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ message: 'Unauthorized' });
    }

    const token = authHeader.split(' ')[1];

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);

        // Admin exception
        if (decoded.id === 'admin') {
            return res.status(200).json({
                success: true,
                user: { identifier: 'admin', role: 'admin', name: 'Administrator', gender: 'male' }
            });
        }

        // Fetch fresh user data from DB
        const result = await db.query('SELECT name, phone, gender, role FROM users WHERE id = $1', [decoded.id]);
        const user = result.rows[0];

        if (!user) {
            return res.status(401).json({ message: 'User no longer exists' });
        }

        return res.status(200).json({
            success: true,
            user: {
                identifier: user.phone,
                role: user.role,
                name: user.name,
                gender: user.gender
            }
        });
    } catch (error) {
        return res.status(401).json({ message: 'Invalid or expired token' });
    }
};
