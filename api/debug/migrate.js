import * as db from '../_utils/db.js';

export default async function handler(req, res) {
    // Only allow GET for easy browser access
    if (req.method !== 'GET') return res.status(405).json({ message: 'Method not allowed' });

    const report = {
        checkTime: new Date().toISOString(),
        steps: []
    };

    try {
        // Step 1: Check users table
        report.steps.push({ name: 'Verify users table columns' });
        const colsResult = await db.query(`
            SELECT column_name 
            FROM information_schema.columns 
            WHERE table_name = 'users'
        `);
        const existingCols = colsResult.rows.map(r => r.column_name);
        report.existingColumns = existingCols;

        // Step 2: Add missing columns
        const missingCols = [];
        if (!existingCols.includes('email')) missingCols.push('email TEXT');
        if (!existingCols.includes('track_pin_hash')) missingCols.push('track_pin_hash TEXT');
        if (!existingCols.includes('reset_token')) missingCols.push('reset_token TEXT');
        if (!existingCols.includes('reset_token_expiry')) missingCols.push('reset_token_expiry TIMESTAMP');

        if (missingCols.length > 0) {
            report.steps.push({ name: 'Adding missing columns', columns: missingCols });
            for (const colDef of missingCols) {
                await db.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS ${colDef}`);
            }
            report.migrationStatus = 'Success';
        } else {
            report.migrationStatus = 'Already up to date';
        }

        // Step 3: Check orders table (ensure customer_phone handle normalized)
        const orderCols = await db.query(`
            SELECT column_name 
            FROM information_schema.columns 
            WHERE table_name = 'orders'
        `);
        report.orderColumns = orderCols.rows.map(r => r.column_name);

        return res.status(200).json({ success: true, report });
    } catch (error) {
        console.error('[MigrationDebug] Error:', error);
        return res.status(500).json({
            success: false,
            message: 'Migration failed',
            error: error.message,
            stack: error.stack
        });
    }
}
