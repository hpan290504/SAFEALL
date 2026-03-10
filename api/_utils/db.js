import pg from 'pg';
const { Pool } = pg;

// ============================================================
//  CRITICAL: DATABASE_URL must be the SUPABASE POOLER URL
//
//  On Vercel (serverless), you CANNOT use the direct host:
//    db.xxxx.supabase.co  =>  causes ENOTFOUND
//
//  You MUST use the SESSION POOLER URL from Supabase:
//    Dashboard -> Project Settings -> Database -> Connection Pooling
//    Choose "Session mode" and copy the connection string.
//    It looks like: postgres://postgres.xxxx:pass@aws-0-region.pooler.supabase.com:5432/postgres
// ============================================================

if (!process.env.DATABASE_URL) {
    console.error('[DB] CRITICAL: DATABASE_URL is not set! All DB queries will fail.');
}

// Diagnostic: Log hostname (without credentials) at startup
try {
    const url = new URL(process.env.DATABASE_URL || 'postgres://');
    console.log(`[DB] Connecting to host: ${url.hostname} port: ${url.port || 5432}`);
} catch (e) {
    console.error('[DB] DATABASE_URL format is invalid:', e.message);
}

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    // ssl: required for Supabase connections
    ssl: {
        rejectUnauthorized: false
    },
    // Serverless-optimized settings
    max: 1,               // Keep connection count low for serverless
    idleTimeoutMillis: 10000,
    connectionTimeoutMillis: 5000,
});

export const query = async (text, params) => {
    const start = Date.now();
    try {
        const result = await pool.query(text, params);
        console.log(`[DB] Query OK (${Date.now() - start}ms):`, text.substring(0, 60));
        return result;
    } catch (err) {
        let category = 'Unknown SQL Error';

        // Categorize common pg errors
        if (err.code === '42703') category = 'Missing Column (Schema Mismatch)';
        else if (err.code === '42P01') category = 'Missing Table';
        else if (err.code === '28P01' || err.code === '28000') category = 'Authentication Failed';
        else if (err.code?.startsWith('08')) category = 'Connection Issue';
        else if (err.code === '23505') category = 'Duplicate Entry (Unique Constraint)';
        else if (err.code === '42601') category = 'Syntax Error';

        console.error(`[DB] ${category} [${err.code || 'NO_CODE'}]: ${err.message}`);
        if (err.detail) console.error(`[DB] Detail: ${err.detail}`);
        if (err.hint) console.error(`[DB] Hint: ${err.hint}`);
        if (text) console.error(`[DB] Failed query:`, text.substring(0, 200));

        // Enrich the error object for higher layers
        err.category = category;
        // Keep original code, detail, hint attached
        throw err;
    }
};

/**
 * getClient - Returns a client from the pool for manual transaction management
 * IMPORTANT: You MUST call client.release() when done!
 */
export const getClient = async () => {
    const client = await pool.connect();
    return client;
};
