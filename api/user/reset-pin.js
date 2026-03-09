import * as db from '../_utils/db.js';
import { hashPin } from '../_utils/auth.js';
import { normalizePhone } from '../_utils/normalization.js';

export default async function handler(req, res) {
    if (req.method !== 'POST') return res.status(405).json({ message: 'Method not allowed' });

    const { phone, token, newPin } = req.body;

    if (!phone || !token || !newPin) {
        return res.status(400).json({ message: 'Thông tin không đầy đủ.' });
    }

    if (newPin.length !== 6) {
        return res.status(400).json({ message: 'Mã PIN mới phải đúng 6 chữ số.' });
    }

    try {
        const normalizedPhone = normalizePhone(phone);

        // Verify token
        const userResult = await db.query(
            'SELECT id FROM users WHERE phone = $1 AND reset_token = $2 AND reset_token_expiry > NOW() LIMIT 1',
            [normalizedPhone, token]
        );

        if (userResult.rows.length === 0) {
            return res.status(401).json({ message: 'Liên kết khôi phục không hợp lệ hoặc đã hết hạn.' });
        }

        const userId = userResult.rows[0].id;
        const hashedPin = await hashPin(newPin);

        await db.query(
            'UPDATE users SET track_pin_hash = $1, reset_token = NULL, reset_token_expiry = NULL WHERE id = $2',
            [hashedPin, userId]
        );

        return res.status(200).json({ success: true, message: 'Mã PIN của bạn đã được cập nhật thành công!' });
    } catch (error) {
        console.error('[ResetPin] Error:', error);
        return res.status(500).json({ message: 'Lỗi hệ thống khi cập nhật mã PIN.' });
    }
}
