/**
 * Repository for Jurinex voice call history and analytics.
 *
 * The call agent owns the core tables (`calls`, `call_messages`,
 * `call_debug_events`, ...). This admin module reads those tables and, when
 * available, overlays optional admin enrichment fields from
 * `voice_call_enrichments`.
 */
const pool = require('../db/jurinexVoiceDB');

const UUID_RE =
  "'^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$'";

let enrichmentTableExistsCache = null;

const clampLimit = (limit, fallback = 50, max = 500) =>
  Math.min(Math.max(Number(limit) || fallback, 1), max);

const clampOffset = (offset) => Math.max(Number(offset) || 0, 0);

const normaliseDate = (value, fallback) => {
  const d = value ? new Date(value) : fallback;
  return Number.isNaN(d.getTime()) ? fallback : d;
};

const getRange = ({ start_date, end_date } = {}) => {
  const now = new Date();
  const fallbackStart = new Date(now);
  fallbackStart.setDate(now.getDate() - 30);
  fallbackStart.setHours(0, 0, 0, 0);

  const start = normaliseDate(start_date, fallbackStart);
  const endInput = normaliseDate(end_date, now);
  const end = new Date(endInput);

  // Date-only values should be inclusive through the selected day.
  if (/^\d{4}-\d{2}-\d{2}$/.test(String(end_date || ''))) {
    end.setDate(end.getDate() + 1);
    end.setHours(0, 0, 0, 0);
  }

  return { start, end };
};

const hasEnrichmentTable = async () => {
  if (enrichmentTableExistsCache !== null) return enrichmentTableExistsCache;
  const { rows } = await pool.query(
    `SELECT EXISTS (
       SELECT 1
         FROM information_schema.tables
        WHERE table_schema = current_schema()
          AND table_name = 'voice_call_enrichments'
     ) AS ok`
  );
  enrichmentTableExistsCache = Boolean(rows[0]?.ok);
  return enrichmentTableExistsCache;
};

const buildFilters = (filters = {}, { hasEnrichment = false } = {}) => {
  const { start, end } = getRange(filters);
  const values = [start.toISOString(), end.toISOString()];
  const where = [`c.started_at >= $1::timestamptz`, `c.started_at < $2::timestamptz`];

  if (filters.direction) {
    values.push(filters.direction);
    where.push(`c.direction::text = $${values.length}`);
  }

  if (filters.status) {
    values.push(filters.status);
    where.push(`c.status::text = $${values.length}`);
  }

  if (filters.agent_id && hasEnrichment) {
    values.push(filters.agent_id);
    where.push(`vce.agent_id = $${values.length}::uuid`);
  }

  if (filters.outcome && hasEnrichment) {
    values.push(String(filters.outcome).toLowerCase());
    where.push(`LOWER(COALESCE(vce.session_outcome, c.resolution_status::text, 'unknown')) = $${values.length}`);
  } else if (filters.outcome) {
    values.push(String(filters.outcome).toLowerCase());
    where.push(`LOWER(COALESCE(c.resolution_status::text, 'unknown')) = $${values.length}`);
  }

  if (filters.sentiment && hasEnrichment) {
    values.push(String(filters.sentiment).toLowerCase());
    where.push(`LOWER(COALESCE(c.sentiment, vce.analysis->>'user_sentiment', 'unknown')) = $${values.length}`);
  } else if (filters.sentiment) {
    values.push(String(filters.sentiment).toLowerCase());
    where.push(`LOWER(COALESCE(c.sentiment, 'unknown')) = $${values.length}`);
  }

  if (filters.search) {
    values.push(`%${String(filters.search).trim()}%`);
    where.push(`(
      c.id::text ILIKE $${values.length}
      OR c.twilio_call_sid ILIKE $${values.length}
      OR c.customer_phone ILIKE $${values.length}
      OR c.summary ILIKE $${values.length}
      OR c.raw_metadata::text ILIKE $${values.length}
    )`);
  }

  return { where: where.join(' AND '), values, start, end };
};

