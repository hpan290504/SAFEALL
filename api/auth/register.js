import * as db from '../_utils/db.js';
import bcrypt from 'bcryptjs';

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ message: 'Method not allowed' });
    }

    const { name, phone, password, gender } = req.body;

    if (!name || !phone || !password) {
        return res.status(400).json({ message: 'Missing required fields' });
    }

    try {
        console.log(`[Register] Request for phone: ${phone}`);

        // Check if user exists
        const userCheck = await db.query('SELECT id FROM users WHERE phone = $1', [phone]);
        if (userCheck.rows.length > 0) {
            console.log(`[Register] Fail: Phone ${phone} already exists`);
            return res.status(400).json({ message: 'Số điện thoại này đã được đăng ký.' });
        }

        // Hash password
        const salt = await bcrypt.genSalt(10);
        const hashedPw = await bcrypt.hash(password, salt);

        // Insert user
        await db.query(
            'INSERT INTO users (name, phone, password, gender, role) VALUES ($1, $2, $3, $4, $5)',
            [name, phone, hashedPw, gender || 'male', 'user']
        );

        console.log(`[Register] Success: Registered phone ${phone}`);
        return res.status(201).json({ success: true, message: 'Đăng ký thành công!' });
    } catch (error) {
        console.error('[Register] Error:', error);
        return res.status(500).json({ message: 'Internal server error', error: error.message });
    }
};
