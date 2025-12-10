const fs = require('fs');
const path = require('path');
const docDB = require('../config/docDB');
require('dotenv').config();

async function runMigration() {
  console.log('\n' + '='.repeat(60));
  console.log('🚀 Starting structured_schema column migration...');
  console.log('='.repeat(60));

  try {
    const client = await docDB.connect();
    console.log('📄 Executing migration SQL...');
    const sql = fs.readFileSync(path.join(__dirname, 'add_structured_schema_column.sql'), 'utf8');
    await client.query(sql);
    console.log('\n' + '='.repeat(60));
    console.log('✅ Migration completed successfully!');
    console.log('='.repeat(60));

    // Verify column
    const checkColumn = await client.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns
      WHERE table_name = 'document_ai_extractions' 
      AND column_name = 'structured_schema';
    `);
    
    if (checkColumn.rows.length > 0) {
      console.log(`✅ structured_schema column: ${checkColumn.rows[0].data_type}`);
    } else {
      console.error('❌ structured_schema column was NOT found!');
    }

    client.release();
    console.log('\n✅ Database connection closed');
  } catch (err) {
    console.error('❌ Migration failed:', err);
    process.exit(1);
  }
}

if (require.main === module) {
  runMigration();
}

module.exports = { runMigration };



