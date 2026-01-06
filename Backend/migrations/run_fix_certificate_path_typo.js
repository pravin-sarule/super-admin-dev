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
    console.log('🔄 Running certificate_path typo fix migration...');
    
    const sql = fs.readFileSync(
      path.join(__dirname, 'fix_certificate_path_typo.sql'),
      'utf8'
    );
    
    await client.query(sql);
    
    console.log('✅ Certificate path typo fix completed successfully!');
  } catch (error) {
    console.error('❌ Migration failed:', error);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

runMigration().catch(console.error);

