

// const { Pool } = require('pg');
// require('dotenv').config();

// // Create a pool instance for docDB
// const templatePool = new Pool({
//   connectionString: process.env.TEMPLATE_DB_URL,
// });

// // Test connection (optional, for startup check)
// (async () => {
//   try {
//     const client = await docPool.connect();
//     console.log('✅ docDB (Secret Manager PostgreSQL) connected successfully');
//     console.log('📄 docDB URL:', process.env.DOCDB_URL?.substring(0, 30) + '...');
//     client.release();
//   } catch (err) {
//     console.error('❌ Failed to connect to docDB:', err);
//     process.exit(1); // exit on failure
//   }
// })();

// // Handle unexpected errors on idle clients
// docPool.on('error', (err) => {
//   console.error('❌ Unexpected error on docDB client:', err);
//   process.exit(1);
// });

// module.exports = templatePool;
const { Pool } = require('pg');
require('dotenv').config();

// Create a pool instance for draftDB (Templates Database)
const draftPool = new Pool({
  connectionString: process.env.DRAFT_DB_URL,
});

// Test connection (optional, for startup check)
(async () => {
  try {
    const client = await draftPool.connect();
    console.log('✅ draftDB (Templates PostgreSQL) connected successfully');
    console.log('📄 draftDB URL:', process.env.DRAFT_DB_URL?.substring(0, 30) + '...');
    client.release();
  } catch (err) {
    console.error('❌ Failed to connect to draftDB:', err);
    process.exit(1); // exit on failure
  }
})();

// Handle unexpected errors on idle clients
draftPool.on('error', (err) => {
  console.error('❌ Unexpected error on draftDB client:', err);
  process.exit(1);
});

module.exports = draftPool;