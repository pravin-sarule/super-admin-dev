const { Pool } = require('pg');
require('dotenv').config();

const connectionString =
  process.env.CITATION_DB_URL ||
  process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error('CITATION_DB_URL or DATABASE_URL is required for judgement-service');
}

const pool = new Pool({
  connectionString,
});

pool.on('error', (error) => {
  console.error('[JudgementService][DB] Unexpected pool error:', error.message);
});

module.exports = pool;
