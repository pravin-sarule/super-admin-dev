
// module.exports = templatePool;
const { Pool } = require('pg');
require('dotenv').config();

// Create a pool instance for draftDB (Templates Database)
const paymentPool = new Pool({
  connectionString: process.env.PAYMENT_DB_URL,
});

// Test connection (optional, for startup check)
(async () => {
  try {
    const client = await paymentPool.connect();
    console.log('✅ paymentDB (Templates PostgreSQL) connected successfully');
    console.log('📄 paymentDB URL:', process.env.PAYMENT_DB_URL?.substring(0, 30) + '...');
    client.release();
  } catch (err) {
    console.error('❌ Failed to connect to paymentDB:', err);
    process.exit(1); // exit on failure
  }
})();

// Handle unexpected errors on idle clients
paymentPool.on('error', (err) => {
  console.error('❌ Unexpected error on draftDB client:', err);
  process.exit(1);
});

module.exports = paymentPool;