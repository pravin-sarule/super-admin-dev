// Seed sample storage add-on plans. Idempotent (name UNIQUE + ON CONFLICT DO NOTHING).
// Pricing: >= ₹9 / GB / month (provider ₹4/GB/mo + ₹5 margin). 1 month = 30 days for our plans.
//   recurring → price = GB × ₹9 × (months in cycle)
//   one_time  → price = GB × ₹9 × 12 (≈ a year's worth), valid 10 years then renew under updated terms
// Usage: node Backend/migrations/seed_addon_plans.js
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const { Pool } = require('pg');
const pool = new Pool({ connectionString: process.env.PAYMENT_DB_URL });

const RATE = 9;                       // ₹ per GB per month (minimum)
const ONE_TIME_MONTHS = 12;           // one-time price = RATE × GB × this
const ONE_TIME_VALIDITY_YEARS = 10;   // one-time term length, then renew

const MONTHS = { m: 1, q: 3, h: 6, y: 12, one: 12 };
const CYCLE_LABEL = { m: 'monthly', q: 'quarterly', h: 'half-yearly', y: 'yearly' };

const PLANS = [
  { name: '+5 GB Storage',                 gb: 5,    cycle: 'm' },
  { name: '+100 GB Storage',               gb: 100,  cycle: 'm' },
  { name: '+1 TB Storage',                 gb: 1024, cycle: 'm' },
  { name: '+100 GB Storage (Quarterly)',   gb: 100,  cycle: 'q' },
  { name: '+250 GB Storage (Half-yearly)', gb: 250,  cycle: 'h' },
  { name: '+500 GB Storage (Yearly)',      gb: 500,  cycle: 'y' },
  { name: '+1 TB Storage (One-time)',      gb: 1024, cycle: 'one' },
  { name: '+100 GB Storage (One-time)',    gb: 100,  cycle: 'one' },
];

const sizeLabel = (gb) => (gb >= 1024 && gb % 1024 === 0 ? `${gb / 1024} TB` : `${gb} GB`);

(async () => {
  const client = await pool.connect();
  try {
    let order = 1;
    for (const p of PLANS) {
      const oneTime = p.cycle === 'one';
      const price = p.gb * RATE * (oneTime ? ONE_TIME_MONTHS : MONTHS[p.cycle]);
      const billing_type = oneTime ? 'one_time' : 'recurring';
      const interval = oneTime ? null : MONTHS[p.cycle];
      const validity = oneTime ? ONE_TIME_VALIDITY_YEARS : null;
      const desc = oneTime
        ? `Extra ${sizeLabel(p.gb)} storage, one-time — valid ${ONE_TIME_VALIDITY_YEARS} years, then renew under updated terms.`
        : `Extra ${sizeLabel(p.gb)} storage, billed ${CYCLE_LABEL[p.cycle]} (₹${RATE}/GB/mo).`;

      const r = await client.query(
        `INSERT INTO addon_plans
           (name, description, addon_type, price, currency, storage_gb, billing_type, billing_interval_months, validity_years, is_active, sort_order)
         VALUES ($1,$2,'storage',$3,'INR',$4,$5,$6,$7,TRUE,$8)
         ON CONFLICT (name) DO NOTHING
         RETURNING id`,
        [p.name, desc, price, p.gb, billing_type, interval, validity, order++]
      );
      console.log(r.rowCount
        ? `  ✅ ${p.name} → ₹${price} ${oneTime ? `one-time (${ONE_TIME_VALIDITY_YEARS}yr)` : CYCLE_LABEL[p.cycle]}`
        : `  • ${p.name}: already exists — skipped`);
    }

    const all = await client.query(
      `SELECT name, price, storage_gb, billing_type, billing_interval_months, validity_years
       FROM addon_plans ORDER BY sort_order, name`
    );
    console.log('\nAdd-on plans now:');
    all.rows.forEach((r) => console.log(
      `  ${r.name}: ₹${r.price} | ${sizeLabel(r.storage_gb)} | ${r.billing_type === 'one_time'
        ? `one-time, ${r.validity_years}yr`
        : `${r.billing_interval_months}mo cycle`}`
    ));
  } catch (e) {
    console.error('❌ Seed failed:', e.message);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
})();
