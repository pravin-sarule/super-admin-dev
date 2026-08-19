// Repair citation_usage_events rows that carry INR but $0.00.
//
// Usage (from Backend/):
//   npm run repair:citation-usd          -> dry run, shows exactly what would change
//   npm run repair:citation-usd -- --apply
//
// WHY THIS EXISTS
// ---------------
// Before the pricing-trigger fix, the producer fallback branch did:
//     NEW.cost_usd := COALESCE(NEW.producer_cost_usd, 0);
// India Kanoon is INR-native, so the engine reports rupees only. Any row that missed the
// rate card (operation='doc' had no entry) was therefore booked as INR with cost_usd = 0.
// Those rows contribute to the INR total but not the USD total, which drags the
// dashboard's implied FX away from the real peg — 620.04 / 6.17 read as INR 100.56/USD
// when the true rate is 95.66.
//
// The INR figure on these rows is CORRECT and is never touched. cost_usd is a derived
// representation of the same charge, not a second charge — which is why this repairs in
// place rather than inserting compensating rows. A compensating row would appear in the
// run breakdown as a phantom "₹0.00 / $0.24" call that never happened.
//
// SAFETY
//   - refuses to run unless the target DB is named "citationTest"
//   - dry run unless --apply is passed
//   - single transaction; SET LOCAL citation.allow_cost_mutation='on' is the escape hatch
//     the append-only trigger documents, and it expires with the transaction
//   - only ever touches rows WHERE cost_inr > 0 AND COALESCE(cost_usd,0) = 0, so it is
//     idempotent: a second run finds nothing
//   - cost_inr is never modified; every change is stamped into metadata->'usd_repair'
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const { Pool } = require('pg');

const EXPECTED_DB = 'citationTest';
const APPLY = process.argv.includes('--apply');
const url = process.env.CITATION_ANALYTICS_DB_URL;

if (!url) {
  console.error('❌ CITATION_ANALYTICS_DB_URL is not set in Backend/.env');
  process.exit(1);
}

let targetDb;
try {
  targetDb = decodeURIComponent(new URL(url).pathname.replace(/^\//, ''));
} catch (err) {
  console.error('❌ CITATION_ANALYTICS_DB_URL is not a valid connection URL:', err.message);
  process.exit(1);
}

if (targetDb !== EXPECTED_DB) {
  console.error(`❌ Refusing: target DB is "${targetDb}", expected "${EXPECTED_DB}"`);
  process.exit(1);
}

// Same precedence the pricing trigger uses: the peg on an active rate for this provider
// that was in force when the call happened, else any active rate, else the current peg.
const FX_FOR_ROW = `
  COALESCE(
    (SELECT c.inr_per_usd FROM citation_rate_card c
      WHERE c.is_active
        AND LOWER(TRIM(c.provider)) = LOWER(TRIM(e.provider))
        AND c.effective_from <= e.occurred_at
      ORDER BY c.effective_from DESC LIMIT 1),
    (SELECT c.inr_per_usd FROM citation_rate_card c
      WHERE c.is_active ORDER BY c.effective_from DESC LIMIT 1),
    95.66
  )`;

const TARGETS = `
  SELECT e.id, e.occurred_at, e.provider, e.service, e.operation, e.calls,
         e.cost_source, e.cost_inr, ${FX_FOR_ROW} AS fx
    FROM citation_usage_events e
   WHERE e.cost_inr > 0 AND COALESCE(e.cost_usd, 0) = 0
   ORDER BY e.id`;

const totals = async (client) => {
  const { rows } = await client.query(`
    SELECT ROUND(SUM(cost_inr), 4)::text AS inr,
           ROUND(SUM(cost_usd), 4)::text AS usd,
           ROUND(SUM(cost_inr) / NULLIF(SUM(cost_usd), 0), 2)::text AS implied_fx
      FROM citation_usage_events`);
  return rows[0];
};

const pool = new Pool({ connectionString: url });

(async () => {
  const client = await pool.connect();
  try {
    console.log(`Connected to "${targetDb}"\n`);

    const before = await totals(client);
    console.log('Ledger before:', before);

    const { rows: targets } = await client.query(TARGETS);
    if (targets.length === 0) {
      console.log('\n✅ Nothing to repair — every row with a cost already carries both currencies.');
      return;
    }

    console.log(`\n${targets.length} row(s) carry INR but $0.00:\n`);
    console.table(
      targets.map((r) => ({
        id: r.id,
        when: new Date(r.occurred_at).toISOString(),
        operation: r.operation,
        source: r.cost_source,
        calls: r.calls,
        inr: Number(r.cost_inr).toFixed(4),
        fx: Number(r.fx).toFixed(4),
        usd_to_set: (Number(r.cost_inr) / Number(r.fx)).toFixed(8),
      }))
    );

    if (!APPLY) {
      console.log('\n🔍 DRY RUN — nothing written. Re-run with --apply to commit.');
      return;
    }

    await client.query('BEGIN');
    // The append-only trigger blocks UPDATE unless this is set. SET LOCAL scopes it to
    // this transaction, so the table re-locks itself the moment we commit.
    await client.query(`SET LOCAL citation.allow_cost_mutation = 'on'`);

    const { rows: changed } = await client.query(`
      WITH fx AS (
        SELECT e.id, ${FX_FOR_ROW} AS rate
          FROM citation_usage_events e
         WHERE e.cost_inr > 0 AND COALESCE(e.cost_usd, 0) = 0
      )
      UPDATE citation_usage_events e
         SET cost_usd            = ROUND(e.cost_inr / fx.rate, 8),
             applied_inr_per_usd = fx.rate,
             metadata            = e.metadata || jsonb_build_object(
               'usd_repair', jsonb_build_object(
                 'reason',       'producer sent INR only; pre-fix trigger stored COALESCE(producer_cost_usd, 0)',
                 'inr_per_usd',  fx.rate,
                 'cost_inr_unchanged', e.cost_inr,
                 'repaired_at',  NOW()
               ))
        FROM fx
       WHERE e.id = fx.id
      RETURNING e.id, e.operation, e.cost_inr, e.cost_usd, e.applied_inr_per_usd`);

    await client.query('COMMIT');

    console.log(`\n✅ Repaired ${changed.length} row(s):\n`);
    console.table(
      changed.map((r) => ({
        id: r.id,
        operation: r.operation,
        inr: Number(r.cost_inr).toFixed(4),
        usd: Number(r.cost_usd).toFixed(6),
        implied_fx: (Number(r.cost_inr) / Number(r.cost_usd)).toFixed(2),
      }))
    );

    const after = await totals(client);
    console.log('\nLedger after :', after);
    console.log(`implied FX ${before.implied_fx} -> ${after.implied_fx}`);
  } catch (err) {
    try {
      await client.query('ROLLBACK');
    } catch { /* not in a transaction */ }
    console.error('\n❌ Repair failed, nothing committed:', err.message);
    process.exitCode = 1;
  } finally {
    client.release();
    await pool.end();
  }
})();
