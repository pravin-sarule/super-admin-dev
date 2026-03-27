const logger = require('../../config/logger');

const BUCKET_SQL = {
 hour: `date_trunc('hour', created_at)`,
 day: `date_trunc('day', created_at)`,
 '15min': `timestamp '2000-01-01' + INTERVAL '15 min' * FLOOR(EXTRACT(EPOCH FROM created_at - timestamp '2000-01-01') / 900)`,
};

class PipelineAgentsRepo {
 constructor(pool) {
 this.pool = pool;
 }

 /**
 * All agents with status-relevant timestamps, today counts, uptime, latency.
 * Uses IST-safe day bounds via CTE.
 */
 async getAllAgents(windowMinutes, uptimeWindowHours) {
 const sql = `
 WITH bounds AS (
 SELECT
 date_trunc('day', NOW() AT TIME ZONE 'Asia/Kolkata')::timestamp AS ist_day_start,
 (date_trunc('day', NOW() AT TIME ZONE 'Asia/Kolkata') + INTERVAL '1 day')::timestamp AS ist_day_end
 )
 SELECT
 al.agent_name,
 MAX(al.created_at) AS last_seen_at,
 MAX(al.created_at) FILTER (
 WHERE al.log_level = 'ERROR'
 AND al.created_at >= (now()::timestamp - INTERVAL '1 minute' * $1)
 ) AS last_error_at,
 COUNT(*) FILTER (
 WHERE al.created_at >= bounds.ist_day_start
 AND al.created_at < bounds.ist_day_end
 )::int AS today_events_count,
 CASE
 WHEN COUNT(*) FILTER (WHERE al.created_at >= now()::timestamp - INTERVAL '1 hour' * $2) = 0 THEN NULL
 ELSE ROUND(
 100.0 * COUNT(*) FILTER (WHERE al.created_at >= now()::timestamp - INTERVAL '1 hour' * $2 AND al.log_level != 'ERROR')
 / NULLIF(COUNT(*) FILTER (WHERE al.created_at >= now()::timestamp - INTERVAL '1 hour' * $2), 0)
 , 2)
 END AS uptime_pct,
 (SELECT (a2.metadata->>'latency_ms')::numeric
 FROM agent_logs a2
 WHERE a2.agent_name = al.agent_name
 ORDER BY a2.created_at DESC LIMIT 1
 ) AS last_latency_ms
 FROM agent_logs al, bounds
 GROUP BY al.agent_name, bounds.ist_day_start, bounds.ist_day_end
 ORDER BY al.agent_name
 `;
 const start = Date.now();
 const { rows } = await this.pool.query(sql, [windowMinutes, uptimeWindowHours]);
 logger.info(`[PIPELINE_AGENTS_REPO] getAllAgents completed (${Date.now() - start}ms, ${rows.length} agents)`);
 return rows;
 }

 /**
 * Per-agent metrics (today count, avg latency, uptime).
 */
 async getAgentMetrics(agentName, uptimeWindowHours) {
 const sql = `
 WITH bounds AS (
 SELECT
 date_trunc('day', NOW() AT TIME ZONE 'Asia/Kolkata')::timestamp AS ist_day_start,
 (date_trunc('day', NOW() AT TIME ZONE 'Asia/Kolkata') + INTERVAL '1 day')::timestamp AS ist_day_end
 )
 SELECT
 COUNT(*) FILTER (
 WHERE created_at >= bounds.ist_day_start
 AND created_at < bounds.ist_day_end
 )::int AS today_events_count,
 AVG((metadata->>'latency_ms')::numeric) FILTER (
 WHERE created_at >= bounds.ist_day_start
 AND created_at < bounds.ist_day_end
 AND metadata->>'latency_ms' IS NOT NULL
 ) AS avg_latency_ms_today,
 CASE
 WHEN COUNT(*) FILTER (WHERE created_at >= now()::timestamp - INTERVAL '1 hour' * $2) = 0 THEN NULL
 ELSE ROUND(
 100.0 * COUNT(*) FILTER (WHERE created_at >= now()::timestamp - INTERVAL '1 hour' * $2 AND log_level != 'ERROR')
 / NULLIF(COUNT(*) FILTER (WHERE created_at >= now()::timestamp - INTERVAL '1 hour' * $2), 0)
 , 2)
 END AS uptime_pct_24h
 FROM agent_logs, bounds
 WHERE agent_name = $1
 GROUP BY bounds.ist_day_start, bounds.ist_day_end
 `;
 const start = Date.now();
 const { rows } = await this.pool.query(sql, [agentName, uptimeWindowHours]);
 logger.info(`[PIPELINE_AGENTS_REPO] getAgentMetrics(${agentName}) completed (${Date.now() - start}ms)`);
 return rows[0] || { today_events_count: 0, avg_latency_ms_today: null, uptime_pct_24h: null };
 }