const nullableEnrichmentSelect = (hasEnrichment) => {
  if (hasEnrichment) {
    return {
      join: `LEFT JOIN voice_call_enrichments vce ON vce.call_id = c.id`,
      select: `
        vce.agent_id,
        vce.agent_name,
        vce.agent_version,
        vce.channel_type,
        vce.session_outcome,
        vce.end_reason,
        vce.end_to_end_latency_ms,
        vce.average_latency_ms,
        vce.llm_token_count,
        vce.cost_usd,
        vce.preferred_language,
        vce.successful,
        vce.picked_up,
        vce.transfer_requested,
        vce.voicemail,
        vce.recording_url,
        vce.recording_gcs_uri,
        vce.custom_attributes,
        vce.analysis
      `,
    };
  }

  return {
    join: '',
    select: `
      NULL::uuid AS agent_id,
      NULL::text AS agent_name,
      NULL::text AS agent_version,
      NULL::text AS channel_type,
      NULL::text AS session_outcome,
      NULL::text AS end_reason,
      NULL::int AS end_to_end_latency_ms,
      NULL::int AS average_latency_ms,
      NULL::int AS llm_token_count,
      NULL::numeric AS cost_usd,
      NULL::text AS preferred_language,
      NULL::boolean AS successful,
      NULL::boolean AS picked_up,
      NULL::boolean AS transfer_requested,
      NULL::boolean AS voicemail,
      NULL::text AS recording_url,
      NULL::text AS recording_gcs_uri,
      '{}'::jsonb AS custom_attributes,
      '{}'::jsonb AS analysis
    `,
  };
};

