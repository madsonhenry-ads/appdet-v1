/**
 * Database pool configuration
 * Railway's PostgreSQL proxy drops idle TCP connections.
 * keepAlive + short idle timeout prevents stale connections.
 */
const { Pool } = require('pg');

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
    max: 10,
    idleTimeoutMillis: 5000,
    connectionTimeoutMillis: 10000,
    keepAlive: true,
    keepAliveInitialDelayMillis: 10000
});

pool.on('error', (err) => {
    console.error('⚠️ Unexpected database pool error (connection will be replaced):', err.message);
});

const RETRYABLE_CODES = new Set(['ECONNRESET', 'EPIPE', 'ETIMEDOUT', 'CONNECTION_ENDED']);

function isRetryable(err) {
    if (!err) return false;
    const msg = err.message || '';
    if (err.code && RETRYABLE_CODES.has(err.code)) return true;
    if (msg.includes('Connection terminated')) return true;
    if (msg.includes('connection timeout')) return true;
    if (err.cause && isRetryable(err.cause)) return true;
    return false;
}

/**
 * Execute a query with automatic retry on transient connection errors.
 * Drop-in replacement for pool.query().
 */
async function queryWithRetry(text, params, maxRetries = 2) {
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
        try {
            return await pool.query(text, params);
        } catch (err) {
            if (attempt < maxRetries && isRetryable(err)) {
                const delay = (attempt + 1) * 500;
                console.warn(`⚠️ DB query retry ${attempt + 1}/${maxRetries} after ${err.message}`);
                await new Promise(r => setTimeout(r, delay));
                continue;
            }
            throw err;
        }
    }
}

pool.queryRetry = queryWithRetry;

module.exports = pool;
