const { Pool } = require('pg');
require('dotenv').config();

const citationPool = new Pool({
    connectionString: process.env.CITATION_DB_URL,
});

// Lazy connection — pool connects on first query, no hard-fail on startup
citationPool.on('error', (err) => {
    console.error('❌ Unexpected error on Citation DB client:', err);
});

console.log('📊 Citation DB pool created (lazy connect via CITATION_DB_URL)');

module.exports = citationPool;
