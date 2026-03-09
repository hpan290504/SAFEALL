import * as db from '../_utils/db.js';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { normalizePhone } from '../_utils/normalization.js';


export default async function handler(req, res) {
    console.log(`[Login] ${req.method} request received`);

    // STRICT METHOD CHECK (Fix for GET 500)
    if (req.method !== 'POST') {
        console.warn(`[Login] Method Not Allowed: ${req.method}`);
        return res.status(405).json({ message: 'Method not allowed' });
    }

    // Safety: ensure body exists
    const body = req.body || {};
    const { phone, password } = body;

    if (!phone || !password) {
        console.log(`[Login] Error: Missing phone or password fields in body`);
        return res.status(400).json({ message: 'Vui lòng nhập số điện thoại và mật khẩu.' });
    }

    try {
        console.log(`[Login] Attempting auth for phone: ${phone}`);

        // Debug ENV status
        if (!process.env.JWT_SECRET) {
            console.error(`[Login] MISSING JWT_SECRET in environment variables!`);
            throw new Error('Server configuration error (JWT)');
        }

        // Admin hardcoded fallback
        if (phone === 'admin' && password === 'admin') {
            console.log(`[Login] Special admin override used`);
            const token = jwt.sign({ id: 'admin', role: 'admin' }, process.env.JWT_SECRET, { expiresIn: '1d' });
            return res.status(200).json({
                success: true,
                token,
                user: { phone: 'admin', name: 'Administrator', role: 'admin', gender: 'male' }
            });
        }

        // Find user
        console.log(`[Login] Step 1: Querying database for ${phone}...`);
        const normalizedPhone = normalizePhone(phone);
        const result = await db.query('SELECT * FROM users WHERE phone = $1 OR phone = $2 LIMIT 1', [normalizedPhone, phone]);

        const user = result.rows[0];


        if (!user) {
            console.log(`[Login] Fail: Phone ${phone} not found in database`);
            return res.status(401).json({ message: 'Số điện thoại chưa được đăng ký.' });
        }

        console.log(`[Login] Step 2: User found. Comparing credentials...`);

        // --- Unified Auth Logic: Handle both legacy password and new tracking PIN ---
        // For standard users, the 'password' field from frontend now contains their 6-digit PIN.
        const isMatch = await bcrypt.compare(password, user.track_pin_hash || user.password);

        if (!isMatch) {
            console.log(`[Login] Fail: Credential mismatch for ${phone}`);
            return res.status(401).json({ message: 'Số điện thoại hoặc mã PIN không chính xác.' });
        }

        console.log(`[Login] Step 3: Password matched. Signing token...`);
        // Create JWT
        const token = jwt.sign(
            { id: user.id, role: user.role, phone: user.phone },
            process.env.JWT_SECRET,
            { expiresIn: '7d' }
        );

        console.log(`[Login] SUCCESS: User ${phone} logged in successfully`);
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
        console.error('[Login] EXCEPTION OCCURRED:', error);
        return res.status(500).json({
            message: 'Lỗi máy chủ (Internal Server Error)',
            error: error.message
        });
    }
};
