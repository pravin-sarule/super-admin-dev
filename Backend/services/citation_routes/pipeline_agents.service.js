const logger = require('../../config/logger');

class PipelineAgentsService {
 constructor(repo) {
 this.repo = repo;
 }

 /**
 * Get all agents with computed status (running/idle/error).
 */
 async listAgents(windowMinutes = 5, uptimeWindowHours = 24) {
 logger.debug('[PIPELINE_AGENTS_SVC] computing agent statuses', { windowMinutes, uptimeWindowHours });

 const rows = await this.repo.getAllAgents(windowMinutes, uptimeWindowHours);
 const now = new Date();
 const windowCutoff = new Date(now.getTime() - windowMinutes * 60 * 1000);

 const agents = rows.map(row => {
 let status;
 if (row.last_error_at) {
 status = 'error';
 } else if (row.last_seen_at && new Date(row.last_seen_at) >= windowCutoff) {
 status = 'running';
 } else {
 status = 'idle';
 }

 return {
 agent_name: row.agent_name,
 status,
 last_seen_at: row.last_seen_at,
 last_latency_ms: row.last_latency_ms ? Number(row.last_latency_ms) : null,
 uptime_pct: row.uptime_pct ? Number(row.uptime_pct) : null,
 today_events_count: row.today_events_count,
 };
 });

 logger.info(`[PIPELINE_AGENTS_SVC] computed ${agents.length} agents`);
 return agents;
 }

 /**
 * Get per-agent health card: metrics + recent logs.
 */
 async getAgentHealth(agentName, logLimit = 10, uptimeWindowHours = 24) {
 logger.debug(`[PIPELINE_AGENTS_SVC] fetching health for agent="${agentName}"`);

 const [metrics, recentLogs] = await Promise.all([
 this.repo.getAgentMetrics(agentName, uptimeWindowHours),
 this.repo.getAgentRecentLogs(agentName, logLimit),
 ]);

 // If no logs exist at all, check if agent is real
 if (metrics.today_events_count === 0 && recentLogs.length === 0) {
 const allAgents = await this.repo.getAllAgents(60, 168);
 const exists = allAgents.some(a => a.agent_name === agentName);
 if (!exists) {
 const err = new Error(`Agent "${agentName}" not found`);
 err.status = 404;
 throw err;
 }
 }

 return {
 agent_name: agentName,
 today_events_count: metrics.today_events_count,
 avg_latency_ms_today: metrics.avg_latency_ms_today ? Number(metrics.avg_latency_ms_today) : null,
 uptime_pct_24h: metrics.uptime_pct_24h ? Number(metrics.uptime_pct_24h) : null,
 recent_logs: recentLogs,
 };
 }

 /**
 * Get throughput chart series grouped by bucket.
 */
 async getThroughput(bucket = 'hour', dateStr = null) {
 // Compute IST day bounds
 const istNow = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Kolkata' }));
 let targetDate;
 if (dateStr) {
 targetDate = new Date(dateStr);
 } else {
 targetDate = istNow;
 }

 const dayStart = new Date(targetDate);
 dayStart.setHours(0, 0, 0, 0);
 const dayEnd = new Date(dayStart);
 dayEnd.setDate(dayEnd.getDate() + 1);

 // Format as ISO strings for timestamp comparison
 const dayStartStr = dayStart.toISOString().slice(0, 19).replace('T', ' ');
 const dayEndStr = dayEnd.toISOString().slice(0, 19).replace('T', ' ');

 logger.debug(`[PIPELINE_AGENTS_SVC] fetching throughput bucket=${bucket}, range=${dayStartStr} to ${dayEndStr}`);

 const rows = await this.repo.getThroughput(bucket, dayStartStr, dayEndStr);

 // Group by agent_name
 const seriesMap = {};
 for (const row of rows) {
 if (!seriesMap[row.agent_name]) {
 seriesMap[row.agent_name] = { agent_name: row.agent_name, points: [] };
 }
 seriesMap[row.agent_name].points.push({
 ts: row.ts,
 count: row.count,
 });
 }

 const series = Object.values(seriesMap);
 logger.info(`[PIPELINE_AGENTS_SVC] throughput: ${series.length} agents, ${rows.length} total points`);

 return {
 bucket,
 date: dayStart.toISOString().slice(0, 10),
 series,
 };
 }

 /**
 * List pipeline runs.
 */
 async listRuns(status, page = 1, pageSize = 20) {
 const offset = (page - 1) * pageSize;
 logger.debug(`[PIPELINE_AGENTS_SVC] listing runs status=${status || 'all'}, page=${page}`);

 const { total, rows } = await this.repo.listRuns(status, pageSize, offset);

 return {
 runs: rows,
 pagination: {
 page,
 pageSize,
 total,
 totalPages: Math.ceil(total / pageSize),
 },
 };
 }

 /**
 * Get logs for a specific pipeline run.
 */
 async getRunLogs(runId) {
 logger.debug(`[PIPELINE_AGENTS_SVC] fetching logs for run=${runId}`);
 // Check if run exists first
 const run = await this.repo.getRunById(runId);
 if (!run) {
 const err = new Error(`Pipeline run "${runId}" not found`);
 err.status = 404;
 throw err;
 }
 const logs = await this.repo.getRunLogs(runId);
 return logs;
 }
}

module.exports = PipelineAgentsService;