/**
 * Repository for allowed Gemini voice model pricing.
 */
const pool = require('../db/jurinexVoiceDB');

const MODEL_COLS = `
  id, provider, model_id, display_name, category, badge, description,
  input_usd_per_million_tokens, output_usd_per_million_tokens,
  input_audio_usd_per_minute, output_audio_usd_per_minute,
  inr_one_minute_total, unit_pricing, pricing_rows,
  is_active, sort_order, created_at, updated_at
`;

const toApi = (row) => ({
  id: row.model_id,
  model_id: row.model_id,
  label: row.display_name,
  display_name: row.display_name,
  provider: row.provider,
  category: row.category,
  badge: row.badge,
  description: row.description,
  group: row.category === 'live_audio' ? 'Live audio models' : 'Text-to-speech models',
  cost: `₹${Number(row.inr_one_minute_total).toFixed(2)}/min`,
  inr_one_minute_total: Number(row.inr_one_minute_total),
  unit_pricing: row.unit_pricing || {},
  pricing_rows: row.pricing_rows || [],
  usd_pricing: {
    input_per_million_tokens:
      row.input_usd_per_million_tokens == null ? null : Number(row.input_usd_per_million_tokens),
    output_per_million_tokens:
      row.output_usd_per_million_tokens == null ? null : Number(row.output_usd_per_million_tokens),
    input_audio_per_minute:
      row.input_audio_usd_per_minute == null ? null : Number(row.input_audio_usd_per_minute),
    output_audio_per_minute:
      row.output_audio_usd_per_minute == null ? null : Number(row.output_audio_usd_per_minute),
  },
  is_active: row.is_active,
  sort_order: row.sort_order,
});

const list = async ({ active = true } = {}) => {
  const params = [];
  const where = [];

  if (active !== undefined && active !== null) {
    params.push(active);
    where.push(`is_active = $${params.length}`);
  }

  const { rows } = await pool.query(
    `SELECT ${MODEL_COLS}
       FROM voice_model_pricing
      ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
      ORDER BY sort_order ASC, display_name ASC`,
    params
  );

  return rows.map(toApi);
};

module.exports = {
  list,
};
