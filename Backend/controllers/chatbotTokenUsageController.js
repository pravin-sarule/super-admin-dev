const aiDocumentPool = require('../config/aiDocumentDB');
const jwt = require('jsonwebtoken');
const { JWT_SECRET } = require('../config/env');

// Per-1M-token pricing (USD) loaded from .env with sensible defaults
const MODEL_COSTS = {
  'gemini-1.5-flash': {
    input:  parseFloat(process.env.COST_GEMINI_1_5_FLASH_INPUT  || 0.075),
    output: parseFloat(process.env.COST_GEMINI_1_5_FLASH_OUTPUT || 0.30),
  },
  'gemini-1.5-flash-8b': {
    input:  parseFloat(process.env.COST_GEMINI_1_5_FLASH_8B_INPUT  || 0.0375),
    output: parseFloat(process.env.COST_GEMINI_1_5_FLASH_8B_OUTPUT || 0.15),
  },
  'gemini-1.5-pro': {
    input:  parseFloat(process.env.COST_GEMINI_1_5_PRO_INPUT  || 1.25),
    output: parseFloat(process.env.COST_GEMINI_1_5_PRO_OUTPUT || 5.00),
  },
  'gemini-2.0-flash': {
    input:  parseFloat(process.env.COST_GEMINI_2_0_FLASH_INPUT  || 0.10),
    output: parseFloat(process.env.COST_GEMINI_2_0_FLASH_OUTPUT || 0.40),
  },
  'gemini-2.5-flash': {
    input:  parseFloat(process.env.COST_GEMINI_2_5_FLASH_INPUT  || 0.15),
    output: parseFloat(process.env.COST_GEMINI_2_5_FLASH_OUTPUT || 0.60),
  },
  'gemini-2.5-pro': {
    input:  parseFloat(process.env.COST_GEMINI_2_5_PRO_INPUT  || 1.25),
    output: parseFloat(process.env.COST_GEMINI_2_5_PRO_OUTPUT || 10.00),
  },
  'gemini-3.1-flash-live-preview': {
    input:  parseFloat(process.env.COST_GEMINI_LIVE_INPUT  || 0.10),
    output: parseFloat(process.env.COST_GEMINI_LIVE_OUTPUT || 0.40),
  },
  'gemini-2.5-flash-native-audio-preview-12-2025': {
    input:  parseFloat(process.env.COST_GEMINI_2_5_FLASH_AUDIO_INPUT  || 0.15),
    output: parseFloat(process.env.COST_GEMINI_2_5_FLASH_AUDIO_OUTPUT || 0.60),
  },
};

function calcCost(modelName, inputTokens, outputTokens) {
  const c = MODEL_COSTS[modelName] || { input: 0, output: 0 };
  return (parseInt(inputTokens) / 1_000_000) * c.input +
         (parseInt(outputTokens) / 1_000_000) * c.output;
}

function getPeriodStart(period) {
  const now = Date.now();
  switch (period) {
    case 'daily':   return new Date(now - 1   * 24 * 60 * 60 * 1000);
    case 'weekly':  return new Date(now - 7   * 24 * 60 * 60 * 1000);
    case 'monthly': return new Date(now - 30  * 24 * 60 * 60 * 1000);
    case 'yearly':  return new Date(now - 365 * 24 * 60 * 60 * 1000);
    default:        return new Date(0);
  }
}

