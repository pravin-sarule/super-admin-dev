/**
 * Migration Script: Create template_files table
 * 
 * This script runs the migration to create the template_files table
 * and update the secret_manager table with new columns.
 * 
 * Usage: node migrations/run_template_files_migration.js
 */

const fs = require('fs');
const path = require('path');
const docDB = require('../config/docDB');
require('dotenv').config();

async function runMigration() {
  console.log('\n' + '='.repeat(60));
  console.log('🚀 Starting template_files table migration...');
  console.log('='.repeat(60) + '\n');

  const client = await docDB.connect();
  
  try {
    // Read the migration SQL file
    const migrationPath = path.join(__dirname, 'create_template_files_table.sql');
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
        AND table_name = 'template_files'
      );
    `);

    if (tableCheck.rows[0].exists) {
      console.log('✅ template_files table exists');
      
      // Count records
      const countResult = await client.query('SELECT COUNT(*) FROM template_files');
      console.log(`📊 Current template_files count: ${countResult.rows[0].count}`);
    } else {
      console.error('❌ template_files table was not created!');
    }

    // Check secret_manager columns
    const columnsCheck = await client.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'secret_manager' 
      AND column_name IN ('input_template_id', 'output_template_id', 'llm_id', 'chunking_method_id', 'temperature')
      ORDER BY column_name;
    `);

    console.log(`\n✅ secret_manager columns updated: ${columnsCheck.rows.length} new columns`);
    columnsCheck.rows.forEach(row => {
      console.log(`   - ${row.column_name}`);
    });

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

