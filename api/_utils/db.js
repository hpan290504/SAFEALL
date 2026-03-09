import pg from 'pg';
const { Pool } = pg;

// Basic Pool configuration using connection string from environment variable
if (!process.env.DATABASE_URL) {
    console.warn('[DB] WARNING: DATABASE_URL is not set!');
}

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: {
        rejectUnauthorized: false // Required for most cloud DBs like Supabase/Neon
    }
});

export const query = async (text, params) => {
    try {
        // console.log(`[DB] Executing query: ${text.split(' ')[0]}...`);
        return await pool.query(text, params);
    } catch (err) {
        console.error('[DB] Query Error:', err.message);
        throw err;
    }
};