async function buildAnalyticsPayload(period = 'daily', model = 'all') {
  const startDate  = getPeriodStart(period);
  const modelFilter = model && model !== 'all' ? model : null;
  const params     = modelFilter ? [startDate, modelFilter] : [startDate];
  const modelClause = modelFilter ? 'AND model_name = $2' : '';

  const [totalsRes, breakdownRes, logsRes] = await Promise.all([
    aiDocumentPool.query(
      `SELECT
         COALESCE(SUM(input_tokens),  0) AS total_input,
         COALESCE(SUM(output_tokens), 0) AS total_output,
         COALESCE(SUM(total_tokens),  0) AS total_all,
         COUNT(*)                         AS total_requests
       FROM chatbot_token_usage
       WHERE created_at >= $1 ${modelClause}`,
      params
    ),
    aiDocumentPool.query(
      `SELECT
         model_name, mode,
         COUNT(*)                         AS request_count,
         COALESCE(SUM(input_tokens),  0)  AS total_input,
         COALESCE(SUM(output_tokens), 0)  AS total_output,
         COALESCE(SUM(total_tokens),  0)  AS total_all
       FROM chatbot_token_usage
       WHERE created_at >= $1 ${modelClause}
       GROUP BY model_name, mode
       ORDER BY total_all DESC`,
      params
    ),
    aiDocumentPool.query(
      `SELECT id, session_id, mode, model_name,
              input_tokens, output_tokens, total_tokens,
              ip_address, created_at
       FROM chatbot_token_usage
       WHERE created_at >= $1 ${modelClause}
       ORDER BY created_at DESC
       LIMIT 200`,
      params
    ),
  ]);

  const t = totalsRes.rows[0];
  let totalCostUsd = 0;

  const model_breakdown = breakdownRes.rows.map(r => {
    const cost = calcCost(r.model_name, r.total_input, r.total_output);
    totalCostUsd += cost;
    return {
      model_name:    r.model_name,
      mode:          r.mode,
      request_count: parseInt(r.request_count),
      total_input:   parseInt(r.total_input),
      total_output:  parseInt(r.total_output),
      total_all:     parseInt(r.total_all),
      cost_usd:      parseFloat(cost.toFixed(8)),
    };
  });

  const logs = logsRes.rows.map(r => ({
    id:           r.id,
    session_id:   r.session_id,
    mode:         r.mode,
    model_name:   r.model_name,
    input_tokens: r.input_tokens,
    output_tokens: r.output_tokens,
    total_tokens: r.total_tokens,
    ip_address:   r.ip_address,
    created_at:   r.created_at,
    cost_usd:     parseFloat(calcCost(r.model_name, r.input_tokens, r.output_tokens).toFixed(8)),
  }));

  return {
    timestamp:    new Date().toISOString(),
    period,
    model_filter: modelFilter || 'all',
    totals: {
      total_input:    parseInt(t.total_input),
      total_output:   parseInt(t.total_output),
      total_all:      parseInt(t.total_all),
      total_requests: parseInt(t.total_requests),
      total_cost_usd: parseFloat(totalCostUsd.toFixed(8)),
    },
    model_breakdown,
    logs,
  };
}

// GET /api/admin/chatbot-token-usage/stats  (requires adminAuth)
const getStats = async (req, res) => {
  try {
    const { period = 'daily', model = 'all' } = req.query;
    const data = await buildAnalyticsPayload(period, model);
    res.json({ success: true, data });
  } catch (err) {
    console.error('chatbot-token-usage stats error:', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
};

// GET /api/admin/chatbot-token-usage/stream  (SSE — token passed as ?token=)
const getStream = async (req, res) => {
  // EventSource cannot send Authorization headers, so we verify from query string
  const tokenParam = req.query.token;
  if (!tokenParam) {
    return res.status(401).json({ success: false, error: 'Token required' });
  }

  let authorized = false;
  const adminToken = process.env.ADMIN_TOKEN;

  if (adminToken && tokenParam === adminToken) {
    authorized = true;
  } else if (JWT_SECRET) {
    try {
      jwt.verify(tokenParam, JWT_SECRET);
      authorized = true;
    } catch { /* invalid */ }
  }

  if (!authorized) {
    return res.status(403).json({ success: false, error: 'Invalid or expired token' });
  }

  const { period = 'daily', model = 'all' } = req.query;

  res.setHeader('Content-Type',  'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection',    'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no'); // disable nginx buffering

  if (res.flushHeaders) res.flushHeaders();

  const send = async () => {
    try {
      const data = await buildAnalyticsPayload(period, model);
      res.write(`data: ${JSON.stringify({ success: true, data })}\n\n`);
    } catch (err) {
      res.write(`data: ${JSON.stringify({ success: false, error: err.message })}\n\n`);
    }
  };

  await send(); // immediate first push
  const interval = setInterval(send, 10_000); // push every 10 seconds

  req.on('close', () => {
    clearInterval(interval);
    res.end();
  });
};

module.exports = { getStats, getStream };
