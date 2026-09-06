import pg from 'pg';

const { Pool } = pg;

if (!process.env.DATABASE_URL) {
  throw new Error('Missing required environment variable: DATABASE_URL');
}

// Cache the pool on globalThis so dev-mode hot reloads (and repeated
// serverless invocations sharing a warm container) reuse one pool instead
// of exhausting Postgres connections.
const globalForPg = globalThis;

export const pool =
  globalForPg.__pgPool ||
  new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
    max: 5,
  });

if (process.env.NODE_ENV !== 'production') {
  globalForPg.__pgPool = pool;
}

pool.on('error', (err) => {
  console.error('Unexpected error on idle Postgres client:', err.message);
});

export async function query(text, params) {
  try {
    return await pool.query(text, params);
  } catch (err) {
    throw new Error(`Database query failed: ${err.message}`);
  }
}
