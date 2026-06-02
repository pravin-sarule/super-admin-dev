// Set sensible storage caps on existing monthly plans (GB). Only fills plans where
// storage_limit_gb IS NULL, so it never overrides values an admin has already set.
// Usage: node Backend/migrations/seed_storage_defaults.js
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const { Pool } = require('pg');
const pool = new Pool({ connectionString: process.env.PAYMENT_DB_URL });

const DEFAULTS = [
  ['Basic', 5],
  ['Pro', 100],
  ['Max', 1024],       // 1 TB
  ['Firm Team', 1024], // 1 TB
];

(async () => {
  const client = await pool.connect();
  try {
    for (const [name, gb] of DEFAULTS) {
      const r = await client.query(
        `UPDATE monthly_plans SET storage_limit_gb = $1, updated_at = NOW()
         WHERE LOWER(TRIM(name)) = LOWER($2) AND storage_limit_gb IS NULL
         RETURNING id, name, storage_limit_gb`,
        [gb, name]
      );
      console.log(r.rowCount
        ? `  ✅ ${name} → ${gb} GB`
        : `  • ${name}: not found or already set — skipped`);
    }

    const all = await client.query(
      `SELECT name, category, storage_limit_gb, is_custom FROM monthly_plans ORDER BY category, sort_order, name`
    );
    console.log('\nMonthly plans storage now:');
    all.rows.forEach((r) => console.log(
      `  [${r.category}] ${r.name}: ${r.is_custom ? 'Custom' : (r.storage_limit_gb == null ? 'No cap' : r.storage_limit_gb >= 1024 ? (r.storage_limit_gb / 1024) + ' TB' : r.storage_limit_gb + ' GB')}`
    ));
  } catch (e) {
    console.error('❌ Seed failed:', e.message);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
})();
