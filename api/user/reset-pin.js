import * as db from '../_utils/db.js';
import bcrypt from 'bcryptjs';

export default async function handler(req, res) {
    if (req.method !== 'POST') return res.status(405).json({ message: 'Method not allowed' });

    const { phone, otp, newPin } = req.body;

    if (!phone || !otp || !newPin) {
        return res.status(400).json({ message: 'Vui lòng điền đầy đủ thông tin' });
    }

    if (newPin.length !== 6) {
        return res.status(400).json({ message: 'Mã PIN mới phải có đúng 6 số' });
    }

    // Mock OTP verification
    if (otp !== '123456') {
        return res.status(401).json({ message: 'Mã OTP không chính xác hoặc đã hết hạn.' });
    }

    try {
        const normalizedPhone = phone.replace(/\D/g, '');
        const salt = await bcrypt.genSalt(10);
        const hashedPin = await bcrypt.hash(newPin, salt);

        const result = await db.query(
            'UPDATE users SET track_pin_hash = $1 WHERE phone = $2 OR phone = $3 RETURNING id',
            [hashedPin, normalizedPhone, phone]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ message: 'Không thể cập nhật mã PIN. Tài khoản không tồn tại.' });
        }

        return res.status(200).json({ success: true, message: 'Mã PIN của bạn đã được cập nhật thành công!' });
    } catch (error) {
        console.error('[ResetPin] Error:', error);
        return res.status(500).json({ message: 'Lỗi máy chủ' });
    }
}
