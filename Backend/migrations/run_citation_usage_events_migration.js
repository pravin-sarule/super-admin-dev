// Create the Citation Analytics cost schema (citation_usage_events + citation_rate_card)
// in the citationTest database. Idempotent — safe to run multiple times.
//
// Usage: npm run migrate:citation-usage      (from Backend/)
//
// SAFETY: refuses to run unless CITATION_ANALYTICS_DB_URL points at a database named
// "citationTest". citation_db backs five other dashboard tabs and must receive no DDL.
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');

const EXPECTED_DB = 'citationTest';
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
  console.error('   This migration must never run against citation_db — it backs the');
  console.error('   Overview / HITL Queue / Data Pipeline / Routes & DB / Business Metrics tabs.');
  process.exit(1);
}

const pool = new Pool({ connectionString: url });
const sql = fs.readFileSync(path.join(__dirname, 'create_citation_usage_events_table.sql'), 'utf8');

(async () => {
  const client = await pool.connect();
  try {
    console.log(`Connected to "${targetDb}" — creating citation cost schema…\n`);
    await client.query(sql);

    const tables = await client.query(
      `SELECT table_name FROM information_schema.tables
        WHERE table_schema = 'public'
          AND table_name IN ('citation_usage_events', 'citation_rate_card')
        ORDER BY table_name`
    );
    const views = await client.query(
      `SELECT table_name FROM information_schema.views
        WHERE table_schema = 'public'
          AND table_name IN ('v_citation_usage_events', 'v_citation_session_cost')
        ORDER BY table_name`
    );
    const indexes = await client.query(
      `SELECT indexname FROM pg_indexes
        WHERE schemaname = 'public' AND tablename = 'citation_usage_events'
        ORDER BY indexname`
    );
    const triggers = await client.query(
      `SELECT tgname FROM pg_trigger
        WHERE tgrelid = 'citation_usage_events'::regclass AND NOT tgisinternal
        ORDER BY tgname`
    );
    const rates = await client.query(
      `SELECT provider, COALESCE(model, operation, '*') AS target, tier, unit, currency,
              input_rate_per_million AS in_rate, output_rate_per_million AS out_rate,
              flat_rate_per_unit AS flat, is_active
         FROM citation_rate_card
        WHERE version = 'v1'
        ORDER BY provider, target, tier`
    );

    console.log('✅ Tables  :', tables.rows.map((r) => r.table_name).join(', '));
    console.log('✅ Views   :', views.rows.map((r) => r.table_name).join(', '));
    console.log('✅ Indexes :', indexes.rows.length, 'on citation_usage_events');
    console.log('✅ Triggers:', triggers.rows.map((r) => r.tgname).join(', '));
    console.log(`✅ Rate card: ${rates.rows.length} rows seeded (version v1)\n`);

    console.log('  provider      target                        tier      unit    cur   in/M    out/M   flat     active');
    console.log('  ' + '-'.repeat(102));
    for (const r of rates.rows) {
      console.log(
        '  ' +
          String(r.provider).padEnd(14) +
          String(r.target).padEnd(30) +
          String(r.tier).padEnd(10) +
          String(r.unit).padEnd(8) +
          String(r.currency).padEnd(6) +
          String(Number(r.in_rate) || '-').padEnd(8) +
          String(Number(r.out_rate) || '-').padEnd(8) +
          String(Number(r.flat) || '-').padEnd(9) +
          (r.is_active ? 'yes' : 'no')
      );
    }

    const missing =
      tables.rows.length !== 2 || views.rows.length !== 2 || triggers.rows.length !== 2;
    if (missing) {
      console.error('\n❌ Verification failed — expected 2 tables, 2 views and 2 triggers.');
      process.exit(1);
    }

    console.log('\nMigration applied successfully.');
  } catch (err) {
    console.error('\n❌ Migration failed:', err.message);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
})();
