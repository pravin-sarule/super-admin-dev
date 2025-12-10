/**
 * Migration Script: Create document_ai_extractions table
 * 
 * This script runs the migration to create the document_ai_extractions table
 * for storing text extracted from PDFs using Google Cloud Document AI.
 * 
 * Usage: node migrations/run_document_ai_extractions_migration.js
 */

const fs = require('fs');
const path = require('path');
const docDB = require('../config/docDB');
require('dotenv').config();

async function runMigration() {
  console.log('\n' + '='.repeat(60));
  console.log('🚀 Starting document_ai_extractions table migration...');
  console.log('='.repeat(60) + '\n');

  const client = await docDB.connect();
  
  try {
    // Read the migration SQL file
    const migrationPath = path.join(__dirname, 'create_document_ai_extractions_table.sql');
    const migrationSQL = fs.readFileSync(migrationPath, 'utf8');

    console.log('📄 Executing migration SQL...\n');
    
    // Execute the migration
    await client.query(migrationSQL);

    console.log('\n' + '='.repeat(60));
    console.log('✅ Migration completed successfully!');
    console.log('='.repeat(60) + '\n');

    // Verify the table was created
    const tableCheck = await client.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'document_ai_extractions'
      );
    `);

    if (tableCheck.rows[0].exists) {
      console.log('✅ document_ai_extractions table exists');
      
      // Count records
      const countResult = await client.query('SELECT COUNT(*) FROM document_ai_extractions');
      console.log(`📊 Current document_ai_extractions count: ${countResult.rows[0].count}`);
      
      // Show table columns
      const columnsResult = await client.query(`
        SELECT column_name, data_type, is_nullable
        FROM information_schema.columns
        WHERE table_name = 'document_ai_extractions'
        ORDER BY ordinal_position;
      `);
      
      console.log(`\n📋 Table columns (${columnsResult.rows.length}):`);
      columnsResult.rows.forEach(row => {
        console.log(`   - ${row.column_name} (${row.data_type})`);
      });
    } else {
      console.error('❌ document_ai_extractions table was not created!');
    }

  } catch (error) {
    console.error('\n❌ Migration failed:', error.message);
    console.error('Error details:', error);
    process.exit(1);
  } finally {
    client.release();
    await docDB.end();
    console.log('\n✅ Database connection closed');
    process.exit(0);
  }
}

// Run the migration
runMigration().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});

