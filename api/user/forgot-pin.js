import * as db from '../_utils/db.js';
import { normalizePhone } from '../_utils/normalization.js';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'safeall-secret-key';

/**
 * api/user/forgot-pin.js - REWRITTEN
 * 
 * Logic:
 * 1. Search for user by phone (normalized) OR email.
 * 2. If found, generate a reset token.
 * 3. Save token expiry in DB.
 * 4. (Simulation) Return the link for now, in production this sends an email.
 */
export default async function handler(req, res) {
    if (req.method !== 'POST') return res.status(405).json({ message: 'Method not allowed' });

    try {
        const { contact } = req.body; // Can be phone or email

        if (!contact) {
            return res.status(400).json({ message: 'Vui lòng nhập Số điện thoại hoặc Email.' });
        }

        const normalizedPhone = normalizePhone(contact);

        // Find user
        const userResult = await db.query(
            `SELECT * FROM users WHERE phone = $1 OR email = $2 LIMIT 1`,
            [normalizedPhone, contact]
        );

        if (userResult.rows.length === 0) {
            return res.status(404).json({ message: 'Không tìm thấy tài khoản với thông tin này.' });
        }

        const user = userResult.rows[0];

        // Generate Reset Token
        const resetToken = jwt.sign({ id: user.id, type: 'reset-pin' }, JWT_SECRET, { expiresIn: '1h' });
        const expiry = new Date(Date.now() + 3600000); // 1 hour

        // Save to DB
        await db.query(
            `UPDATE users SET reset_token = $1, reset_token_expiry = $2 WHERE id = $3`,
            [resetToken, expiry, user.id]
        );

        console.log(`[ForgotPIN] Reset link generated for ${user.phone}: /reset-pin.html?token=${resetToken}&phone=${user.phone}`);

        // In a real app, send email here. 
        // For this demo/setup, we tell user to check email.
        return res.status(200).json({
            success: true,
            message: 'Yêu cầu của bạn đã được tiếp nhận. Vui lòng kiểm tra Email (hoặc tin nhắn) để đặt lại mã PIN.',
            debugLink: `/reset-pin.html?token=${resetToken}&phone=${user.phone}` // Exposed for testing
        });

    } catch (error) {
        console.error('[ForgotPIN] ERROR:', error);
        return res.status(500).json({ message: 'Lỗi hệ thống khi gửi yêu cầu khôi phục.' });
    }
}
