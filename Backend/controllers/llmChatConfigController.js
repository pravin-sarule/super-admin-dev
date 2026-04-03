const docPool = require('../config/docDB');

// Simple in-memory cache — invalidated on admin update
let configCache = null;
let cacheTimestamp = null;
const CACHE_TTL_MS = 60 * 1000; // 1 minute

const getConfig = async () => {
  const now = Date.now();
  if (configCache && cacheTimestamp && now - cacheTimestamp < CACHE_TTL_MS) {
    return configCache;
  }
  const result = await docPool.query(
    'SELECT * FROM llm_chat_config ORDER BY id ASC LIMIT 1'
  );
  configCache = result.rows[0] || null;
  cacheTimestamp = now;
  return configCache;
};

const invalidateCache = () => {
  configCache = null;
  cacheTimestamp = null;
};

const validateChatConfigBody = (body, { requireAll = false } = {}) => {
  const {
    max_output_tokens,
    total_tokens_per_day,
    llm_model,
    llm_provider,
    model_temperature,
    messages_per_hour,
    quota_chats_per_minute,
    chats_per_day,
    max_document_pages,
    max_document_size_mb,
    max_file_upload_per_day,
    max_upload_files,
    streaming_delay,
  } = body;

  const errors = [];

  const need = (key, val) => requireAll && (val === undefined || val === null || val === '');

  if (need('max_output_tokens', max_output_tokens))
    errors.push('max_output_tokens is required');
  else if (max_output_tokens != null && max_output_tokens !== '' && (isNaN(max_output_tokens) || Number(max_output_tokens) < 1))
    errors.push('max_output_tokens must be a positive integer');

  if (need('total_tokens_per_day', total_tokens_per_day))
    errors.push('total_tokens_per_day is required');
  else if (total_tokens_per_day != null && total_tokens_per_day !== '' && (isNaN(total_tokens_per_day) || Number(total_tokens_per_day) < 1))
    errors.push('total_tokens_per_day must be a positive integer');

  if (need('llm_model', llm_model)) errors.push('llm_model is required');
  else if (llm_model != null && llm_model !== '' && typeof llm_model === 'string' && llm_model.length > 200)
    errors.push('llm_model is too long');

  if (need('llm_provider', llm_provider))
    errors.push('llm_provider is required');
  else if (llm_provider != null && llm_provider !== '' && typeof llm_provider === 'string' && llm_provider.length > 100)
    errors.push('llm_provider must be at most 100 characters');

  if (need('model_temperature', model_temperature))
    errors.push('model_temperature is required');
  else if (model_temperature != null && model_temperature !== '' && (isNaN(model_temperature) || Number(model_temperature) < 0 || Number(model_temperature) > 2))
    errors.push('model_temperature must be between 0 and 2');

  if (need('messages_per_hour', messages_per_hour))
    errors.push('messages_per_hour is required');
  else if (messages_per_hour != null && messages_per_hour !== '' && (isNaN(messages_per_hour) || Number(messages_per_hour) < 1))
    errors.push('messages_per_hour must be a positive integer');

  if (need('quota_chats_per_minute', quota_chats_per_minute))
    errors.push('quota_chats_per_minute is required');
  else if (quota_chats_per_minute != null && quota_chats_per_minute !== '' && (isNaN(quota_chats_per_minute) || Number(quota_chats_per_minute) < 1))
    errors.push('quota_chats_per_minute must be a positive integer');

  if (need('chats_per_day', chats_per_day))
    errors.push('chats_per_day is required');
  else if (chats_per_day != null && chats_per_day !== '' && (isNaN(chats_per_day) || Number(chats_per_day) < 1))
    errors.push('chats_per_day must be a positive integer');

  if (need('max_document_pages', max_document_pages))
    errors.push('max_document_pages is required');
  else if (max_document_pages != null && max_document_pages !== '' && (isNaN(max_document_pages) || Number(max_document_pages) < 1))
    errors.push('max_document_pages must be a positive integer');

  if (need('max_document_size_mb', max_document_size_mb))
    errors.push('max_document_size_mb is required');
  else if (max_document_size_mb != null && max_document_size_mb !== '' && (isNaN(max_document_size_mb) || Number(max_document_size_mb) < 1))
    errors.push('max_document_size_mb must be a positive integer');

  if (need('max_file_upload_per_day', max_file_upload_per_day))
    errors.push('max_file_upload_per_day is required');
  else if (max_file_upload_per_day != null && max_file_upload_per_day !== '' && (isNaN(max_file_upload_per_day) || Number(max_file_upload_per_day) < 1))
    errors.push('max_file_upload_per_day must be a positive integer');

  if (need('max_upload_files', max_upload_files))
    errors.push('max_upload_files is required');
  else if (max_upload_files != null && max_upload_files !== '' && (isNaN(max_upload_files) || Number(max_upload_files) < 1))
    errors.push('max_upload_files must be a positive integer');

  if (need('streaming_delay', streaming_delay))
    errors.push('streaming_delay is required');
  else if (streaming_delay != null && streaming_delay !== '' && (isNaN(streaming_delay) || Number(streaming_delay) < 0))
    errors.push('streaming_delay must be a non-negative integer');

  return errors;
};