const baseCte = ({ hasEnrichment, where }) => {
  const enrichment = nullableEnrichmentSelect(hasEnrichment);

  return `
    WITH filtered_calls AS (
      SELECT c.*
        FROM calls c
        ${enrichment.join}
       WHERE ${where}
    ),
    message_latency AS (
      SELECT call_id,
             AVG(latency_ms)::int AS avg_latency_ms,
             MIN(latency_ms)::int AS first_response_latency_ms
        FROM (
          SELECT call_id,
                 EXTRACT(EPOCH FROM (timestamp - LAG(timestamp) OVER (PARTITION BY call_id ORDER BY timestamp))) * 1000 AS latency_ms,
                 speaker::text AS speaker,
                 LAG(speaker::text) OVER (PARTITION BY call_id ORDER BY timestamp) AS prev_speaker
            FROM call_messages
           WHERE call_id IN (SELECT id FROM filtered_calls)
        ) m
       WHERE speaker = 'agent'
         AND prev_speaker IN ('user', 'customer', 'caller')
         AND latency_ms >= 0
         AND latency_ms < 300000
       GROUP BY call_id
    ),
    tool_rollup AS (
      SELECT call_id,
             BOOL_OR(tool_name = 'transfer_to_human_agent') AS has_transfer,
             BOOL_OR(tool_name = 'end_call') AS has_agent_end,
             MAX(COALESCE(input_json->>'language', output_json->>'language')) AS tool_language
        FROM agent_tool_events
       WHERE call_id IN (SELECT id FROM filtered_calls)
       GROUP BY call_id
    ),
    debug_rollup AS (
      SELECT resolved_call_id AS call_id,
             BOOL_OR(event_stage IN ('hangup.twiml', 'hangup.completed')) AS has_agent_hangup,
             BOOL_OR(event_stage = 'silence_timeout') AS has_silence_timeout
        FROM (
          SELECT COALESCE(
                   call_id,
                   CASE
                     WHEN payload->>'call_id' ~ ${UUID_RE} THEN (payload->>'call_id')::uuid
                     ELSE NULL
                   END
                 ) AS resolved_call_id,
                 event_stage,
                 payload
            FROM call_debug_events
           WHERE call_id IN (SELECT id FROM filtered_calls)
              OR (payload->>'call_id') ~ ${UUID_RE}
        ) d
       WHERE resolved_call_id IS NOT NULL
       GROUP BY resolved_call_id
    ),
    call_facts AS (
      SELECT
        c.id,
        c.twilio_call_sid,
        c.customer_id,
        c.customer_phone,
        c.twilio_from,
        c.twilio_to,
        c.direction::text AS direction,
        c.status::text AS status,
        c.language,
        c.issue_type,
        c.resolution_status::text AS resolution_status,
        c.started_at,
        c.ended_at,
        COALESCE(
          c.duration_seconds,
          GREATEST(EXTRACT(EPOCH FROM (COALESCE(c.ended_at, c.started_at) - c.started_at))::int, 0)
        ) AS duration_seconds,
        c.summary,
        c.sentiment,
        c.created_ticket_id,
        c.raw_metadata,
        c.created_at,
        c.updated_at,
        cust.name AS customer_name,
        cust.email AS customer_email,
        cust.preferred_language AS customer_preferred_language,
        ${enrichment.select},
        ml.avg_latency_ms AS derived_average_latency_ms,
        ml.first_response_latency_ms,
        COALESCE(tr.has_transfer, false) AS derived_transfer_requested,
        COALESCE(tr.has_agent_end, false) AS derived_agent_end,
        tr.tool_language,
        COALESCE(dr.has_agent_hangup, false) AS derived_agent_hangup,
        COALESCE(dr.has_silence_timeout, false) AS derived_silence_timeout
      FROM filtered_calls c
      LEFT JOIN customers cust ON cust.id = c.customer_id
      ${enrichment.join}
      LEFT JOIN message_latency ml ON ml.call_id = c.id
      LEFT JOIN tool_rollup tr ON tr.call_id = c.id
      LEFT JOIN debug_rollup dr ON dr.call_id = c.id
    ),
    normalized_calls AS (
      SELECT
        *,
        COALESCE(agent_name, 'Jurinex Voice') AS normalized_agent_name,
        COALESCE(
          channel_type,
          NULLIF(raw_metadata->>'mode', ''),
          CASE WHEN twilio_call_sid IS NOT NULL THEN 'phone_call' ELSE 'web_call' END
        ) AS normalized_channel_type,
        COALESCE(
          end_to_end_latency_ms,
          average_latency_ms,
          derived_average_latency_ms,
          first_response_latency_ms
        ) AS normalized_latency_ms,
        COALESCE(
          preferred_language,
          NULLIF(language, ''),
          NULLIF(customer_preferred_language, ''),
          NULLIF(tool_language, '')
        ) AS normalized_preferred_language,
        COALESCE(
          CASE
            WHEN cost_usd IS NOT NULL THEN cost_usd
            WHEN raw_metadata->>'cost_usd' ~ '^[0-9]+(\\.[0-9]+)?$' THEN (raw_metadata->>'cost_usd')::numeric
            WHEN raw_metadata->>'cost' ~ '^[0-9]+(\\.[0-9]+)?$' THEN (raw_metadata->>'cost')::numeric
            ELSE NULL
          END,
          NULL
        ) AS normalized_cost_usd,
        COALESCE(
          recording_url,
          recording_gcs_uri,
          raw_metadata #>> '{recording,recording}'
        ) AS normalized_recording_uri,
        COALESCE(
          transfer_requested,
          derived_transfer_requested,
          false
        ) AS normalized_transfer_requested,
        COALESCE(
          voicemail,
          false
        ) AS normalized_voicemail,
        COALESCE(
          picked_up,
          status IN ('completed', 'ended') OR duration_seconds > 0,
          false
        ) AS normalized_picked_up,
        COALESCE(
          session_outcome,
          CASE
            WHEN successful IS TRUE THEN 'successful'
            WHEN successful IS FALSE THEN 'unsuccessful'
            WHEN resolution_status IN ('resolved', 'success', 'successful') THEN 'successful'
            WHEN resolution_status IN ('escalated', 'failed', 'unresolved') THEN 'unsuccessful'
            ELSE 'unknown'
          END
        ) AS normalized_session_outcome,
        COALESCE(
          end_reason,
          CASE
            WHEN derived_silence_timeout THEN 'silence_timeout'
            WHEN derived_agent_end OR derived_agent_hangup OR derived_transfer_requested THEN 'agent_hangup'
            WHEN status IN ('completed', 'ended') THEN 'user_hangup'
            ELSE status
          END
        ) AS normalized_end_reason,
        COALESCE(NULLIF(sentiment, ''), analysis->>'user_sentiment', 'unknown') AS normalized_sentiment
      FROM call_facts
    )
  `;
};

