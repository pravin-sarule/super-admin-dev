// ONE-TIME data remap: secret_manager.plan_id from legacy subscription_plans ids → monthly_plans ids,
// after Prompt Management was switched to read monthly_plans.
//   3  (Max,  subscription_plans) -> 5  (Max,  monthly_plans)
//   5  (Free, subscription_plans) -> 11 (Free Trial, monthly_plans)
//   25 (Pro,  subscription_plans) -> 4  (Pro,  monthly_plans)
// secret_manager lives in DOCDB; monthly_plans in the PAYMENT DB. Single CASE update (no collision).
// Idempotent: legacy id 25 doesn't exist in monthly_plans, so its absence means "already migrated" → skip.
// Usage: node Backend/migrations/remap_prompt_plan_ids.js
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const { Pool } = require('pg');
const doc = new Pool({ connectionString: process.env.DOCDB_URL });
const pay = new Pool({ connectionString: process.env.PAYMENT_DB_URL });

(async () => {
  const dc = await doc.connect();
  try {
    const before = await dc.query(
      'SELECT id, name, plan_id FROM secret_manager WHERE plan_id IN (3,5,25) ORDER BY plan_id, id'
    );
    if (!before.rows.some((r) => r.plan_id === 25)) {
      console.log('No legacy plan_id=25 present — already migrated (or nothing to remap). Skipping.');
      return;
    }
    console.log('BEFORE (legacy subscription_plans ids):');
    before.rows.forEach((r) => console.log(`  prompt #${r.id} "${r.name}" plan_id=${r.plan_id}`));

    const res = await dc.query(
      `UPDATE secret_manager
       SET plan_id = CASE plan_id WHEN 3 THEN 5 WHEN 5 THEN 11 WHEN 25 THEN 4 ELSE plan_id END
       WHERE plan_id IN (3,5,25)
       RETURNING id, plan_id`
    );
    console.log(`\nRemapped ${res.rowCount} prompts → new monthly_plans ids.`);

    const after = await dc.query('SELECT DISTINCT plan_id FROM secret_manager WHERE plan_id IS NOT NULL');
    const ids = after.rows.map((r) => r.plan_id);
    const mp = await pay.query('SELECT id, name, daily_token_limit FROM monthly_plans WHERE id = ANY($1)', [ids]);
    const validById = Object.fromEntries(mp.rows.map((r) => [r.id, r]));
    const orphans = ids.filter((id) => !validById[id]);
    console.log('AFTER distinct plan_ids:', ids.map((id) => `${id}=${validById[id]?.name || '??'}`).join(', '));
    console.log('Orphans (not in monthly_plans):', orphans.length ? orphans.join(', ') : 'none ✅');
  } catch (e) {
    console.error('❌ Remap failed:', e.message);
    process.exitCode = 1;
  } finally {
    dc.release();
    await doc.end();
    await pay.end();
  }
})();
