// Create the new simplified plan tables (monthly_plans, topup_plans) in payment_DB.
// Idempotent — safe to run multiple times. Does NOT touch the legacy subscription_plans table.
// Usage: node Backend/migrations/run_create_simple_plans.js
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');

const pool = new Pool({ connectionString: process.env.PAYMENT_DB_URL });
const sql = fs.readFileSync(path.join(__dirname, 'create_simple_plans_tables.sql'), 'utf8');

(async () => {
  const client = await pool.connect();
  try {
    console.log('Connected to payment_DB — creating simplified plan tables…\n');
    await client.query(sql);

    const check = await client.query(
      `SELECT table_name FROM information_schema.tables
       WHERE table_schema = 'public' AND table_name IN ('monthly_plans', 'topup_plans')
       ORDER BY table_name`
    );
    console.log('✅ Tables present:', check.rows.map((r) => r.table_name).join(', '));
    console.log('\nMigration applied successfully.');
  } catch (err) {
    console.error('\n❌ Migration failed:', err.message);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
})();
