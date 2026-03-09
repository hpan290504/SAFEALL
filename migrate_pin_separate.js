import * as db from './api/_utils/db.js';

async function migrate() {
    try {
        console.log("--- STARTING SCHEMA MIGRATION: Separating PIN ---");

        // 1. Add column track_pin_hash
        console.log("Adding 'track_pin_hash' column...");
        await db.query(`
            ALTER TABLE users ADD COLUMN IF NOT EXISTS track_pin_hash VARCHAR(255);
        `);

        // 2. Baseline migration: copy password to track_pin_hash for consistency
        console.log("Copying existing passwords to PIN hashes for legacy support...");
        await db.query(`
            UPDATE users SET track_pin_hash = password WHERE track_pin_hash IS NULL;
        `);

        console.log("--- MIGRATION COMPLETED SUCCESSFULY ---");
    } catch (error) {
        console.error("Migration failed:", error);
    }
}

migrate();
