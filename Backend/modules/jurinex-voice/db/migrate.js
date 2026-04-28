/**
 * Migration runner for the Jurinex Voice schema.
 *
 *   node Backend/modules/jurinex-voice/db/migrate.js
 *
 * Idempotent — safe to re-run.
 */
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '..', '..', '.env') });

const pool = require('./jurinexVoiceDB');

const run = async () => {
  console.log('\n' + '='.repeat(60));
  console.log('🎙️  Jurinex Voice DB migration');
  console.log('='.repeat(60));

  const sqlPath = path.join(__dirname, '..', 'migrations', '001_jurinex_voice_init.sql');
  const sql = fs.readFileSync(sqlPath, 'utf8');

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query(sql);
    await client.query('COMMIT');

    const tables = ['voice_agents', 'kb_documents', 'kb_chunks', 'kb_search_logs', 'voice_debug_events'];
    for (const t of tables) {
      const { rows } = await client.query(
        `SELECT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = $1) AS ok`,
        [t]
      );
      console.log(`  • ${t.padEnd(22)} ${rows[0].ok ? '✅' : '❌'}`);
    }

    const { rows: agentRows } = await client.query(`SELECT count(*)::int AS n FROM voice_agents`);
    console.log(`  • voice_agents seed:    ${agentRows[0].n} row(s)`);

    console.log('✅ Migration complete\n');
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    console.error('❌ Migration failed:', err.message);
    process.exitCode = 1;
  } finally {
    client.release();
    await pool.end().catch(() => {});
  }
};

run().catch((err) => {
  console.error('Fatal:', err);
  process.exit(1);
});
