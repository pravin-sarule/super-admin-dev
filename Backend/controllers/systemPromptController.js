// controllers/systemPromptController.js
const pool = require('../config/docDB'); // Use docDB for system_prompts table

const PROMPT_TYPES = ['general', 'chat_model', 'summarization'];
const SERVICE_TYPES = ['chat_model', 'summarization'];

function normalizePromptType(raw) {
  const v = (raw == null ? 'general' : String(raw)).toLowerCase().trim();
  return PROMPT_TYPES.includes(v) ? v : null;
}

async function upsertServicePrompt(systemPrompt, promptType) {
  const existing = await pool.query(
    'SELECT id FROM system_prompts WHERE prompt_type = $1',
    [promptType]
  );
  if (existing.rows.length > 0) {
    const result = await pool.query(
      `UPDATE system_prompts
       SET system_prompt = $1, updated_at = NOW()
       WHERE prompt_type = $2
       RETURNING *`,
      [systemPrompt, promptType]
    );
    return { row: result.rows[0], created: false };
  }
  const result = await pool.query(
    'INSERT INTO system_prompts (system_prompt, prompt_type) VALUES ($1, $2) RETURNING *',
    [systemPrompt, promptType]
  );
  return { row: result.rows[0], created: true };
}

/**
 * @desc Create a new system prompt (general) or set the single prompt for chat_model / summarization
 * @route POST /api/system-prompts
 * @access Private (Super-admin only)
 */
const createSystemPrompt = async (req, res) => {
  const { system_prompt } = req.body;
  const promptType = normalizePromptType(req.body.prompt_type);

  if (!system_prompt || system_prompt.trim() === '') {
    return res.status(400).json({ message: 'System prompt is required' });
  }
  if (!promptType) {
    return res.status(400).json({
      message: `prompt_type must be one of: ${PROMPT_TYPES.join(', ')}`,
    });
  }

  try {
    if (SERVICE_TYPES.includes(promptType)) {
      const { row, created } = await upsertServicePrompt(system_prompt.trim(), promptType);
      return res.status(created ? 201 : 200).json({
        success: true,
        message: created
          ? 'System prompt created successfully'
          : 'System prompt updated successfully (one prompt per service)',
        data: row,
      });
    }

    const result = await pool.query(
      'INSERT INTO system_prompts (system_prompt, prompt_type) VALUES ($1, $2) RETURNING *',
      [system_prompt.trim(), 'general']
    );

    res.status(201).json({
      success: true,
      message: 'System prompt created successfully',
      data: result.rows[0],
    });
  } catch (error) {
    console.error('Error creating system prompt:', error.message);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

/**
 * @desc Get all system prompts
 * @route GET /api/system-prompts
 * @access Private (Super-admin only)
 */
const getAllSystemPrompts = async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT * FROM system_prompts
      ORDER BY
        CASE prompt_type
          WHEN 'chat_model' THEN 0
          WHEN 'summarization' THEN 1
          ELSE 2
        END,
        created_at DESC
    `);

    res.status(200).json({
      success: true,
      count: result.rows.length,
      data: result.rows,
    });
  } catch (error) {
    console.error('Error fetching system prompts:', error.message);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

/**
 * @desc Get a single system prompt by ID
 * @route GET /api/system-prompts/:id
 * @access Private (Super-admin only)
 */
const getSystemPromptById = async (req, res) => {
  const { id } = req.params;

  if (!id || isNaN(Number(id))) {
    return res.status(400).json({ message: 'Valid system prompt ID is required' });
  }

  try {
    const result = await pool.query('SELECT * FROM system_prompts WHERE id = $1', [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'System prompt not found' });
    }

    res.status(200).json({
      success: true,
      data: result.rows[0],
    });
  } catch (error) {
    console.error('Error fetching system prompt:', error.message);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

/**
 * @desc Update a system prompt by ID
 * @route PUT /api/system-prompts/:id
 * @access Private (Super-admin only)
 */
const updateSystemPrompt = async (req, res) => {
  const { id } = req.params;
  const { system_prompt } = req.body;

  if (!id || isNaN(Number(id))) {
    return res.status(400).json({ message: 'Valid system prompt ID is required' });
  }

  if (!system_prompt || system_prompt.trim() === '') {
    return res.status(400).json({ message: 'System prompt is required' });
  }

  try {
    const result = await pool.query(
      `UPDATE system_prompts
       SET system_prompt = $1, updated_at = NOW()
       WHERE id = $2
       RETURNING *`,
      [system_prompt.trim(), id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'System prompt not found' });
    }

    res.status(200).json({
      success: true,
      message: 'System prompt updated successfully',
      data: result.rows[0],
    });
  } catch (error) {
    console.error('Error updating system prompt:', error.message);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

/**
 * @desc Delete a system prompt by ID
 * @route DELETE /api/system-prompts/:id
 * @access Private (Super-admin only)
 */
const deleteSystemPrompt = async (req, res) => {
  const { id } = req.params;

  if (!id || isNaN(Number(id))) {
    return res.status(400).json({ message: 'Valid system prompt ID is required' });
  }

  try {
    const result = await pool.query('DELETE FROM system_prompts WHERE id = $1 RETURNING *', [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'System prompt not found' });
    }

    res.status(200).json({
      success: true,
      message: 'System prompt deleted successfully',
      data: result.rows[0],
    });
  } catch (error) {
    console.error('Error deleting system prompt:', error.message);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

module.exports = {
  createSystemPrompt,
  getAllSystemPrompts,
  getSystemPromptById,
  updateSystemPrompt,
  deleteSystemPrompt,
};
