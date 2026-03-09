import * as db from '../_utils/db.js';
import bcrypt from 'bcryptjs';

export default async function handler(req, res) {
    console.log(`[Register] ${req.method} request received`);

    if (req.method !== 'POST') {
        console.warn(`[Register] Method Not Allowed: ${req.method}`);
        return res.status(405).json({ message: 'Method not allowed' });
    }

    // Safety: ensure body exists
    const body = req.body || {};
    const { name, phone, password, gender } = body;
    console.log(`[Register] Validating body for: ${phone || 'unknown'}`);

    if (!name || !phone || !password) {
        console.log(`[Register] Missing fields: ${JSON.stringify({ name: !!name, phone: !!phone, password: !!password })}`);
        return res.status(400).json({ message: 'Vui lòng điền đầy đủ thông tin: Họ tên, Số điện thoại và Mật khẩu.' });
    }

    try {
        console.log(`[Register] Step 1: Checking database connectivity...`);
        // Check if user exists
        const userCheck = await db.query('SELECT id FROM users WHERE phone = $1', [phone]);
        console.log(`[Register] Step 2: Database queried. Found: ${userCheck.rows.length} users`);

        if (userCheck.rows.length > 0) {
            console.log(`[Register] Fail: Phone ${phone} already exists`);
            return res.status(400).json({ message: 'Số điện thoại này đã được đăng ký.' });
        }

        console.log(`[Register] Step 3: Hashing password...`);
        // Hash password
        const salt = await bcrypt.genSalt(10);
        const hashedPw = await bcrypt.hash(password, salt);
        console.log(`[Register] Password hashed successfully.`);

        // Insert user
        console.log(`[Register] Step 4: Inserting user into database...`);
        const result = await db.query(
            'INSERT INTO users (name, phone, password, gender, role) VALUES ($1, $2, $3, $4, $5) RETURNING id',
            [name, phone, hashedPw, gender || 'male', 'user']
        );
        console.log(`[Register] Step 5: Insert SUCCESS. New User ID: ${result.rows[0].id}`);

        console.log(`[Register] SUCCESS: Registered phone ${phone}`);
        return res.status(201).json({ success: true, message: 'Đăng ký thành công!' });
    } catch (error) {
        console.error('[Register] EXCEPTION ERROR:', error);
        // Special case: Table missing
        if (error.message.includes('relation "users" does not exist')) {
            return res.status(500).json({ message: 'Database schema mismatch. Please run SQL init script.', error: error.message });
        }
        return res.status(500).json({ message: 'Lỗi máy chủ (Internal Server Error)', error: error.message });
    }
};
