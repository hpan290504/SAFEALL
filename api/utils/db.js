const { Pool } = require('pg');

// Basic Pool configuration using connection string from environment variable
const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: {
        rejectUnauthorized: false // Required for most cloud DBs like Supabase/Neon
    }
});

module.exports = {
    query: (text, params) => pool.query(text, params),
};
