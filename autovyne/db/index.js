/**
 * db/index.js
 * Owns: the single pg Pool instance for the entire app.
 * Does NOT own: query logic (that lives in db/<entity>.js files).
 */
const { Pool } = require('pg');

// One pool for the process lifetime.
// Neon requires SSL on remote connections.
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL?.includes('localhost') ? false : { rejectUnauthorized: false },
});

module.exports = pool;
