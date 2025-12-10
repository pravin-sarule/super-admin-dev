// controllers/systemPromptController.js
const pool = require('../config/docDB'); // Use docDB for system_prompts table

/**
 * @desc Create a new system prompt
 * @route POST /api/system-prompts
 * @access Private (Super-admin only)
 */
const createSystemPrompt = async (req, res) => {
  const { system_prompt } = req.body;

  if (!system_prompt || system_prompt.trim() === '') {
    return res.status(400).json({ message: 'System prompt is required' });
  }

  try {
    const result = await pool.query(
      'INSERT INTO system_prompts (system_prompt) VALUES ($1) RETURNING *',
      [system_prompt.trim()]
    );

    res.status(201).json({
      success: true,
      message: 'System prompt created successfully',
      data: result.rows[0]
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
    const result = await pool.query(
      'SELECT * FROM system_prompts ORDER BY created_at DESC'
    );

    res.status(200).json({
      success: true,
      count: result.rows.length,
      data: result.rows
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
    const result = await pool.query(
      'SELECT * FROM system_prompts WHERE id = $1',
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'System prompt not found' });
    }

    res.status(200).json({
      success: true,
      data: result.rows[0]
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
      data: result.rows[0]
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
    const result = await pool.query(
      'DELETE FROM system_prompts WHERE id = $1 RETURNING *',
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'System prompt not found' });
    }

    res.status(200).json({
      success: true,
      message: 'System prompt deleted successfully',
      data: result.rows[0]
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
  deleteSystemPrompt
};

