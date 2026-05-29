// Run once to add all subscription_plans limit columns to payment_DB
// Usage: node Backend/migrations/run_payment_db_migrations.js
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const { Pool } = require('pg');

const pool = new Pool({ connectionString: process.env.PAYMENT_DB_URL });

const migrations = [
  {
    name: 'alter_subscription_plans_add_token_limits',
    sql: `
      ALTER TABLE subscription_plans
        ADD COLUMN IF NOT EXISTS chat_token_limit           INTEGER DEFAULT NULL,
        ADD COLUMN IF NOT EXISTS summarization_token_limit  INTEGER DEFAULT NULL;
    `,
  },
  {
    name: 'alter_subscription_plans_add_full_limits',
    sql: `
      ALTER TABLE subscription_plans
        ADD COLUMN IF NOT EXISTS chat_messages_per_hour       INTEGER DEFAULT NULL,
        ADD COLUMN IF NOT EXISTS chat_chats_per_day           INTEGER DEFAULT NULL,
        ADD COLUMN IF NOT EXISTS chat_quota_per_minute        INTEGER DEFAULT NULL,
        ADD COLUMN IF NOT EXISTS chat_max_document_pages      INTEGER DEFAULT NULL,
        ADD COLUMN IF NOT EXISTS chat_max_document_size_mb    INTEGER DEFAULT NULL,
        ADD COLUMN IF NOT EXISTS chat_max_file_upload_per_day INTEGER DEFAULT NULL,
        ADD COLUMN IF NOT EXISTS chat_max_upload_files        INTEGER DEFAULT NULL,
        ADD COLUMN IF NOT EXISTS sum_messages_per_hour        INTEGER DEFAULT NULL,
        ADD COLUMN IF NOT EXISTS sum_chats_per_day            INTEGER DEFAULT NULL,
        ADD COLUMN IF NOT EXISTS sum_quota_per_minute         INTEGER DEFAULT NULL,
        ADD COLUMN IF NOT EXISTS sum_max_document_pages       INTEGER DEFAULT NULL,
        ADD COLUMN IF NOT EXISTS sum_max_document_size_mb     INTEGER DEFAULT NULL,
        ADD COLUMN IF NOT EXISTS sum_max_file_upload_per_day  INTEGER DEFAULT NULL,
        ADD COLUMN IF NOT EXISTS sum_max_upload_files         INTEGER DEFAULT NULL,
        ADD COLUMN IF NOT EXISTS sum_max_context_documents    INTEGER DEFAULT NULL,
        ADD COLUMN IF NOT EXISTS sum_max_conversation_history INTEGER DEFAULT NULL;
    `,
  },
];

(async () => {
  const client = await pool.connect();
  try {
    console.log('Connected to payment_DB — running migrations…\n');
    for (const m of migrations) {
      process.stdout.write(`  ▶ ${m.name} … `);
      await client.query(m.sql);
      console.log('✅ done');
    }
    console.log('\nAll migrations applied successfully.');
  } catch (err) {
    console.error('\n❌ Migration failed:', err.message);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
})();
