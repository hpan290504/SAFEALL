import * as db from '../_utils/db.js';

export default async function handler(req, res) {
    if (req.method !== 'POST') return res.status(405).json({ message: 'Method not allowed' });

    const { phone } = req.body;
    if (!phone) return res.status(400).json({ message: 'Số điện thoại là bắt buộc' });

    const normalizedPhone = phone.replace(/\D/g, '');

    try {
        const result = await db.query('SELECT phone, email FROM users WHERE phone = $1 OR phone = $2 LIMIT 1', [normalizedPhone, phone]);

        if (result.rows.length === 0) {
            // Generic error for security
            return res.status(404).json({ message: 'Không tìm thấy tài khoản phù hợp với thông tin cung cấp.' });
        }

        const user = result.rows[0];
        const options = [];

        if (user.phone) {
            const p = user.phone;
            options.push({
                type: 'phone',
                label: `Số điện thoại: ${p.substring(0, 3)}***${p.substring(p.length - 3)}`,
                value: p
            });
        }

        if (user.email) {
            const e = user.email;
            const parts = e.split('@');
            options.push({
                type: 'email',
                label: `Email: ${parts[0].substring(0, 2)}***@${parts[1]}`,
                value: e
            });
        }

        return res.status(200).json({ success: true, options });
    } catch (error) {
        console.error('[ForgotPin] Error:', error);
        return res.status(500).json({ message: 'Lỗi máy chủ' });
    }
}
