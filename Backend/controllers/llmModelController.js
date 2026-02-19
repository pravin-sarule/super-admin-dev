// controllers/llmController.js
const pool = require('../config/docDB'); // import your db pool

// Get all LLM models
const getAllLLMModels = async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM llm_models ORDER BY id ASC');
    res.status(200).json(result.rows);
  } catch (error) {
    console.error('Error fetching LLM models:', error.message);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// Add a new LLM model
const addLLMModel = async (req, res) => {
  const { name, is_active } = req.body;

  if (!name) {
    return res.status(400).json({ message: 'Model name is required' });
  }

  try {
    const result = await pool.query(
      'INSERT INTO llm_models (name, is_active) VALUES ($1, $2) RETURNING *',
      [name, is_active ?? true]
    );

    res.status(201).json({ message: 'LLM model added successfully', model: result.rows[0] });
  } catch (error) {
    console.error('Error adding LLM model:', error.message);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// Create a new LLM max token configuration
const createMaxTokenEntry = async (req, res) => {
  const { model_id, provider, model_name, max_output_tokens } = req.body;

  if (!model_id || !provider || !model_name || max_output_tokens === undefined) {
    return res.status(400).json({
      message: 'model_id, provider, model_name, and max_output_tokens are required',
    });
  }

  const parsedModelId = parseInt(model_id, 10);
  if (Number.isNaN(parsedModelId) || parsedModelId <= 0) {
    return res.status(400).json({ message: 'model_id must be a positive integer' });
  }

  const parsedTokens = parseInt(max_output_tokens, 10);
  if (Number.isNaN(parsedTokens) || parsedTokens <= 0) {
    return res.status(400).json({ message: 'max_output_tokens must be a positive integer' });
  }

  try {
    const modelExists = await pool.query('SELECT id FROM llm_models WHERE id = $1', [parsedModelId]);
    if (modelExists.rowCount === 0) {
      return res.status(400).json({ message: 'LLM model not found for the given model_id' });
    }

    const result = await pool.query(
      `
        INSERT INTO llm_max_tokens (model_id, provider, model_name, max_output_tokens)
        VALUES ($1, $2, $3, $4)
        RETURNING *
      `,
      [parsedModelId, provider.trim(), model_name.trim(), parsedTokens]
    );

    res.status(201).json({
      message: 'LLM max token entry created successfully',
      data: result.rows[0],
    });
  } catch (error) {
    console.error('Error creating LLM max token entry:', error.message);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// Get all LLM max token configurations
const getAllMaxTokenEntries = async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT mt.*, lm.name AS llm_model_name
      FROM llm_max_tokens mt
      LEFT JOIN llm_models lm ON mt.model_id = lm.id
      ORDER BY mt.id ASC
    `);

    res.status(200).json(result.rows);
  } catch (error) {
    console.error('Error fetching LLM max tokens:', error.message);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// Update a single LLM max token entry
const updateMaxTokenEntry = async (req, res) => {
  const { id } = req.params;
  const { provider, model_name, max_output_tokens } = req.body;

  if (!id || Number.isNaN(Number(id))) {
    return res.status(400).json({ message: 'Valid entry id is required' });
  }

  if (!provider || !model_name || max_output_tokens === undefined) {
    return res.status(400).json({ message: 'Provider, model name, and max tokens are required' });
  }

  const parsedTokens = parseInt(max_output_tokens, 10);
  if (Number.isNaN(parsedTokens) || parsedTokens <= 0) {
    return res.status(400).json({ message: 'max_output_tokens must be a positive number' });
  }

  try {
    const result = await pool.query(
      `
        UPDATE llm_max_tokens
        SET provider = $1,
            model_name = $2,
            max_output_tokens = $3,
            updated_at = NOW()
        WHERE id = $4
        RETURNING *
      `,
      [provider.trim(), model_name.trim(), parsedTokens, id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'LLM max token entry not found' });
    }

    res.status(200).json({
      message: 'LLM max token entry updated successfully',
      data: result.rows[0],
    });
  } catch (error) {
    console.error('Error updating LLM max token entry:', error.message);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// Get LLM model parameters (creates default row if none)
const getModelParameters = async (req, res) => {
  const modelId = parseInt(req.params.id, 10);
  if (Number.isNaN(modelId) || modelId <= 0) {
    return res.status(400).json({ message: 'Valid model id is required' });
  }

  try {
    const modelResult = await pool.query('SELECT id, name FROM llm_models WHERE id = $1', [modelId]);
    if (modelResult.rows.length === 0) {
      return res.status(404).json({ message: 'LLM model not found' });
    }

    const paramResult = await pool.query(
      'SELECT * FROM llm_model_parameters WHERE model_id = $1',
      [modelId]
    );

    const defaults = {
      temperature: 1,
      media_resolution: 'default',
      thinking_mode: false,
      thinking_budget: false,
      thinking_level: 'default',
      structured_outputs_enabled: false,
      structured_outputs_config: {},
      code_execution: false,
      function_calling_enabled: false,
      function_calling_config: {},
      grounding_google_search: false,
      url_context: false,
      system_instructions: '',
      api_key_status: 'none',
    };

    if (paramResult.rows.length === 0) {
      return res.status(200).json({
        model_id: modelId,
        model_name: modelResult.rows[0].name,
        ...defaults,
      });
    }

    const row = paramResult.rows[0];
    res.status(200).json({
      model_id: row.model_id,
      model_name: modelResult.rows[0].name,
      id: row.id,
      temperature: Number(row.temperature) ?? defaults.temperature,
      media_resolution: row.media_resolution ?? defaults.media_resolution,
      thinking_mode: !!row.thinking_mode,
      thinking_budget: !!row.thinking_budget,
      thinking_level: row.thinking_level ?? defaults.thinking_level,
      structured_outputs_enabled: !!row.structured_outputs_enabled,
      structured_outputs_config: row.structured_outputs_config || {},
      code_execution: !!row.code_execution,
      function_calling_enabled: !!row.function_calling_enabled,
      function_calling_config: row.function_calling_config || {},
      grounding_google_search: !!row.grounding_google_search,
      url_context: !!row.url_context,
      system_instructions: row.system_instructions ?? '',
      api_key_status: row.api_key_status ?? defaults.api_key_status,
      updated_at: row.updated_at,
    });
  } catch (error) {
    console.error('Error fetching LLM parameters:', error.message);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// Upsert LLM model parameters
const updateModelParameters = async (req, res) => {
  const modelId = parseInt(req.params.id, 10);
  if (Number.isNaN(modelId) || modelId <= 0) {
    return res.status(400).json({ message: 'Valid model id is required' });
  }

  const {
    temperature,
    media_resolution,
    thinking_mode,
    thinking_budget,
    thinking_level,
    structured_outputs_enabled,
    structured_outputs_config,
    code_execution,
    function_calling_enabled,
    function_calling_config,
    grounding_google_search,
    url_context,
    system_instructions,
    api_key_status,
  } = req.body;

  try {
    const modelExists = await pool.query('SELECT id, name FROM llm_models WHERE id = $1', [modelId]);
    if (modelExists.rows.length === 0) {
      return res.status(404).json({ message: 'LLM model not found' });
    }

    const temp = temperature != null ? Math.min(2, Math.max(0, Number(temperature))) : 1;
    const result = await pool.query(
      `
      INSERT INTO llm_model_parameters (
        model_id, temperature, media_resolution, thinking_mode, thinking_budget, thinking_level,
        structured_outputs_enabled, structured_outputs_config, code_execution,
        function_calling_enabled, function_calling_config, grounding_google_search, url_context,
        system_instructions, api_key_status, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, NOW())
      ON CONFLICT (model_id) DO UPDATE SET
        temperature = EXCLUDED.temperature,
        media_resolution = EXCLUDED.media_resolution,
        thinking_mode = EXCLUDED.thinking_mode,
        thinking_budget = EXCLUDED.thinking_budget,
        thinking_level = EXCLUDED.thinking_level,
        structured_outputs_enabled = EXCLUDED.structured_outputs_enabled,
        structured_outputs_config = EXCLUDED.structured_outputs_config,
        code_execution = EXCLUDED.code_execution,
        function_calling_enabled = EXCLUDED.function_calling_enabled,
        function_calling_config = EXCLUDED.function_calling_config,
        grounding_google_search = EXCLUDED.grounding_google_search,
        url_context = EXCLUDED.url_context,
        system_instructions = EXCLUDED.system_instructions,
        api_key_status = EXCLUDED.api_key_status,
        updated_at = NOW()
      RETURNING *
      `,
      [
        modelId,
        temp,
        media_resolution || 'default',
        !!thinking_mode,
        !!thinking_budget,
        thinking_level || 'default',
        !!structured_outputs_enabled,
        JSON.stringify(structured_outputs_config || {}),
        !!code_execution,
        !!function_calling_enabled,
        JSON.stringify(function_calling_config || {}),
        !!grounding_google_search,
        !!url_context,
        system_instructions ?? '',
        api_key_status || 'none',
      ]
    );

    const row = result.rows[0];
    res.status(200).json({
      message: 'Parameters updated successfully',
      data: {
        model_id: row.model_id,
        temperature: Number(row.temperature),
        media_resolution: row.media_resolution,
        thinking_mode: !!row.thinking_mode,
        thinking_budget: !!row.thinking_budget,
        thinking_level: row.thinking_level,
        structured_outputs_enabled: !!row.structured_outputs_enabled,
        structured_outputs_config: row.structured_outputs_config || {},
        code_execution: !!row.code_execution,
        function_calling_enabled: !!row.function_calling_enabled,
        function_calling_config: row.function_calling_config || {},
        grounding_google_search: !!row.grounding_google_search,
        url_context: !!row.url_context,
        system_instructions: row.system_instructions ?? '',
        api_key_status: row.api_key_status,
        updated_at: row.updated_at,
      },
    });
  } catch (error) {
    console.error('Error updating LLM parameters:', error.message);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

module.exports = {
  getAllLLMModels,
  addLLMModel,
  createMaxTokenEntry,
  getAllMaxTokenEntries,
  updateMaxTokenEntry,
  getModelParameters,
  updateModelParameters,
};
