const docPool = require('../config/docDB');

let configCache = null;
let cacheTimestamp = null;
const CACHE_TTL_MS = 60 * 1000;

const parseBool = (val) => {
  if (val === undefined || val === null || val === '') return null;
  if (typeof val === 'boolean') return val;
  if (val === 'true' || val === 1 || val === '1') return true;
  if (val === 'false' || val === 0 || val === '0') return false;
  return null;
};

const getConfig = async () => {
  const now = Date.now();
  if (configCache && cacheTimestamp && now - cacheTimestamp < CACHE_TTL_MS) {
    return configCache;
  }
  const result = await docPool.query(
    'SELECT * FROM summarization_chat_config ORDER BY id ASC LIMIT 1'
  );
  configCache = result.rows[0] || null;
  cacheTimestamp = now;
  return configCache;
};

const invalidateCache = () => {
  configCache = null;
  cacheTimestamp = null;
};

const validateSummarizationBody = (body, { requireAll = false } = {}) => {
  const {
    llm_model,
    llm_provider,
    model_temperature,
    max_output_tokens,
    streaming_delay,
    max_upload_files,
    max_file_size_mb,
    max_document_size_mb,
    max_document_pages,
    max_context_documents,
    embedding_provider,
    embedding_model,
    embedding_dimension,
    retrieval_top_k,
    use_hybrid_search,
    use_rrf,
    semantic_weight,
    keyword_weight,
    text_search_language,
    total_tokens_per_day,
    messages_per_hour,
    quota_chats_per_minute,
    chats_per_day,
    max_file_upload_per_day,
    max_conversation_history,
  } = body;

  const errors = [];
  const need = (key, val) => requireAll && (val === undefined || val === null || val === '');

  if (need('llm_model', llm_model)) errors.push('llm_model is required');
  else if (llm_model != null && llm_model !== '' && String(llm_model).length > 200)
    errors.push('llm_model is too long');

  if (need('llm_provider', llm_provider)) errors.push('llm_provider is required');
  else if (llm_provider != null && llm_provider !== '' && String(llm_provider).length > 100)
    errors.push('llm_provider must be at most 100 characters');

  if (need('model_temperature', model_temperature)) errors.push('model_temperature is required');
  else if (model_temperature != null && model_temperature !== '' && (isNaN(model_temperature) || Number(model_temperature) < 0 || Number(model_temperature) > 2))
    errors.push('model_temperature must be between 0 and 2');

  if (need('max_output_tokens', max_output_tokens)) errors.push('max_output_tokens is required');
  else if (max_output_tokens != null && max_output_tokens !== '' && (isNaN(max_output_tokens) || Number(max_output_tokens) < 1))
    errors.push('max_output_tokens must be a positive integer');

  if (need('streaming_delay', streaming_delay)) errors.push('streaming_delay is required');
  else if (streaming_delay != null && streaming_delay !== '' && (isNaN(streaming_delay) || Number(streaming_delay) < 0))
    errors.push('streaming_delay must be a non-negative integer');

  if (need('max_upload_files', max_upload_files)) errors.push('max_upload_files is required');
  else if (max_upload_files != null && max_upload_files !== '' && (isNaN(max_upload_files) || Number(max_upload_files) < 1))
    errors.push('max_upload_files must be a positive integer');

  if (need('max_file_size_mb', max_file_size_mb)) errors.push('max_file_size_mb is required');
  else if (max_file_size_mb != null && max_file_size_mb !== '' && (isNaN(max_file_size_mb) || Number(max_file_size_mb) < 1))
    errors.push('max_file_size_mb must be a positive integer');

  if (need('max_document_size_mb', max_document_size_mb)) errors.push('max_document_size_mb is required');
  else if (max_document_size_mb != null && max_document_size_mb !== '' && (isNaN(max_document_size_mb) || Number(max_document_size_mb) < 1))
    errors.push('max_document_size_mb must be a positive integer');

  if (need('max_document_pages', max_document_pages)) errors.push('max_document_pages is required');
  else if (max_document_pages != null && max_document_pages !== '' && (isNaN(max_document_pages) || Number(max_document_pages) < 1))
    errors.push('max_document_pages must be a positive integer');

  if (need('max_context_documents', max_context_documents)) errors.push('max_context_documents is required');
  else if (max_context_documents != null && max_context_documents !== '' && (isNaN(max_context_documents) || Number(max_context_documents) < 1))
    errors.push('max_context_documents must be a positive integer');

  if (need('embedding_provider', embedding_provider)) errors.push('embedding_provider is required');
  else if (embedding_provider != null && embedding_provider !== '' && String(embedding_provider).length > 100)
    errors.push('embedding_provider must be at most 100 characters');

  if (need('embedding_model', embedding_model)) errors.push('embedding_model is required');
  else if (embedding_model != null && embedding_model !== '' && String(embedding_model).length > 200)
    errors.push('embedding_model is too long');

  if (need('embedding_dimension', embedding_dimension)) errors.push('embedding_dimension is required');
  else if (embedding_dimension != null && embedding_dimension !== '' && (isNaN(embedding_dimension) || Number(embedding_dimension) < 1))
    errors.push('embedding_dimension must be a positive integer');

  if (need('retrieval_top_k', retrieval_top_k)) errors.push('retrieval_top_k is required');
  else if (retrieval_top_k != null && retrieval_top_k !== '' && (isNaN(retrieval_top_k) || Number(retrieval_top_k) < 1))
    errors.push('retrieval_top_k must be a positive integer');

  if (requireAll) {
    const hb = parseBool(use_hybrid_search);
    const rr = parseBool(use_rrf);
    if (hb === null) errors.push('use_hybrid_search is required (boolean)');
    if (rr === null) errors.push('use_rrf is required (boolean)');
  } else {
    if (use_hybrid_search !== undefined && use_hybrid_search !== null && use_hybrid_search !== '' && parseBool(use_hybrid_search) === null)
      errors.push('use_hybrid_search must be a boolean');
    if (use_rrf !== undefined && use_rrf !== null && use_rrf !== '' && parseBool(use_rrf) === null)
      errors.push('use_rrf must be a boolean');
  }

  if (need('semantic_weight', semantic_weight)) errors.push('semantic_weight is required');
  else if (semantic_weight != null && semantic_weight !== '' && (isNaN(semantic_weight) || Number(semantic_weight) < 0 || Number(semantic_weight) > 1))
    errors.push('semantic_weight must be between 0 and 1');

  if (need('keyword_weight', keyword_weight)) errors.push('keyword_weight is required');
  else if (keyword_weight != null && keyword_weight !== '' && (isNaN(keyword_weight) || Number(keyword_weight) < 0 || Number(keyword_weight) > 1))
    errors.push('keyword_weight must be between 0 and 1');

  if (need('text_search_language', text_search_language)) errors.push('text_search_language is required');
  else if (text_search_language != null && text_search_language !== '' && String(text_search_language).length > 50)
    errors.push('text_search_language must be at most 50 characters');

  if (need('total_tokens_per_day', total_tokens_per_day)) errors.push('total_tokens_per_day is required');
  else if (total_tokens_per_day != null && total_tokens_per_day !== '' && (isNaN(total_tokens_per_day) || Number(total_tokens_per_day) < 1))
    errors.push('total_tokens_per_day must be a positive integer');

  if (need('messages_per_hour', messages_per_hour)) errors.push('messages_per_hour is required');
  else if (messages_per_hour != null && messages_per_hour !== '' && (isNaN(messages_per_hour) || Number(messages_per_hour) < 1))
    errors.push('messages_per_hour must be a positive integer');

  if (need('quota_chats_per_minute', quota_chats_per_minute)) errors.push('quota_chats_per_minute is required');
  else if (quota_chats_per_minute != null && quota_chats_per_minute !== '' && (isNaN(quota_chats_per_minute) || Number(quota_chats_per_minute) < 1))
    errors.push('quota_chats_per_minute must be a positive integer');

  if (need('chats_per_day', chats_per_day)) errors.push('chats_per_day is required');
  else if (chats_per_day != null && chats_per_day !== '' && (isNaN(chats_per_day) || Number(chats_per_day) < 1))
    errors.push('chats_per_day must be a positive integer');

  if (need('max_file_upload_per_day', max_file_upload_per_day)) errors.push('max_file_upload_per_day is required');
  else if (max_file_upload_per_day != null && max_file_upload_per_day !== '' && (isNaN(max_file_upload_per_day) || Number(max_file_upload_per_day) < 1))
    errors.push('max_file_upload_per_day must be a positive integer');

  if (need('max_conversation_history', max_conversation_history)) errors.push('max_conversation_history is required');
  else if (max_conversation_history != null && max_conversation_history !== '' && (isNaN(max_conversation_history) || Number(max_conversation_history) < 1))
    errors.push('max_conversation_history must be a positive integer');

  return errors;
};

