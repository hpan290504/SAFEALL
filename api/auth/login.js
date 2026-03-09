import * as db from '../_utils/db.js';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

export default async function handler(req, res) {
    console.log(`[Login] ${req.method} request received`);

    const { phone, password } = req.body;

    if (!phone || !password) {
        console.log(`[Login] Error: Missing phone or password`);
        return res.status(400).json({ message: 'Missing phone or password' });
    }

    try {
        console.log(`[Login] Attempt for phone: ${phone}`);

        // Debug ENV (Sensitive) - Only log existence
        if (!process.env.JWT_SECRET) {
            console.error(`[Login] ERROR: JWT_SECRET environment variable is MISSING!`);
        } else {
            console.log(`[Login] JWT_SECRET is configured.`);
        }

        // Admin hardcoded fallback
        if (phone === 'admin' && password === 'admin') {
            console.log(`[Login] Admin override detected`);
            if (!process.env.JWT_SECRET) throw new Error('JWT_SECRET is not configured on server');

            const token = jwt.sign({ id: 'admin', role: 'admin' }, process.env.JWT_SECRET, { expiresIn: '1d' });
            return res.status(200).json({
                success: true,
                token,
                user: { phone: 'admin', name: 'Administrator', role: 'admin', gender: 'male' }
            });
        }

        // Find user
        console.log(`[Login] Querying database for user...`);
        const result = await db.query('SELECT * FROM users WHERE phone = $1', [phone]);
        const user = result.rows[0];

        if (!user) {
            console.log(`[Login] Fail: Phone ${phone} not found in database`);
            return res.status(401).json({ message: 'Số điện thoại chưa được đăng ký.' });
        }

        console.log(`[Login] User found. Verifying password...`);
        // Verify password
        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
            console.log(`[Login] Fail: Incorrect password for ${phone}`);
            return res.status(401).json({ message: 'Mật khẩu không chính xác.' });
        }

        console.log(`[Login] Password verified. Signing JWT...`);
        if (!process.env.JWT_SECRET) throw new Error('JWT_SECRET is not configured on server');

        // Create JWT
        const token = jwt.sign(
            { id: user.id, role: user.role, phone: user.phone },
            process.env.JWT_SECRET,
            { expiresIn: '7d' }
        );

        console.log(`[Login] Success: User ${phone} logged in successfully`);
        return res.status(200).json({
            success: true,
            token,
            user: {
                phone: user.phone,
                name: user.name,
                role: user.role,
                gender: user.gender
            }
        });
    } catch (error) {
        console.error('[Login] EXCEPTION:', error);
        // Important: Return enough info for debugging, but sanitize for core security
        return res.status(500).json({
            message: 'Internal server error',
            error: error.message,
            stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
        });
    }
};
