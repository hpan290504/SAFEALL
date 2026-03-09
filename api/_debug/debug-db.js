import * as db from '../_utils/db.js';

export default async function handler(req, res) {
    try {
        const result = await db.query('SELECT NOW() as time, count(*) as user_count FROM users');
        res.status(200).json({
            success: true,
            message: "Database connected!",
            data: result.rows[0]
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: "Database connection failed",
            error: error.message
        });
    }
}
