const aiDocumentPool = require('../config/aiDocumentDB');

const EDITABLE_COLUMNS = [
  // text model
  'model_text', 'max_tokens', 'temperature', 'top_p', 'top_k_results',
  // audio / live model
  'model_audio', 'voice_name', 'language_code', 'speaking_rate', 'pitch', 'volume_gain_db',
  // prompts — landing page
  'system_prompt', 'audio_system_prompt',
  // prompts — in-app panel
  'in_app_system_prompt', 'in_app_audio_override',
  // demo booking addendums
  'demo_text_addendum', 'demo_audio_addendum',
];

// GET /api/admin/chatbot-config
const getConfig = async (req, res) => {
  try {
    const { rows } = await aiDocumentPool.query(
      `SELECT ${EDITABLE_COLUMNS.join(', ')}
       FROM chatbot_config
       WHERE config_key = 'default'
       ORDER BY updated_at DESC
       LIMIT 1`
    );
    if (!rows.length) return res.status(404).json({ success: false, error: 'Config not found' });
    return res.json({ success: true, config: rows[0] });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
};

// PUT /api/admin/chatbot-config
const updateConfig = async (req, res) => {
  try {
    const updates = {};
    for (const col of EDITABLE_COLUMNS) {
      const val = req.body[col];
      if (val !== undefined && val !== null) updates[col] = val;
    }

    if (!Object.keys(updates).length) {
      return res.status(400).json({ success: false, error: 'No valid fields provided' });
    }

    const cols = Object.keys(updates);
    // $1 = 'default' (config_key), $2…$N = field values
    const vals = ['default', ...Object.values(updates)];
    const colList = ['config_key', ...cols].join(', ');
    const placeholders = vals.map((_, i) => `$${i + 1}`).join(', ');
    // ON CONFLICT: update every field using EXCLUDED (no extra params needed)
    const conflictSet = cols.map((c) => `${c} = EXCLUDED.${c}`).join(', ');

    const { rows } = await aiDocumentPool.query(
      `INSERT INTO chatbot_config (${colList})
       VALUES (${placeholders})
       ON CONFLICT (config_key) DO UPDATE
       SET ${conflictSet}, updated_at = NOW()
       RETURNING ${EDITABLE_COLUMNS.join(', ')}`,
      vals
    );

    return res.json({ success: true, config: rows[0] });
  } catch (err) {
    console.error('chatbot config update error:', err.message);
    return res.status(500).json({ success: false, error: err.message });
  }
};

module.exports = { getConfig, updateConfig };
