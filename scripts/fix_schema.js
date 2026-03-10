import * as db from '../api/_utils/db.js';

async function runFix() {
    try {
        console.log('Altering users table to allow NULL password...');
        await db.query('ALTER TABLE users ALTER COLUMN password DROP NOT NULL');
        console.log('Success!');
        process.exit(0);
    } catch (err) {
        console.error('Failed to alter table:', err);
        process.exit(1);
    }
}

runFix();
