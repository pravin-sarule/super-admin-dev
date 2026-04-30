/**
 * Reads + renders non-tool system prompt fragments from
 * `voice_system_prompt_fragments`. Used at Live session start so the
 * "phone-call style" rules, KB header, welcome turn, and fallback phrase
 * are all DB-editable instead of being hardcoded in JS.
 *
 * Cached for 60s; bust via refresh().
 */

const pool = require('../db/jurinexVoiceDB');

const CACHE_TTL_MS = Number(process.env.JURINEX_VOICE_PROMPT_FRAGMENT_CACHE_MS || 60_000);

let cache = { ts: 0, byKey: new Map() };

const loadAllActive = async () => {
  const now = Date.now();
  if (now - cache.ts < CACHE_TTL_MS && cache.byKey.size > 0) return cache.byKey;
  const { rows } = await pool.query(
    `SELECT fragment_key, display_name, template, sort_order
       FROM voice_system_prompt_fragments
      WHERE is_active = true
      ORDER BY sort_order ASC`
  );
  const byKey = new Map(rows.map((r) => [r.fragment_key, r]));
  cache = { ts: now, byKey };
  return byKey;
};

const refresh = () => {
  cache = { ts: 0, byKey: new Map() };
};

const renderTemplate = (template, vars = {}) =>
  String(template || '').replace(/\{\{\s*([\w.]+)\s*\}\}/g, (match, key) => {
    if (Object.prototype.hasOwnProperty.call(vars, key)) {
      const v = vars[key];
      return v == null ? '' : String(v);
    }
    return match;
  });

// Fetch a single fragment, optionally render with vars. Returns '' when
// the fragment is missing or inactive — callers decide whether to throw
// or skip silently.
const renderFragment = async (key, vars = {}) => {
  const byKey = await loadAllActive();
  const row = byKey.get(key);
  if (!row) return '';
  return renderTemplate(row.template, vars);
};

module.exports = {
  loadAllActive,
  refresh,
  renderTemplate,
  renderFragment,
};
