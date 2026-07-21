// Adds the "marketing-admin" role to admin_roles if it does not already exist.
// Idempotent — safe to re-run.
// Usage: node Backend/migrations/seed_marketing_admin_role.js
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const { Pool } = require('pg');
const pool = new Pool({ connectionString: process.env.DATABASE_URL || process.env.DB_URL });

(async () => {
  const client = await pool.connect();
  try {
    const result = await client.query(
      `INSERT INTO admin_roles (name)
       VALUES ('marketing-admin')
       ON CONFLICT (name) DO NOTHING
       RETURNING id, name`
    );
    if (result.rowCount > 0) {
      console.log(`✅ Inserted role: ${result.rows[0].name} (id=${result.rows[0].id})`);
    } else {
      console.log('ℹ️  Role "marketing-admin" already exists — no changes made.');
    }
  } catch (err) {
    console.error('❌ Migration failed:', err.message);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
})();
