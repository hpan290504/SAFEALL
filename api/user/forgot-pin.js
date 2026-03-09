import * as db from '../_utils/db.js';
import { normalizePhone } from '../_utils/normalization.js';
import crypto from 'crypto';

export default async function handler(req, res) {
    if (req.method !== 'POST') return res.status(405).json({ message: 'Method not allowed' });

    const { phone } = req.body;
    if (!phone) return res.status(400).json({ message: 'Số điện thoại là bắt buộc' });

    try {
        const normalizedPhone = normalizePhone(phone);
        const result = await db.query('SELECT id, name, email FROM users WHERE phone = $1 LIMIT 1', [normalizedPhone]);

        if (result.rows.length === 0) {
            return res.status(404).json({ message: 'Không tìm thấy tài khoản với số điện thoại này.' });
        }

        const user = result.rows[0];
        if (!user.email) {
            return res.status(400).json({
                message: 'Tài khoản này chưa đăng ký email để khôi phục. Vui lòng liên hệ bộ phận hỗ trợ.'
            });
        }

        // Generate reset token
        const token = crypto.randomBytes(32).toString('hex');
        const expiry = new Date(Date.now() + 3600000); // 1 hour

        await db.query(
            'UPDATE users SET reset_token = $1, reset_token_expiry = $2 WHERE id = $3',
            [token, expiry, user.id]
        );

        // In a real app, send email here. Mocking for now.
        const resetLink = `https://safeall.vercel.app/reset-pin.html?token=${token}&phone=${normalizedPhone}`;
        console.log(`[ForgotPIN] Reset link for ${user.email}: ${resetLink}`);

        return res.status(200).json({
            success: true,
            message: `Một liên kết đặt lại mã PIN đã được gửi đến email ${user.email.substring(0, 3)}***@${user.email.split('@')[1]}`
        });
    } catch (error) {
        console.error('[ForgotPin] Error:', error);
        return res.status(500).json({ message: 'Lỗi hệ thống khi yêu cầu khôi phục mã PIN.' });
    }
}
