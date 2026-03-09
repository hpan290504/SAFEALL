import * as db from '../_utils/db.js';
import { hashPin } from '../_utils/auth.js';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'safeall-secret-key';

/**
 * api/user/reset-pin.js - REWRITTEN
 * 
 * Logic:
 * 1. Verify token (JWT and match in DB).
 * 2. Verify expiry.
 * 3. Update track_pin_hash.
 * 4. Clear reset_token.
 */
export default async function handler(req, res) {
    if (req.method !== 'POST') return res.status(405).json({ message: 'Method not allowed' });

    try {
        const { token, newPin } = req.body;

        if (!token || !newPin) {
            return res.status(400).json({ message: 'Thông tin không đầy đủ.' });
        }

        if (newPin.length !== 6) {
            return res.status(400).json({ message: 'Mã PIN phải có đúng 6 chữ số.' });
        }

        // 1. Verify JWT
        let decoded;
        try {
            decoded = jwt.verify(token, JWT_SECRET);
        } catch (e) {
            return res.status(401).json({ message: 'Liên kết hết hạn hoặc không hợp lệ.' });
        }

        // 2. Verify match in DB and check expiry
        const userResult = await db.query(
            `SELECT * FROM users WHERE id = $1 AND reset_token = $2 LIMIT 1`,
            [decoded.id, token]
        );

        if (userResult.rows.length === 0) {
            return res.status(401).json({ message: 'Yêu cầu khôi phục không hợp lệ hoặc đã được sử dụng.' });
        }

        const user = userResult.rows[0];
        const now = new Date();
        if (user.reset_token_expiry && new Date(user.reset_token_expiry) < now) {
            return res.status(401).json({ message: 'Liên kết khôi phục đã hết hạn.' });
        }

        // 3. Update PIN
        const hashedPin = await hashPin(newPin);
        await db.query(
            `UPDATE users SET track_pin_hash = $1, reset_token = NULL, reset_token_expiry = NULL WHERE id = $2`,
            [hashedPin, user.id]
        );

        console.log(`[ResetPIN] Successfully updated PIN for UserID ${user.id}`);

        return res.status(200).json({
            success: true,
            message: 'Mã PIN của bạn đã được cập nhật thành công. Bạn có thể tra cứu đơn hàng ngay bây giờ.'
        });

    } catch (error) {
        console.error('[ResetPIN] ERROR:', error);
        return res.status(500).json({ message: 'Lỗi hệ thống khi đặt lại mã PIN.' });
    }
}
