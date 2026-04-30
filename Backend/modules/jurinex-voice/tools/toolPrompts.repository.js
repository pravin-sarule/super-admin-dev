/**
 * Reads + renders per-tool system-prompt fragments from
 * `voice_tool_system_prompts`. Used at Live session start to assemble
 * the tool-usage section of the system instruction.
 *
 * Caches rows for 60s so a busy admin panel doesn't hammer Postgres.
 * Bust the cache by calling refresh() after editing rows directly.
 */

const pool = require('../db/jurinexVoiceDB');

const CACHE_TTL_MS = Number(process.env.JURINEX_VOICE_TOOL_PROMPT_CACHE_MS || 60_000);

let cache = { ts: 0, byName: new Map() };

const loadAllActive = async () => {
  const now = Date.now();
  if (now - cache.ts < CACHE_TTL_MS && cache.byName.size > 0) {
    return cache.byName;
  }
  const { rows } = await pool.query(
    `SELECT tool_name, display_name, prompt_template, sort_order
       FROM voice_tool_system_prompts
      WHERE is_active = true
      ORDER BY sort_order ASC, display_name ASC`
  );
  const byName = new Map(rows.map((r) => [r.tool_name, r]));
  cache = { ts: now, byName };
  return byName;
};

const refresh = () => {
  cache = { ts: 0, byName: new Map() };
};

// Mustache-style placeholder substitution. Unknown placeholders are
// left in place so admins can spot typos in the prompt template.
const renderTemplate = (template, vars) =>
  String(template || '').replace(/\{\{\s*([\w.]+)\s*\}\}/g, (match, key) => {
    if (Object.prototype.hasOwnProperty.call(vars, key)) {
      const v = vars[key];
      return v == null ? '' : String(v);
    }
    return match;
  });

const renderForEnabledTools = async ({ enabledFunctionKeys = [], variables = {} }) => {
  if (!enabledFunctionKeys.length) return '';
  const byName = await loadAllActive();
  const ordered = enabledFunctionKeys
    .map((key) => byName.get(key))
    .filter(Boolean);
  if (!ordered.length) return '';
  const blocks = ordered.map((row) => renderTemplate(row.prompt_template, variables));
  return ['---', ...blocks, '---'].join('\n\n');
};

module.exports = {
  loadAllActive,
  refresh,
  renderTemplate,
  renderForEnabledTools,
};