const rowSelect = `
  id,
  twilio_call_sid,
  customer_id,
  customer_name,
  customer_email,
  customer_phone,
  twilio_from,
  twilio_to,
  direction,
  status,
  language,
  issue_type,
  resolution_status,
  started_at,
  ended_at,
  duration_seconds,
  summary,
  sentiment,
  created_ticket_id,
  raw_metadata,
  created_at,
  updated_at,
  agent_id,
  normalized_agent_name AS agent_name,
  agent_version,
  normalized_channel_type AS channel_type,
  normalized_session_outcome AS session_outcome,
  normalized_end_reason AS end_reason,
  normalized_latency_ms AS end_to_end_latency_ms,
  normalized_cost_usd AS cost_usd,
  llm_token_count,
  normalized_preferred_language AS preferred_language,
  normalized_picked_up AS picked_up,
  normalized_transfer_requested AS transfer_requested,
  normalized_voicemail AS voicemail,
  normalized_recording_uri AS recording_uri,
  custom_attributes,
  analysis,
  normalized_sentiment AS user_sentiment
`;

const listCalls = async (filters = {}) => {
  const hasEnrichment = await hasEnrichmentTable();
  const { where, values } = buildFilters(filters, { hasEnrichment });
  const limit = clampLimit(filters.limit, 50, 500);
  const offset = clampOffset(filters.offset);

  const cte = baseCte({ hasEnrichment, where });
  const dataParams = [...values, limit, offset];

  const dataResult = await pool.query(
    `
    ${cte}
    SELECT ${rowSelect}
      FROM normalized_calls
     ORDER BY started_at DESC
     LIMIT $${values.length + 1} OFFSET $${values.length + 2}
    `,
    dataParams
  );
  const countResult = await pool.query(
    `
    ${cte}
    SELECT COUNT(*)::int AS total
      FROM normalized_calls
    `,
    values
  );

  return {
    calls: dataResult.rows,
    total: countResult.rows[0]?.total || 0,
    has_enrichment_table: hasEnrichment,
  };
};

const getCallById = async (callId) => {
  const hasEnrichment = await hasEnrichmentTable();
  const cte = baseCte({
    hasEnrichment,
    where: `c.id = $1::uuid`,
  });

  const { rows } = await pool.query(
    `
    ${cte}
    SELECT ${rowSelect}
      FROM normalized_calls
     LIMIT 1
    `,
    [callId]
  );
  return rows[0] || null;
};

const listCallMessages = async (callId) => {
  const { rows } = await pool.query(
    `SELECT id, call_id, speaker::text AS speaker, language, text,
            audio_event_id, timestamp, raw_payload, created_at
       FROM call_messages
      WHERE call_id = $1
      ORDER BY timestamp ASC, created_at ASC`,
    [callId]
  );
  return rows;
};

const listCallDebugEvents = async (callId) => {
  const { rows } = await pool.query(
    `SELECT id, call_id, twilio_call_sid, event_type, event_stage,
            message, payload, created_at
       FROM call_debug_events
      WHERE call_id = $1
         OR (payload->>'call_id') = $1::text
      ORDER BY created_at ASC`,
    [callId]
  );
  return rows;
};

