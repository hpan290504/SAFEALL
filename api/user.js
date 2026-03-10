import * as db from './_utils/db.js';
import { normalizePhone } from './_utils/normalization.js';
import { hashPin } from './_utils/auth.js';
import jwt from 'jsonwebtoken';

export default async function handler(req, res) {
    const { pathname } = new URL(req.url, `http://${req.headers.host}`);
    const action = pathname.split('/').pop();

    try {
        if (action === 'check-phone') return await handleCheckPhone(req, res);
        if (action === 'forgot-pin') return await handleForgotPin(req, res);
        if (action === 'reset-pin') return await handleResetPin(req, res);
        if (action === 'update-profile') return await handleUpdateProfile(req, res);

        return res.status(404).json({ message: 'User action not found' });
    } catch (error) {
        console.error(`[User] Error in ${action}:`, error);
        return res.status(500).json({ message: 'Internal Server Error', error: error.message });
    }
}

async function handleCheckPhone(req, res) {
    const { phone } = req.query;
    const result = await db.query('SELECT id FROM users WHERE phone = $1 LIMIT 1', [normalizePhone(phone)]);
    return res.status(200).json({ success: true, exists: result.rows.length > 0 });
}

async function handleForgotPin(req, res) {
    const { contact } = req.body;
    const user = (await db.query('SELECT * FROM users WHERE phone = $1 OR email = $2 LIMIT 1', [normalizePhone(contact), contact])).rows[0];
    if (!user) return res.status(404).json({ message: 'Not found' });

    const token = jwt.sign({ id: user.id, type: 'reset-pin' }, process.env.JWT_SECRET, { expiresIn: '1h' });
    await db.query('UPDATE users SET reset_token = $1, reset_token_expiry = $2 WHERE id = $3', [token, new Date(Date.now() + 3600000), user.id]);
    return res.status(200).json({ success: true, debugLink: `/reset-pin.html?token=${token}&phone=${user.phone}` });
}

async function handleResetPin(req, res) {
    const { token, newPin } = req.body;
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = (await db.query('SELECT * FROM users WHERE id = $1 AND reset_token = $2', [decoded.id, token])).rows[0];
    if (!user || new Date(user.reset_token_expiry) < new Date()) return res.status(401).json({ message: 'Invalid token' });

    await db.query('UPDATE users SET track_pin_hash = $1, reset_token = NULL WHERE id = $2', [await hashPin(newPin), user.id]);
    return res.status(200).json({ success: true });
}

async function handleUpdateProfile(req, res) {
    const decoded = jwt.verify(req.headers.authorization.split(' ')[1], process.env.JWT_SECRET);
    const { name, address } = req.body;
    await db.query('UPDATE users SET name = COALESCE($1, name), address = COALESCE($2, address) WHERE id = $3', [name, address, decoded.id]);
    return res.status(200).json({ success: true });
}
