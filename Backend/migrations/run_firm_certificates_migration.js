const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

async function runMigration() {
  const client = await pool.connect();
  try {
    console.log('🔄 Running firm_certificates table migration...');
    
    const sql = fs.readFileSync(
      path.join(__dirname, 'create_firm_certificates_table.sql'),
      'utf8'
    );
    
    await client.query(sql);
    
    console.log('✅ firm_certificates table migration completed successfully!');
  } catch (error) {
    console.error('❌ Migration failed:', error);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

runMigration().catch(console.error);

