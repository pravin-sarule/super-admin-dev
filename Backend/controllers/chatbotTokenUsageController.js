const aiDocumentPool = require('../config/aiDocumentDB');
const jwt = require('jsonwebtoken');
const { JWT_SECRET } = require('../config/env');

// Per-1M-token pricing in INR — two tiers: audio (live) models and text models
const AUDIO_COST_INR = {
  input:  parseFloat(process.env.COST_AUDIO_MODEL_INPUT_INR  || 282),
  output: parseFloat(process.env.COST_AUDIO_MODEL_OUTPUT_INR || 1129),
};
const TEXT_COST_INR = {
  input:  parseFloat(process.env.COST_TEXT_MODEL_INPUT_INR  || 28.33),
  output: parseFloat(process.env.COST_TEXT_MODEL_OUTPUT_INR || 236),
};

const AUDIO_MODELS = new Set([
  'gemini-3.1-flash-live-preview',
  'gemini-2.5-flash-native-audio-preview-12-2025',
]);

function calcCost(modelName, inputTokens, outputTokens) {
  const c = AUDIO_MODELS.has(modelName) ? AUDIO_COST_INR : TEXT_COST_INR;
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
  let totalCostInr = 0;

  const model_breakdown = breakdownRes.rows.map(r => {
    const cost = calcCost(r.model_name, r.total_input, r.total_output);
    totalCostInr += cost;
    return {
      model_name:    r.model_name,
      mode:          r.mode,
      request_count: parseInt(r.request_count),
      total_input:   parseInt(r.total_input),
      total_output:  parseInt(r.total_output),
      total_all:     parseInt(r.total_all),
      cost_inr:      parseFloat(cost.toFixed(6)),
    };
  });

  const logs = logsRes.rows.map(r => ({
    id:            r.id,
    session_id:    r.session_id,
    mode:          r.mode,
    model_name:    r.model_name,
    input_tokens:  r.input_tokens,
    output_tokens: r.output_tokens,
    total_tokens:  r.total_tokens,
    ip_address:    r.ip_address,
    created_at:    r.created_at,
    cost_inr:      parseFloat(calcCost(r.model_name, r.input_tokens, r.output_tokens).toFixed(6)),
  }));

  return {
    timestamp:    new Date().toISOString(),
    period,
    model_filter: modelFilter || 'all',
    totals: {
      total_input:     parseInt(t.total_input),
      total_output:    parseInt(t.total_output),
      total_all:       parseInt(t.total_all),
      total_requests:  parseInt(t.total_requests),
      total_cost_inr:  parseFloat(totalCostInr.toFixed(6)),
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
