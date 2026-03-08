const jwt = require('jsonwebtoken');

export default async function handler(req, res) {
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
        // In a real app, you might fetch fresh user data from DB here
        return res.status(200).json({ success: true, user: decoded });
    } catch (error) {
        return res.status(401).json({ message: 'Invalid or expired token' });
    }
}