const getLlmChatConfig = async (req, res) => {
  try {
    const config = await getConfig();
    if (!config) {
      return res.status(404).json({ message: 'No chat config found' });
    }
    res.status(200).json(config);
  } catch (error) {
    console.error('Error fetching LLM chat config:', error.message);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

/** POST — create the singleton config row (only when table has no rows) */
const createLlmChatConfig = async (req, res) => {
  const errors = validateChatConfigBody(req.body, { requireAll: true });
  if (errors.length > 0) {
    return res.status(400).json({ message: 'Validation failed', errors });
  }

  const {
    max_output_tokens,
    total_tokens_per_day,
    llm_model,
    llm_provider,
    model_temperature,
    messages_per_hour,
    quota_chats_per_minute,
    chats_per_day,
    max_document_pages,
    max_document_size_mb,
    max_file_upload_per_day,
    max_upload_files,
    streaming_delay,
  } = req.body;

  try {
    const countResult = await docPool.query('SELECT COUNT(*)::int AS c FROM llm_chat_config');
    if (countResult.rows[0].c > 0) {
      return res.status(409).json({
        message: 'Chat config already exists. Use PUT /api/admin/llm-config to update.',
      });
    }

    const updatedById = req.user?.id || null;

    const result = await docPool.query(
      `INSERT INTO llm_chat_config (
        max_output_tokens, total_tokens_per_day, llm_model, llm_provider, model_temperature,
        messages_per_hour, quota_chats_per_minute, chats_per_day,
        max_document_pages, max_document_size_mb, max_file_upload_per_day,
        max_upload_files, streaming_delay, updated_by, created_at, updated_at
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, NOW(), NOW()
      )
      RETURNING *`,
      [
        Number(max_output_tokens),
        Number(total_tokens_per_day),
        String(llm_model).trim(),
        String(llm_provider).trim(),
        Number(model_temperature),
        Number(messages_per_hour),
        Number(quota_chats_per_minute),
        Number(chats_per_day),
        Number(max_document_pages),
        Number(max_document_size_mb),
        Number(max_file_upload_per_day),
        Number(max_upload_files),
        Number(streaming_delay),
        updatedById,
      ]
    );

    invalidateCache();
    res.status(201).json({
      message: 'LLM chat config created successfully',
      data: result.rows[0],
    });
  } catch (error) {
    console.error('Error creating LLM chat config:', error.message);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

const updateLlmChatConfig = async (req, res) => {
  const errors = validateChatConfigBody(req.body, { requireAll: false });
  if (errors.length > 0) {
    return res.status(400).json({ message: 'Validation failed', errors });
  }

  const {
    max_output_tokens,
    total_tokens_per_day,
    llm_model,
    llm_provider,
    model_temperature,
    messages_per_hour,
    quota_chats_per_minute,
    chats_per_day,
    max_document_pages,
    max_document_size_mb,
    max_file_upload_per_day,
    max_upload_files,
    streaming_delay,
  } = req.body;

  try {
    const updatedById = req.user?.id || null;

    const result = await docPool.query(
      `UPDATE llm_chat_config SET
        max_output_tokens       = COALESCE($1,  max_output_tokens),
        total_tokens_per_day    = COALESCE($2,  total_tokens_per_day),
        llm_model               = COALESCE($3,  llm_model),
        llm_provider            = COALESCE($4,  llm_provider),
        model_temperature       = COALESCE($5,  model_temperature),
        messages_per_hour       = COALESCE($6,  messages_per_hour),
        quota_chats_per_minute  = COALESCE($7,  quota_chats_per_minute),
        chats_per_day           = COALESCE($8,  chats_per_day),
        max_document_pages      = COALESCE($9,  max_document_pages),
        max_document_size_mb    = COALESCE($10, max_document_size_mb),
        max_file_upload_per_day = COALESCE($11, max_file_upload_per_day),
        max_upload_files        = COALESCE($12, max_upload_files),
        streaming_delay         = COALESCE($13, streaming_delay),
        updated_by              = $14,
        updated_at              = NOW()
      WHERE id = (SELECT id FROM llm_chat_config ORDER BY id ASC LIMIT 1)
      RETURNING *`,
      [
        max_output_tokens != null && max_output_tokens !== '' ? Number(max_output_tokens) : null,
        total_tokens_per_day != null && total_tokens_per_day !== '' ? Number(total_tokens_per_day) : null,
        llm_model != null && llm_model !== '' ? String(llm_model).trim() : null,
        llm_provider != null && llm_provider !== '' ? String(llm_provider).trim() : null,
        model_temperature != null && model_temperature !== '' ? Number(model_temperature) : null,
        messages_per_hour != null && messages_per_hour !== '' ? Number(messages_per_hour) : null,
        quota_chats_per_minute != null && quota_chats_per_minute !== '' ? Number(quota_chats_per_minute) : null,
        chats_per_day != null && chats_per_day !== '' ? Number(chats_per_day) : null,
        max_document_pages != null && max_document_pages !== '' ? Number(max_document_pages) : null,
        max_document_size_mb != null && max_document_size_mb !== '' ? Number(max_document_size_mb) : null,
        max_file_upload_per_day != null && max_file_upload_per_day !== '' ? Number(max_file_upload_per_day) : null,
        max_upload_files != null && max_upload_files !== '' ? Number(max_upload_files) : null,
        streaming_delay != null && streaming_delay !== '' ? Number(streaming_delay) : null,
        updatedById,
      ]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ message: 'No config row found to update' });
    }

    invalidateCache();
    res.status(200).json({
      message: 'LLM chat config updated successfully',
      data: result.rows[0],
    });
  } catch (error) {
    console.error('Error updating LLM chat config:', error.message);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

/** DELETE — remove the config row (admins can recreate via POST) */
const deleteLlmChatConfig = async (req, res) => {
  try {
    const result = await docPool.query(
      'DELETE FROM llm_chat_config WHERE id = (SELECT id FROM llm_chat_config ORDER BY id ASC LIMIT 1) RETURNING *'
    );
    if (result.rowCount === 0) {
      return res.status(404).json({ message: 'No chat config found to delete' });
    }
    invalidateCache();
    res.status(200).json({
      message: 'LLM chat config deleted successfully',
      data: result.rows[0],
    });
  } catch (error) {
    console.error('Error deleting LLM chat config:', error.message);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

module.exports = {
  getLlmChatConfig,
  createLlmChatConfig,
  updateLlmChatConfig,
  deleteLlmChatConfig,
  getConfig,
  invalidateCache,
};
