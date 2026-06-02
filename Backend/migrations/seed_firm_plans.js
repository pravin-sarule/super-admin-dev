// Seed Firm-category monthly plans + re-categorise the existing Enterprise plan.
// Idempotent — safe to re-run (uses name UNIQUE + ON CONFLICT DO NOTHING). All prices in INR.
// Usage: node Backend/migrations/seed_firm_plans.js
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const { Pool } = require('pg');
const pool = new Pool({ connectionString: process.env.PAYMENT_DB_URL });

(async () => {
  const client = await pool.connect();
  try {
    // 1) Re-categorise the existing "Enterprise" plan → firm
    const recat = await client.query(
      `UPDATE monthly_plans SET category = 'firm', updated_at = NOW()
       WHERE LOWER(TRIM(name)) = 'enterprise'
       RETURNING id, name, category`
    );
    console.log(recat.rowCount
      ? `Re-categorised: ${recat.rows.map((r) => `#${r.id} ${r.name} → ${r.category}`).join(', ')}`
      : 'No "Enterprise" plan found to re-categorise.');

    // 2) Sample firm plan (INR)
    const firm = await client.query(
      `INSERT INTO monthly_plans
         (name, description, price, currency, monthly_tokens, daily_token_limit, billing_interval_months, category, is_custom, is_active, sort_order)
       VALUES ('Firm Team', 'For small firms & teams — a large shared monthly token pool.', 4999, 'INR', 50000000, 2000000, 1, 'firm', FALSE, TRUE, 1)
       ON CONFLICT (name) DO NOTHING
       RETURNING id, name`
    );
    console.log(firm.rowCount ? `Seeded firm plan: #${firm.rows[0].id} ${firm.rows[0].name}` : 'Firm plan "Firm Team" already exists — skipped.');

    // 3) Contact-us / custom card (INR; no fixed price/tokens)
    const custom = await client.query(
      `INSERT INTO monthly_plans
         (name, description, price, currency, monthly_tokens, daily_token_limit, billing_interval_months, category, is_custom, is_active, sort_order)
       VALUES ('Custom', 'Tailored limits & pricing for larger firms — contact our team.', 0, 'INR', 0, NULL, 1, 'firm', TRUE, TRUE, 99)
       ON CONFLICT (name) DO NOTHING
       RETURNING id, name`
    );
    console.log(custom.rowCount ? `Seeded contact-us card: #${custom.rows[0].id} ${custom.rows[0].name}` : 'Contact-us card "Custom" already exists — skipped.');

    // Show the Firm sub-tab contents
    const list = await client.query(
      `SELECT id, name, price, currency, monthly_tokens, daily_token_limit, is_custom, sort_order
       FROM monthly_plans WHERE category = 'firm' ORDER BY sort_order, name`
    );
    console.log('\nFirm sub-tab now:');
    list.rows.forEach((r) => console.log(
      `  #${r.id} ${r.name} | ${r.is_custom ? 'Contact us' : '₹' + r.price + ' ' + r.currency} | tokens=${r.is_custom ? 'custom' : r.monthly_tokens} | daily=${r.daily_token_limit ?? '—'}`
    ));
  } catch (e) {
    console.error('❌ Seed failed:', e.message);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
})();