const numOrNull = (v) => {
  if (v === undefined || v === null || v === '') return null;
  const n = Number(v);
  return Number.isNaN(n) ? null : n;
};

const strOrNull = (v) => {
  if (v === undefined || v === null || v === '') return null;
  return String(v).trim();
};

const boolOrNull = (v) => {
  if (v === undefined || v === null || v === '') return null;
  return parseBool(v);
};

const getSummarizationChatConfig = async (req, res) => {
  try {
    const config = await getConfig();
    if (!config) {
      return res.status(404).json({ message: 'No summarization chat config found' });
    }
    res.status(200).json(config);
  } catch (error) {
    console.error('Error fetching summarization chat config:', error.message);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

const createSummarizationChatConfig = async (req, res) => {
  const errors = validateSummarizationBody(req.body, { requireAll: true });
  if (errors.length > 0) {
    return res.status(400).json({ message: 'Validation failed', errors });
  }

  const b = req.body;
  try {
    const countResult = await docPool.query('SELECT COUNT(*)::int AS c FROM summarization_chat_config');
    if (countResult.rows[0].c > 0) {
      return res.status(409).json({
        message: 'Summarization chat config already exists. Use PUT /api/admin/summarization-chat-config to update.',
      });
    }

    const updatedById = req.user?.id || null;

    const result = await docPool.query(
      `INSERT INTO summarization_chat_config (
        llm_model, llm_provider, model_temperature, max_output_tokens, streaming_delay,
        max_upload_files, max_file_size_mb,
        max_document_size_mb, max_document_pages, max_context_documents,
        embedding_provider, embedding_model, embedding_dimension, retrieval_top_k,
        use_hybrid_search, use_rrf, semantic_weight, keyword_weight, text_search_language,
        total_tokens_per_day, messages_per_hour, quota_chats_per_minute, chats_per_day,
        max_file_upload_per_day, max_conversation_history, updated_by, created_at, updated_at
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16,
        $17, $18, $19, $20, $21, $22, $23, $24, $25, $26, NOW(), NOW()
      )
      RETURNING *`,
      [
        String(b.llm_model).trim(),
        String(b.llm_provider).trim(),
        Number(b.model_temperature),
        Number(b.max_output_tokens),
        Number(b.streaming_delay),
        Number(b.max_upload_files),
        Number(b.max_file_size_mb),
        Number(b.max_document_size_mb),
        Number(b.max_document_pages),
        Number(b.max_context_documents),
        String(b.embedding_provider).trim(),
        String(b.embedding_model).trim(),
        Number(b.embedding_dimension),
        Number(b.retrieval_top_k),
        parseBool(b.use_hybrid_search),
        parseBool(b.use_rrf),
        Number(b.semantic_weight),
        Number(b.keyword_weight),
        String(b.text_search_language).trim(),
        Number(b.total_tokens_per_day),
        Number(b.messages_per_hour),
        Number(b.quota_chats_per_minute),
        Number(b.chats_per_day),
        Number(b.max_file_upload_per_day),
        Number(b.max_conversation_history),
        updatedById,
      ]
    );

    invalidateCache();
    res.status(201).json({
      message: 'Summarization chat config created successfully',
      data: result.rows[0],
    });
  } catch (error) {
    console.error('Error creating summarization chat config:', error.message);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

const updateSummarizationChatConfig = async (req, res) => {
  const errors = validateSummarizationBody(req.body, { requireAll: false });
  if (errors.length > 0) {
    return res.status(400).json({ message: 'Validation failed', errors });
  }

  const b = req.body;

  try {
    const updatedById = req.user?.id || null;

    const result = await docPool.query(
      `UPDATE summarization_chat_config SET
        llm_model                        = COALESCE($1,  llm_model),
        llm_provider                     = COALESCE($2,  llm_provider),
        model_temperature                = COALESCE($3,  model_temperature),
        max_output_tokens                = COALESCE($4,  max_output_tokens),
        streaming_delay                  = COALESCE($5,  streaming_delay),
        max_upload_files                 = COALESCE($6,  max_upload_files),
        max_file_size_mb                 = COALESCE($7,  max_file_size_mb),
        max_document_size_mb             = COALESCE($8, max_document_size_mb),
        max_document_pages               = COALESCE($9, max_document_pages),
        max_context_documents            = COALESCE($10, max_context_documents),
        embedding_provider               = COALESCE($11, embedding_provider),
        embedding_model                  = COALESCE($12, embedding_model),
        embedding_dimension              = COALESCE($13, embedding_dimension),
        retrieval_top_k                  = COALESCE($14, retrieval_top_k),
        use_hybrid_search                = COALESCE($15, use_hybrid_search),
        use_rrf                          = COALESCE($16, use_rrf),
        semantic_weight                  = COALESCE($17, semantic_weight),
        keyword_weight                   = COALESCE($18, keyword_weight),
        text_search_language             = COALESCE($19, text_search_language),
        total_tokens_per_day             = COALESCE($20, total_tokens_per_day),
        messages_per_hour                = COALESCE($21, messages_per_hour),
        quota_chats_per_minute           = COALESCE($22, quota_chats_per_minute),
        chats_per_day                    = COALESCE($23, chats_per_day),
        max_file_upload_per_day          = COALESCE($24, max_file_upload_per_day),
        max_conversation_history         = COALESCE($25, max_conversation_history),
        updated_by                       = $26,
        updated_at                       = NOW()
      WHERE id = (SELECT id FROM summarization_chat_config ORDER BY id ASC LIMIT 1)
      RETURNING *`,
      [
        strOrNull(b.llm_model),
        strOrNull(b.llm_provider),
        numOrNull(b.model_temperature),
        numOrNull(b.max_output_tokens),
        numOrNull(b.streaming_delay),
        numOrNull(b.max_upload_files),
        numOrNull(b.max_file_size_mb),
        numOrNull(b.max_document_size_mb),
        numOrNull(b.max_document_pages),
        numOrNull(b.max_context_documents),
        strOrNull(b.embedding_provider),
        strOrNull(b.embedding_model),
        numOrNull(b.embedding_dimension),
        numOrNull(b.retrieval_top_k),
        boolOrNull(b.use_hybrid_search),
        boolOrNull(b.use_rrf),
        numOrNull(b.semantic_weight),
        numOrNull(b.keyword_weight),
        strOrNull(b.text_search_language),
        numOrNull(b.total_tokens_per_day),
        numOrNull(b.messages_per_hour),
        numOrNull(b.quota_chats_per_minute),
        numOrNull(b.chats_per_day),
        numOrNull(b.max_file_upload_per_day),
        numOrNull(b.max_conversation_history),
        updatedById,
      ]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ message: 'No summarization chat config row found to update' });
    }

    invalidateCache();
    res.status(200).json({
      message: 'Summarization chat config updated successfully',
      data: result.rows[0],
    });
  } catch (error) {
    console.error('Error updating summarization chat config:', error.message);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

const deleteSummarizationChatConfig = async (req, res) => {
  try {
    const result = await docPool.query(
      'DELETE FROM summarization_chat_config WHERE id = (SELECT id FROM summarization_chat_config ORDER BY id ASC LIMIT 1) RETURNING *'
    );
    if (result.rowCount === 0) {
      return res.status(404).json({ message: 'No summarization chat config found to delete' });
    }
    invalidateCache();
    res.status(200).json({
      message: 'Summarization chat config deleted successfully',
      data: result.rows[0],
    });
  } catch (error) {
    console.error('Error deleting summarization chat config:', error.message);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

module.exports = {
  getSummarizationChatConfig,
  createSummarizationChatConfig,
  updateSummarizationChatConfig,
  deleteSummarizationChatConfig,
  getConfig,
  invalidateCache,
};
