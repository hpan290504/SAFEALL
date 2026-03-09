import pg from 'pg';
const { Pool } = pg;

// Basic Pool configuration using connection string from environment variable
const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: {
        rejectUnauthorized: false // Required for most cloud DBs like Supabase/Neon
    }
});

export const query = (text, params) => pool.query(text, params);
