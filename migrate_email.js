import * as db from './api/_utils/db.js';

async function migrate() {
    console.log('Starting migration: Adding email column to users table...');
    try {
        await db.query('ALTER TABLE users ADD COLUMN IF NOT EXISTS email VARCHAR(255)');
        console.log('Migration successful: email column added.');
    } catch (error) {
        console.error('Migration failed:', error.message);
    }
    process.exit(0);
}

migrate();
