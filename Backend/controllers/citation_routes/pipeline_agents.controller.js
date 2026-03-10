const logger = require('../../config/logger');
const { sendSuccess, sendError } = require('../../utils/response');

class PipelineAgentsController {
 constructor(service) {
 this.service = service;
 this.listAgents = this.listAgents.bind(this);
 this.getAgentHealth = this.getAgentHealth.bind(this);
 this.getThroughput = this.getThroughput.bind(this);
 this.listRuns = this.listRuns.bind(this);
 this.getRunLogs = this.getRunLogs.bind(this);
 }

 async listAgents(req, res, next) {
 const start = Date.now();
 const { windowMinutes = 5, uptimeWindowHours = 24 } = req.query;
 logger.debug(`[PIPELINE_AGENTS_CTRL] listAgents called`, { requestId: req.requestId, windowMinutes, uptimeWindowHours });
 try {
 const agents = await this.service.listAgents(Number(windowMinutes), Number(uptimeWindowHours));
 logger.info(`[PIPELINE_AGENTS_CTRL] listAgents completed (${Date.now() - start}ms)`, { requestId: req.requestId });
 sendSuccess(res, { agents });
 } catch (err) {
 logger.error(`[PIPELINE_AGENTS_CTRL] listAgents error`, { requestId: req.requestId });
 logger.error(err.stack);
 next(err);
 }
 }

 async getAgentHealth(req, res, next) {
 const start = Date.now();
 const { agentName } = req.params;
 const { logLimit = 10, uptimeWindowHours = 24 } = req.query;
 logger.debug(`[PIPELINE_AGENTS_CTRL] getAgentHealth called for "${agentName}"`, { requestId: req.requestId });
 try {
 const health = await this.service.getAgentHealth(agentName, Number(logLimit), Number(uptimeWindowHours));
 logger.info(`[PIPELINE_AGENTS_CTRL] getAgentHealth completed (${Date.now() - start}ms)`, { requestId: req.requestId });
 sendSuccess(res, health);
 } catch (err) {
 logger.error(`[PIPELINE_AGENTS_CTRL] getAgentHealth error`, { requestId: req.requestId });
 logger.error(err.stack);
 next(err);
 }
 }

 async getThroughput(req, res, next) {
 const start = Date.now();
 const { bucket = 'hour', date } = req.query;
 logger.debug(`[PIPELINE_AGENTS_CTRL] getThroughput called`, { requestId: req.requestId, bucket, date });
 try {
 const result = await this.service.getThroughput(bucket, date || null);
 logger.info(`[PIPELINE_AGENTS_CTRL] getThroughput completed (${Date.now() - start}ms)`, { requestId: req.requestId });
 sendSuccess(res, result);
 } catch (err) {
 logger.error(`[PIPELINE_AGENTS_CTRL] getThroughput error`, { requestId: req.requestId });
 logger.error(err.stack);
 next(err);
 }
 }

 async listRuns(req, res, next) {
 const start = Date.now();
 const { status, page = 1, pageSize = 20 } = req.query;
 logger.debug(`[PIPELINE_AGENTS_CTRL] listRuns called`, { requestId: req.requestId, status, page });
 try {
 const result = await this.service.listRuns(status || null, Number(page), Number(pageSize));
 logger.info(`[PIPELINE_AGENTS_CTRL] listRuns completed (${Date.now() - start}ms)`, { requestId: req.requestId });
 sendSuccess(res, result);
 } catch (err) {
 logger.error(`[PIPELINE_AGENTS_CTRL] listRuns error`, { requestId: req.requestId });
 logger.error(err.stack);
 next(err);
 }
 }

 async getRunLogs(req, res, next) {
 const start = Date.now();
 const { runId } = req.params;
 logger.debug(`[PIPELINE_AGENTS_CTRL] getRunLogs called for run=${runId}`, { requestId: req.requestId });
 try {
 const logs = await this.service.getRunLogs(runId);
 logger.info(`[PIPELINE_AGENTS_CTRL] getRunLogs completed (${Date.now() - start}ms, ${logs.length} logs)`, { requestId: req.requestId });
 sendSuccess(res, { run_id: runId, logs });
 } catch (err) {
 logger.error(`[PIPELINE_AGENTS_CTRL] getRunLogs error`, { requestId: req.requestId });
 logger.error(err.stack);
 next(err);
 }
 }
}

module.exports = PipelineAgentsController;