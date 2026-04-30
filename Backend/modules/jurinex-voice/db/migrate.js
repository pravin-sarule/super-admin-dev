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

  const migrationsDir = path.join(__dirname, '..', 'migrations');
  const migrationFiles = fs
    .readdirSync(migrationsDir)
    .filter((file) => file.endsWith('.sql'))
    .sort();

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    for (const file of migrationFiles) {
      const sqlPath = path.join(migrationsDir, file);
      const sql = fs.readFileSync(sqlPath, 'utf8');
      console.log(`  • running ${file}`);
      await client.query(sql);
    }
    await client.query('COMMIT');

    const tables = [
      'voice_agents',
      'voice_agent_configurations',
      'voice_agent_transfer_configs',
      'kb_documents',
      'kb_chunks',
      'kb_search_logs',
      'voice_debug_events',
      'voice_call_enrichments',
      'platform_voices',
      'platform_voice_preview_audios',
      'voice_model_pricing',
    ];
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
