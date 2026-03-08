const db = require('../utils/db');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

module.exports = async (req, res) => {
    if (req.method !== 'POST') {
        return res.status(405).json({ message: 'Method not allowed' });
    }

    const { phone, password } = req.body;

    if (!phone || !password) {
        return res.status(400).json({ message: 'Missing phone or password' });
    }

    try {
        console.log(`[Login] Attempt for phone: ${phone}`);

        // Admin hardcoded fallback
        if (phone === 'admin' && password === 'admin') {
            const token = jwt.sign({ id: 'admin', role: 'admin' }, process.env.JWT_SECRET, { expiresIn: '1d' });
            return res.status(200).json({
                success: true,
                token,
                user: { identifier: 'admin', role: 'admin', name: 'Administrator', gender: 'male' }
            });
        }

        // Find user
        const result = await db.query('SELECT * FROM users WHERE phone = $1', [phone]);
        const user = result.rows[0];

        if (!user) {
            console.log(`[Login] Fail: Phone ${phone} not found`);
            return res.status(401).json({ message: 'Số điện thoại chưa được đăng ký.' });
        }

        // Verify password
        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
            console.log(`[Login] Fail: Incorrect password for ${phone}`);
            return res.status(401).json({ message: 'Mật khẩu không chính xác.' });
        }

        // Create JWT
        const token = jwt.sign(
            { id: user.id, role: user.role, phone: user.phone },
            process.env.JWT_SECRET,
            { expiresIn: '7d' }
        );

        console.log(`[Login] Success: User ${phone} logged in`);
        return res.status(200).json({
            success: true,
            token,
            user: {
                identifier: user.phone,
                role: user.role,
                name: user.name,
                gender: user.gender
            }
        });
    } catch (error) {
        console.error('[Login] Error:', error);
        return res.status(500).json({ message: 'Internal server error' });
    }
};
