// controllers/agentPromptController.js
const draftPool = require('../config/draftDB');

/**
 * @desc Create a new agent prompt
 * @route POST /api/agent-prompts
 */
const createAgentPrompt = async (req, res) => {
  const { name, prompt, model_ids, temperature, agent_type, llm_parameters } = req.body;

  if (!name || !name.trim()) {
    return res.status(400).json({ message: 'Agent name is required' });
  }
  if (!prompt || !prompt.trim()) {
    return res.status(400).json({ message: 'Prompt is required' });
  }
  if (!agent_type || !['drafting', 'summarization', 'citation'].includes(agent_type)) {
    return res.status(400).json({ message: "agent_type must be 'drafting', 'summarization' or 'citation'" });
  }

  const modelIds = Array.isArray(model_ids) ? model_ids : [];
  const llmParamsRaw = llm_parameters && typeof llm_parameters === 'object' ? llm_parameters : {};
  const tempFromParams = llmParamsRaw.temperature != null && llmParamsRaw.temperature !== '' ? Number(llmParamsRaw.temperature) : null;
  const temp = temperature != null ? Number(temperature) : (tempFromParams != null ? tempFromParams : 0.7);
  const llmParams = { ...llmParamsRaw, temperature: temp };

  try {
    const result = await draftPool.query(
      `INSERT INTO agent_prompts (name, prompt, model_ids, temperature, agent_type, llm_parameters)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
      [name.trim(), prompt.trim(), JSON.stringify(modelIds), temp, agent_type, JSON.stringify(llmParams)]
    );

    res.status(201).json({
      success: true,
      message: 'Agent prompt created successfully',
      data: result.rows[0]
    });
  } catch (error) {
    console.error('Error creating agent prompt:', error.message);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

/**
 * @desc Get all agent prompts (optional filter by agent_type)
 * @route GET /api/agent-prompts?agent_type=drafting|summarization|citation
 */
const getAllAgentPrompts = async (req, res) => {
  const { agent_type } = req.query;

  try {
    let query = 'SELECT * FROM agent_prompts';
    const params = [];

    if (agent_type && ['drafting', 'summarization', 'citation'].includes(agent_type)) {
      query += ' WHERE agent_type = $1';
      params.push(agent_type);
    }
    query += ' ORDER BY created_at DESC';

    const result = await draftPool.query(query, params);

    res.status(200).json({
      success: true,
      count: result.rows.length,
      data: result.rows
    });
  } catch (error) {
    console.error('Error fetching agent prompts:', error.message);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

/**
 * @desc Get a single agent prompt by ID
 * @route GET /api/agent-prompts/:id
 */
const getAgentPromptById = async (req, res) => {
  const { id } = req.params;

  if (!id || isNaN(Number(id))) {
    return res.status(400).json({ message: 'Valid agent prompt ID is required' });
  }

  try {
    const result = await draftPool.query(
      'SELECT * FROM agent_prompts WHERE id = $1',
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Agent prompt not found' });
    }

    res.status(200).json({
      success: true,
      data: result.rows[0]
    });
  } catch (error) {
    console.error('Error fetching agent prompt:', error.message);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

/**
 * @desc Update an agent prompt by ID
 * @route PUT /api/agent-prompts/:id
 */
const updateAgentPrompt = async (req, res) => {
  const { id } = req.params;
  const { name, prompt, model_ids, temperature, agent_type, llm_parameters } = req.body;

  if (!id || isNaN(Number(id))) {
    return res.status(400).json({ message: 'Valid agent prompt ID is required' });
  }

  if (name !== undefined && !name.trim()) {
    return res.status(400).json({ message: 'Agent name cannot be empty' });
  }
  if (prompt !== undefined && !prompt.trim()) {
    return res.status(400).json({ message: 'Prompt cannot be empty' });
  }
  if (agent_type !== undefined && !['drafting', 'summarization', 'citation'].includes(agent_type)) {
    return res.status(400).json({ message: "agent_type must be 'drafting', 'summarization' or 'citation'" });
  }

  try {
    const existing = await draftPool.query('SELECT * FROM agent_prompts WHERE id = $1', [id]);
    if (existing.rows.length === 0) {
      return res.status(404).json({ message: 'Agent prompt not found' });
    }

    const row = existing.rows[0];
    const nameVal = name !== undefined ? name.trim() : row.name;
    const promptVal = prompt !== undefined ? prompt.trim() : row.prompt;
    const existingIds = row.model_ids;
    const existingArr = Array.isArray(existingIds)
      ? existingIds
      : (typeof existingIds === 'string' ? JSON.parse(existingIds || '[]') : []);
    const modelIds = model_ids !== undefined
      ? (Array.isArray(model_ids) ? model_ids : [])
      : existingArr;
    const typeVal = agent_type !== undefined ? agent_type : row.agent_type;
    const existingParams = row.llm_parameters && typeof row.llm_parameters === 'object'
      ? row.llm_parameters
      : (typeof row.llm_parameters === 'string' ? (() => { try { return JSON.parse(row.llm_parameters || '{}'); } catch { return {}; } })() : {});
    const llmParams = llm_parameters !== undefined && llm_parameters !== null && typeof llm_parameters === 'object'
      ? llm_parameters
      : existingParams;
    // Keep list temperature and parameter temperature in sync: prefer explicit temperature, else from llm_parameters, else existing row
    const tempFromParams = llmParams.temperature != null && llmParams.temperature !== '' ? Number(llmParams.temperature) : null;
    const temp = temperature !== undefined ? Number(temperature) : (tempFromParams != null ? tempFromParams : (row.temperature ?? 0.7));
    // Ensure stored llm_parameters always has the same temperature as the column (single source of truth)
    const paramsToSave = { ...llmParams, temperature: temp };

    const result = await draftPool.query(
      `UPDATE agent_prompts 
       SET name = $1, prompt = $2, model_ids = $3, temperature = $4, agent_type = $5, llm_parameters = $6, updated_at = NOW() 
       WHERE id = $7 RETURNING *`,
      [nameVal, promptVal, JSON.stringify(modelIds), temp, typeVal, JSON.stringify(paramsToSave), id]
    );

    res.status(200).json({
      success: true,
      message: 'Agent prompt updated successfully',
      data: result.rows[0]
    });
  } catch (error) {
    console.error('Error updating agent prompt:', error.message);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

/**
 * @desc Delete an agent prompt by ID
 * @route DELETE /api/agent-prompts/:id
 */
const deleteAgentPrompt = async (req, res) => {
  const { id } = req.params;

  if (!id || isNaN(Number(id))) {
    return res.status(400).json({ message: 'Valid agent prompt ID is required' });
  }

  try {
    const result = await draftPool.query(
      'DELETE FROM agent_prompts WHERE id = $1 RETURNING *',
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Agent prompt not found' });
    }

    res.status(200).json({
      success: true,
      message: 'Agent prompt deleted successfully',
      data: result.rows[0]
    });
  } catch (error) {
    console.error('Error deleting agent prompt:', error.message);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

module.exports = {
  createAgentPrompt,
  getAllAgentPrompts,
  getAgentPromptById,
  updateAgentPrompt,
  deleteAgentPrompt
};
