/**
 * Dedicated PostgreSQL connection pool for the Jurinex Voice module.
 *
 * The voice call agent (`jurinex_call_agent`) and this admin module share the
 * same Cloud SQL instance / database. Tables created by this module live
 * alongside existing call-agent tables (calls, call_messages, customers, ...)
 * so we explicitly do NOT modify any of those.
 *
 * Connection string priority:
 *   1. JURINEX_VOICE_DATABASE_URL  (preferred, dedicated)
 *   2. CALLING_AGENT_DATABASE_URL  (older alias)
 *   3. Hard-coded fallback to the Calling_agent_DB so dev still works
 */

const { Pool } = require('pg');

const FALLBACK_URL =
  'postgresql://db_user:Nexintelai_43@35.200.202.69:5432/Calling_agent_DB';

const sanitize = (raw) => {
  if (!raw) return null;
  // SQLAlchemy style "postgresql+asyncpg://..." → plain "postgresql://..."
  return String(raw).replace(/^postgresql\+[a-z0-9]+:\/\//i, 'postgresql://');
};

const connectionString =
  sanitize(process.env.JURINEX_VOICE_DATABASE_URL) ||
  sanitize(process.env.CALLING_AGENT_DATABASE_URL) ||
  FALLBACK_URL;

const jurinexVoicePool = new Pool({
  connectionString,
  max: 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
});

jurinexVoicePool
  .connect()
  .then((client) => {
    const host = connectionString.split('@')[1] || 'connected';
    console.log('🎙️  Jurinex Voice DB connected:', host);
    client.release();
  })
  .catch((err) => {
    console.error('❌ Jurinex Voice DB connection failed:', err.message);
  });

jurinexVoicePool.on('error', (err) => {
  console.error('❌ Unexpected error on Jurinex Voice DB client:', err);
});

module.exports = jurinexVoicePool;