const listCallToolEvents = async (callId) => {
  const { rows } = await pool.query(
    `SELECT id, call_id, tool_name, input_json, output_json,
            success, error_message, created_at
       FROM agent_tool_events
      WHERE call_id = $1
      ORDER BY created_at ASC`,
    [callId]
  );
  return rows;
};

const listCallTickets = async (callId) => {
  const { rows } = await pool.query(
    `SELECT id, ticket_number, customer_id, call_id, issue_type,
            issue_summary, priority::text AS priority, status::text AS status,
            created_at, updated_at
       FROM support_tickets
      WHERE call_id = $1
      ORDER BY created_at ASC`,
    [callId]
  );
  return rows;
};

const listCallEscalations = async (callId) => {
  const { rows } = await pool.query(
    `SELECT id, call_id, ticket_id, reason, assigned_team,
            status::text AS status, created_at, updated_at
       FROM escalations
      WHERE call_id = $1
      ORDER BY created_at ASC`,
    [callId]
  );
  return rows;
};

const getAnalytics = async (filters = {}) => {
  const hasEnrichment = await hasEnrichmentTable();
  const { where, values, start, end } = buildFilters(filters, { hasEnrichment });
  const timezone = String(filters.timezone || 'Asia/Kolkata');
  const cte = baseCte({ hasEnrichment, where });

  const summarySql = `
    ${cte}
    SELECT
      COUNT(*)::int AS call_count,
      COALESCE(SUM(duration_seconds), 0)::int AS total_duration_seconds,
      COALESCE(AVG(duration_seconds), 0)::float AS avg_duration_seconds,
      AVG(normalized_latency_ms)::int AS avg_latency_ms,
      COALESCE(SUM(normalized_cost_usd), 0)::float AS total_cost_usd,
      COALESCE(AVG(CASE WHEN normalized_session_outcome = 'successful' THEN 1.0 ELSE 0.0 END), 0)::float AS success_rate,
      COALESCE(AVG(CASE WHEN normalized_picked_up THEN 1.0 ELSE 0.0 END), 0)::float AS picked_up_rate,
      COALESCE(AVG(CASE WHEN normalized_transfer_requested THEN 1.0 ELSE 0.0 END), 0)::float AS transfer_rate,
      COALESCE(AVG(CASE WHEN normalized_voicemail THEN 1.0 ELSE 0.0 END), 0)::float AS voicemail_rate
      FROM normalized_calls
  `;

  const distributionSql = (field) => `
    ${cte}
    SELECT ${field} AS label, COUNT(*)::int AS value
      FROM normalized_calls
     GROUP BY ${field}
     ORDER BY value DESC, label ASC
  `;

  const dailySql = `
    ${cte}
    SELECT
      ((started_at AT TIME ZONE $${values.length + 1})::date)::text AS date,
      COUNT(*)::int AS call_count,
      COALESCE(SUM(duration_seconds), 0)::int AS total_duration_seconds,
      AVG(normalized_latency_ms)::int AS avg_latency_ms,
      COALESCE(SUM(normalized_cost_usd), 0)::float AS total_cost_usd,
      COALESCE(AVG(CASE WHEN normalized_session_outcome = 'successful' THEN 1.0 ELSE 0.0 END), 0)::float AS success_rate,
      COALESCE(AVG(CASE WHEN normalized_picked_up THEN 1.0 ELSE 0.0 END), 0)::float AS picked_up_rate,
      COALESCE(AVG(CASE WHEN normalized_transfer_requested THEN 1.0 ELSE 0.0 END), 0)::float AS transfer_rate
      FROM normalized_calls
     GROUP BY ((started_at AT TIME ZONE $${values.length + 1})::date)
     ORDER BY date ASC
  `;

  const concurrencySql = `
    ${cte},
    concurrency_events AS (
      SELECT started_at AS ts, 1 AS delta FROM normalized_calls
      UNION ALL
      SELECT COALESCE(ended_at, started_at + (duration_seconds || ' seconds')::interval) AS ts, -1 AS delta
        FROM normalized_calls
    ),
    running AS (
      SELECT ts,
             SUM(delta) OVER (ORDER BY ts ASC, delta DESC ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW) AS concurrent_calls
        FROM concurrency_events
    )
    SELECT ((ts AT TIME ZONE $${values.length + 1})::date)::text AS date,
           MAX(concurrent_calls)::int AS peak_concurrency
      FROM running
     GROUP BY ((ts AT TIME ZONE $${values.length + 1})::date)
     ORDER BY date ASC
  `;

  const agentMetricSql = `
    ${cte}
    SELECT
      COALESCE(normalized_agent_name, 'Jurinex Voice') AS agent_name,
      COUNT(*)::int AS total_calls,
      COALESCE(AVG(CASE WHEN normalized_session_outcome = 'successful' THEN 1.0 ELSE 0.0 END), 0)::float AS success_rate,
      COALESCE(AVG(CASE WHEN normalized_picked_up THEN 1.0 ELSE 0.0 END), 0)::float AS picked_up_rate,
      COALESCE(AVG(CASE WHEN normalized_transfer_requested THEN 1.0 ELSE 0.0 END), 0)::float AS transfer_rate,
      AVG(normalized_latency_ms)::int AS avg_latency_ms
      FROM normalized_calls
     GROUP BY COALESCE(normalized_agent_name, 'Jurinex Voice')
     ORDER BY total_calls DESC, agent_name ASC
  `;

  const client = await pool.connect();
  let summaryResult;
  let outcomeResult;
  let endReasonResult;
  let sentimentResult;
  let directionResult;
  let languageResult;
  let channelResult;
  let dailyResult;
  let concurrencyResult;
  let agentMetricResult;

  try {
    summaryResult = await client.query(summarySql, values);
    outcomeResult = await client.query(distributionSql('normalized_session_outcome'), values);
    endReasonResult = await client.query(distributionSql('normalized_end_reason'), values);
    sentimentResult = await client.query(distributionSql('normalized_sentiment'), values);
    directionResult = await client.query(distributionSql('direction'), values);
    languageResult = await client.query(
      distributionSql("COALESCE(normalized_preferred_language, 'unknown')"),
      values
    );
    channelResult = await client.query(distributionSql('normalized_channel_type'), values);
    dailyResult = await client.query(dailySql, [...values, timezone]);
    concurrencyResult = await client.query(concurrencySql, [...values, timezone]);
    agentMetricResult = await client.query(agentMetricSql, values);
  } finally {
    client.release();
  }

  const concurrencyByDate = new Map(
    concurrencyResult.rows.map((row) => [row.date, row.peak_concurrency])
  );

  return {
    filters: {
      start_date: start.toISOString(),
      end_date: end.toISOString(),
      timezone,
    },
    summary: {
      ...(summaryResult.rows[0] || {}),
      peak_concurrency:
        concurrencyResult.rows.reduce(
          (max, row) => Math.max(max, Number(row.peak_concurrency) || 0),
          0
        ) || 0,
    },
    timeseries: dailyResult.rows.map((row) => ({
      ...row,
      peak_concurrency: concurrencyByDate.get(row.date) || 0,
    })),
    distributions: {
      outcome: outcomeResult.rows,
      end_reason: endReasonResult.rows,
      sentiment: sentimentResult.rows,
      direction: directionResult.rows,
      language: languageResult.rows,
      channel: channelResult.rows,
    },
    agent_metrics: agentMetricResult.rows,
    has_enrichment_table: hasEnrichment,
  };
};

module.exports = {
  hasEnrichmentTable,
  listCalls,
  getCallById,
  listCallMessages,
  listCallDebugEvents,
  listCallToolEvents,
  listCallTickets,
  listCallEscalations,
  getAnalytics,
};
