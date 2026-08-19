// OPTIONAL backfill: turn judgement_sessions.payload->'costLedger' into citation_usage_events.
//
// The new engine stashes a cumulative cost snapshot in the session payload. This script
// replays those snapshots into the events table so the Citation Analytics tab has real
// data before the engine's own writer ships. Rows are tagged source='backfill'.
//
//   Run:    node migrations/backfill_citation_cost_from_costledger.js
//   Dry run: node migrations/backfill_citation_cost_from_costledger.js --dry
//   Undo:   node migrations/backfill_citation_cost_from_costledger.js --undo
//
// CAVEAT: costLedger has no per-call timestamps, so each (task, model) pair becomes ONE
// pre-aggregated row with calls=N rather than N rows. occurred_at is the session's
// updated_at. That is why these rows carry source='backfill' — exclude them with
// `WHERE source = 'engine'` for a like-for-like comparison once real events flow.
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const { Pool } = require('pg');

const EXPECTED_DB = 'citationTest';
const url = process.env.CITATION_ANALYTICS_DB_URL;
const DRY = process.argv.includes('--dry');
const UNDO = process.argv.includes('--undo');

if (!url) {
    console.error('❌ CITATION_ANALYTICS_DB_URL is not set');
    process.exit(1);
}
const targetDb = decodeURIComponent(new URL(url).pathname.replace(/^\//, ''));
if (targetDb !== EXPECTED_DB) {
    console.error(`❌ Refusing: target DB is "${targetDb}", expected "${EXPECTED_DB}"`);
    process.exit(1);
}

// India Kanoon billed-counter key -> rate card operation
const IK_OPS = {
    search: 'search',
    doc: 'document',
    document: 'document',
    orig_doc: 'orig_doc',
    origdoc: 'orig_doc',
    fragment: 'fragment',
    meta: 'meta',
    metainfo: 'meta',
};

const INSERT = `
INSERT INTO citation_usage_events
  (event_key, session_id, user_id, case_id, provider, service, operation, model, unit,
   quantity, calls, input_tokens, output_tokens, cache_hit, source, metadata, occurred_at)
VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,'backfill',$15,$16)
ON CONFLICT (event_key) WHERE event_key IS NOT NULL DO NOTHING`;

function buildRows(session) {
    const { session_id: sid, user_id, payload, updated_at } = session;
    const ledger = payload?.costLedger;
    if (!ledger) return [];

    const at = updated_at;
    const caseId = payload?.caseId ?? null;
    const uid = user_id || payload?.userId || 'anonymous';
    const rows = [];
    const meta = JSON.stringify({ backfilled_from: 'payload.costLedger', pre_aggregated: true });

    // --- LLM tasks: key is "task|model" ---
    for (const [key, v] of Object.entries(ledger.llm || {})) {
        const [operation, model] = String(key).split('|');
        const inTok = Number(v?.in ?? 0);
        const outTok = Number(v?.out ?? 0);
        const calls = Number(v?.calls ?? 1);
        rows.push([
            `backfill:${sid}:${operation}:${model || '-'}`, sid, String(uid), caseId,
            'gemini', 'gemini', operation, model || null, 'tokens',
            inTok + outTok, calls, inTok, outTok, false, meta, at,
        ]);
    }

    // --- Embedding rerank ---
    const embedCalls = Number(ledger.embed_calls ?? 0);
    const embedTokens = Number(ledger.embed_tokens_est ?? 0);
    if (embedCalls > 0 || embedTokens > 0) {
        rows.push([
            `backfill:${sid}:embed_rerank`, sid, String(uid), caseId,
            'gemini', 'gemini', 'embed_rerank', 'gemini-embedding-001', 'tokens',
            embedTokens, embedCalls || 1, embedTokens, 0, false, meta, at,
        ]);
    }

    // --- Google Search grounding ---
    const grounding = Number(ledger.grounding_calls ?? 0);
    if (grounding > 0) {
        rows.push([
            `backfill:${sid}:grounding`, sid, String(uid), caseId,
            'gemini', 'gemini', 'grounding', null, 'calls',
            grounding, grounding, 0, 0, false, meta, at,
        ]);
    }

    // --- India Kanoon billed calls ---
    for (const [key, count] of Object.entries(ledger.billed || {})) {
        const op = IK_OPS[String(key).toLowerCase()];
        const n = Number(count ?? 0);
        if (!op || n <= 0) continue;
        rows.push([
            `backfill:${sid}:ik_${op}`, sid, String(uid), caseId,
            'indian_kanoon', 'india_kanoon', op, null, 'calls',
            n, n, 0, 0, false, meta, at,
        ]);
    }

    // --- Cache hits (counted, free) ---
    const cached = Number(ledger.cached ?? 0);
    if (cached > 0) {
        rows.push([
            `backfill:${sid}:ik_cache_hits`, sid, String(uid), caseId,
            'indian_kanoon', 'india_kanoon', 'document', null, 'calls',
            cached, cached, 0, 0, true, meta, at,
        ]);
    }

    return rows;
}

(async () => {
    const pool = new Pool({ connectionString: url });
    const client = await pool.connect();
    try {
        if (UNDO) {
            await client.query('BEGIN');
            await client.query("SET LOCAL citation.allow_cost_mutation = 'on'");
            const del = await client.query("DELETE FROM citation_usage_events WHERE source = 'backfill'");
            await client.query('COMMIT');
            console.log(`✅ Removed ${del.rowCount} backfilled rows.`);
            return;
        }

        const sessions = await client.query(`
      SELECT session_id, user_id, payload, updated_at
        FROM judgement_sessions
       WHERE payload ? 'costLedger'
       ORDER BY updated_at`);

        console.log(`Found ${sessions.rows.length} session(s) carrying a costLedger.\n`);

        let total = 0;
        let inserted = 0;
        for (const s of sessions.rows) {
            const rows = buildRows(s);
            total += rows.length;
            if (!DRY) {
                for (const r of rows) {
                    const res = await client.query(INSERT, r);
                    inserted += res.rowCount;
                }
            }
            console.log(`  ${s.session_id}  user=${s.user_id ?? '-'}  -> ${rows.length} events`);
        }

        if (DRY) {
            console.log(`\n[dry run] would insert ${total} events. Nothing written.`);
            return;
        }

        console.log(`\n✅ Inserted ${inserted} new events (${total - inserted} already present).`);

        const summary = await client.query(`
      SELECT session_id,
             round(total_cost_inr, 2) AS total_inr,
             round(ai_cost_inr, 2)    AS ai_inr,
             round(ik_cost_inr, 2)    AS ik_inr,
             total_calls, cache_hits
        FROM v_citation_session_cost
       ORDER BY total_cost_inr DESC`);
        console.log('\nsession                          total INR     AI INR     IK INR   calls  cacheHits');
        console.log('-'.repeat(88));
        for (const r of summary.rows) {
            console.log(
                '  ' + String(r.session_id).padEnd(34) +
                String(r.total_inr).padStart(9) +
                String(r.ai_inr).padStart(11) +
                String(r.ik_inr).padStart(11) +
                String(r.total_calls).padStart(8) +
                String(r.cache_hits).padStart(10)
            );
        }
    } catch (err) {
        console.error('\n❌ Backfill failed:', err.message);
        process.exit(1);
    } finally {
        client.release();
        await pool.end();
    }
})();
