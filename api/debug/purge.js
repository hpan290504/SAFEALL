import * as db from '../_utils/db.js';

export default async function handler(req, res) {
    if (req.method !== 'GET') return res.status(405).json({ message: 'Method not allowed' });

    // In a real production app, we would add a secret key check here
    // const { key } = req.query;
    // if (key !== process.env.DEBUG_KEY) return res.status(403).json({ message: 'Forbidden' });

    try {
        console.log('[Purge] Starting full database cleanup...');

        // Truncate tables. We delete orders first because they likely have a foreign key to users.
        await db.query('TRUNCATE TABLE orders RESTART IDENTITY CASCADE');
        await db.query('TRUNCATE TABLE users RESTART IDENTITY CASCADE');

        console.log('[Purge] Cleanup successful.');

        return res.status(200).json({
            success: true,
            message: 'Toàn bộ thông tin User và Đơn hàng đã được xóa sạch. Hệ thống đã sẵn sàng cho dữ liệu mới.'
        });
    } catch (error) {
        console.error('[Purge] Error:', error);
        return res.status(500).json({
            success: false,
            message: 'Lỗi khi xóa dữ liệu.',
            error: error.message
        });
    }
}