 /**
 * Recent logs for a specific agent.
 */
 async getAgentRecentLogs(agentName, logLimit) {
 const sql = `
 SELECT id, created_at, log_level, message, stage, metadata
 FROM agent_logs
 WHERE agent_name = $1
 ORDER BY created_at DESC
 LIMIT $2
 `;
 const start = Date.now();
 const { rows } = await this.pool.query(sql, [agentName, logLimit]);
 logger.info(`[PIPELINE_AGENTS_REPO] getAgentRecentLogs(${agentName}, limit=${logLimit}) completed (${Date.now() - start}ms, ${rows.length} rows)`);
 return rows;
 }

 /**
 * Throughput chart data grouped by bucket. Bucket expression is whitelisted.
 */
 async getThroughput(bucket, dayStart, dayEnd) {
 const bucketExpr = BUCKET_SQL[bucket];
 if (!bucketExpr) throw new Error(`Invalid bucket: ${bucket}`);

 const sql = `
 SELECT
 agent_name,
 ${bucketExpr} AS ts,
 COUNT(*)::int AS count
 FROM agent_logs
 WHERE created_at >= $1::timestamp
 AND created_at < $2::timestamp
 GROUP BY agent_name, ${bucketExpr}
 ORDER BY agent_name, ts
 `;
 const start = Date.now();
 const { rows } = await this.pool.query(sql, [dayStart, dayEnd]);
 logger.info(`[PIPELINE_AGENTS_REPO] getThroughput(bucket=${bucket}) completed (${Date.now() - start}ms, ${rows.length} points)`);
 return rows;
 }

 /**
 * List pipeline runs with optional status filter + pagination.
 */
 async listRuns(status, limit, offset) {
 const conditions = [];
 const params = [];
 let idx = 1;

 if (status) {
 conditions.push(`status = $${idx++}`);
 params.push(status);
 }

 const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

 const countSql = `SELECT COUNT(*)::int AS total FROM citation_pipeline_runs ${where}`;
 const dataSql = `
 SELECT id, user_id, case_id, query, status, report_id,
 citations_fetched_count, citations_approved_count,
 citations_quarantined_count, citations_sent_to_hitl_count,
 started_at, completed_at, error_message, created_at
 FROM citation_pipeline_runs
 ${where}
 ORDER BY started_at DESC
 LIMIT $${idx++} OFFSET $${idx++}
 `;
 params.push(limit, offset);

 const start = Date.now();
 const [countRes, dataRes] = await Promise.all([
 this.pool.query(countSql, status ? [status] : []),
 this.pool.query(dataSql, params),
 ]);
 logger.info(`[PIPELINE_AGENTS_REPO] listRuns completed (${Date.now() - start}ms, ${dataRes.rows.length} rows)`);
 return { total: countRes.rows[0]?.total || 0, rows: dataRes.rows };
 }

 /**
 * Logs for a specific pipeline run.
 */
 async getRunLogs(runId) {
 const sql = `
 SELECT id, agent_name, stage, log_level, message, metadata, created_at
 FROM agent_logs
 WHERE run_id = $1
 ORDER BY created_at ASC
 `;
 const start = Date.now();
 const { rows } = await this.pool.query(sql, [runId]);
 logger.info(`[PIPELINE_AGENTS_REPO] getRunLogs(${runId}) completed (${Date.now() - start}ms, ${rows.length} logs)`);
 return rows;
 }

 /**
 * Check if a pipeline run exists by ID.
 */
 async getRunById(runId) {
 const sql = `SELECT id FROM citation_pipeline_runs WHERE id = $1`;
 const { rows } = await this.pool.query(sql, [runId]);
 return rows[0] || null;
 }
}

module.exports = PipelineAgentsRepo;
