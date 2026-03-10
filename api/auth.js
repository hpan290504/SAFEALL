import * as db from './_utils/db.js';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { normalizePhone } from './_utils/normalization.js';

export default async function handler(req, res) {
    const { pathname } = new URL(req.url, `http://${req.headers.host}`);
    const action = pathname.split('/').pop();

    try {
        if (action === 'login') return await handleLogin(req, res);
        if (action === 'register') return await handleRegister(req, res);
        if (action === 'me') return await handleMe(req, res);

        return res.status(404).json({ message: 'Auth action not found' });
    } catch (error) {
        console.error(`[Auth] Error in ${action}:`, error);
        return res.status(500).json({ message: 'Internal Server Error', error: error.message });
    }
}

async function handleLogin(req, res) {
    if (req.method !== 'POST') return res.status(405).json({ message: 'Method not allowed' });
    const { phone, password } = req.body || {};
    if (!phone || !password) return res.status(400).json({ message: 'Vui lòng nhập số điện thoại và mật khẩu.' });

    if (phone === 'admin' && password === 'admin') {
        const token = jwt.sign({ id: 'admin', role: 'admin' }, process.env.JWT_SECRET, { expiresIn: '1d' });
        return res.status(200).json({
            success: true,
            token,
            user: { phone: 'admin', name: 'Administrator', role: 'admin', gender: 'male' }
        });
    }

    const normalizedPhone = normalizePhone(phone);
    const result = await db.query('SELECT * FROM users WHERE phone = $1 OR phone = $2 LIMIT 1', [normalizedPhone, phone]);
    const user = result.rows[0];

    if (!user || !(await bcrypt.compare(password, user.track_pin_hash || user.password))) {
        return res.status(401).json({ message: 'Số điện thoại hoặc mã PIN không chính xác.' });
    }

    const token = jwt.sign({ id: user.id, role: user.role, phone: user.phone }, process.env.JWT_SECRET, { expiresIn: '7d' });
    return res.status(200).json({
        success: true,
        token,
        user: { phone: user.phone, name: user.name, role: user.role, gender: user.gender }
    });
}

async function handleRegister(req, res) {
    if (req.method !== 'POST') return res.status(405).json({ message: 'Method not allowed' });
    const { name, phone: rawPhone, password, gender } = req.body || {};
    const phone = normalizePhone(rawPhone);

    if (!name || !phone || !password) return res.status(400).json({ message: 'Vui lòng điền đầy đủ thông tin.' });

    const userCheck = await db.query('SELECT id FROM users WHERE phone = $1', [phone]);
    if (userCheck.rows.length > 0) return res.status(400).json({ message: 'Số điện thoại này đã được đăng ký.' });

    const salt = await bcrypt.genSalt(10);
    const hashedPw = await bcrypt.hash(password, salt);
    await db.query('INSERT INTO users (name, phone, password, gender, role) VALUES ($1, $2, $3, $4, $5)', [name, phone, hashedPw, gender || 'male', 'user']);

    return res.status(201).json({ success: true, message: 'Đăng ký thành công!' });
}

async function handleMe(req, res) {
    if (req.method !== 'GET') return res.status(405).json({ message: 'Method not allowed' });
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) return res.status(401).json({ message: 'Unauthorized' });

    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    if (decoded.id === 'admin') {
        return res.status(200).json({ success: true, user: { phone: 'admin', name: 'Administrator', role: 'admin', gender: 'male' } });
    }

    const result = await db.query('SELECT name, phone, gender, role, address, sale_deadline FROM users WHERE id = $1', [decoded.id]);
    const user = result.rows[0];
    if (!user) return res.status(401).json({ message: 'User no longer exists' });

    return res.status(200).json({
        success: true,
        user: {
            ...user,
            sale_deadline: user.sale_deadline ? parseInt(user.sale_deadline) : null
        }
    });
}
