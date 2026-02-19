

const { Pool } = require('pg');
require('dotenv').config();

// Create a pool instance for docDB
const docPool = new Pool({
  connectionString: process.env.DOCDB_URL,
});

// Test connection (optional, for startup check)
(async () => {
  try {
    const client = await docPool.connect();
    console.log('✅ docDB (Secret Manager PostgreSQL) connected successfully');
    console.log('📄 docDB URL:', process.env.DOCDB_URL?.substring(0, 30) + '...');
    client.release();
  } catch (err) {
    console.error('❌ Failed to connect to docDB:', err);
    process.exit(1); // exit on failure
  }
})();

// Handle unexpected errors on idle clients
docPool.on('error', (err) => {
  console.error('❌ Unexpected error on docDB client:', err);
  process.exit(1);
});

module.exports = docPool;
