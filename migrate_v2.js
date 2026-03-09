import * as db from './api/_utils/db.js';

async function migrate() {
    console.log('Starting migration...');
    try {
        // Add email column if not exists
        await db.query(`
            ALTER TABLE users 
            ADD COLUMN IF NOT EXISTS email TEXT;
        `);

        // Add reset token columns
        await db.query(`
            ALTER TABLE users 
            ADD COLUMN IF NOT EXISTS reset_token TEXT,
            ADD COLUMN IF NOT EXISTS reset_token_expiry TIMESTAMP;
        `);

        console.log('Migration completed successfully.');
    } catch (err) {
        console.error('Migration failed:', err);
    }
}

migrate();
