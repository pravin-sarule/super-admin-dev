const express = require('express');
const Joi = require('joi');
const validate = require('../../middleware/validate.middleware');

const PipelineAgentsRepo = require('../../repositories/citation_routes/pipeline_agents.repo');
const PipelineAgentsService = require('../../services/citation_routes/pipeline_agents.service');
const PipelineAgentsController = require('../../controllers/citation_routes/pipeline_agents.controller');

// Validation schemas
const agentsListSchema = {
 query: Joi.object({
 windowMinutes: Joi.number().integer().min(1).max(60).default(5),
 uptimeWindowHours: Joi.number().integer().min(1).max(168).default(24),
 }),
};

const agentHealthSchema = {
 params: Joi.object({
 agentName: Joi.string().min(1).required(),
 }),
 query: Joi.object({
 logLimit: Joi.number().integer().min(1).max(100).default(10),
 uptimeWindowHours: Joi.number().integer().min(1).max(168).default(24),
 }),
};

const throughputSchema = {
 query: Joi.object({
 bucket: Joi.string().valid('hour', '15min', 'day').default('hour'),
 date: Joi.string().isoDate().optional(),
 }),
};

const runsListSchema = {
 query: Joi.object({
 status: Joi.string().valid('running', 'completed').optional(),
 page: Joi.number().integer().min(1).default(1),
 pageSize: Joi.number().integer().min(1).max(100).default(20),
 }),
};

const runLogsSchema = {
 params: Joi.object({
 runId: Joi.string().uuid().required(),
 }),
};

module.exports = function pipelineAgentsRoutes(citationPool) {
 const router = express.Router();

 // Wire DI
 const repo = new PipelineAgentsRepo(citationPool);
 const service = new PipelineAgentsService(repo);
 const ctrl = new PipelineAgentsController(service);

 // Routes
 router.get('/agents', validate(agentsListSchema), ctrl.listAgents);
 router.get('/agents/:agentName/health', validate(agentHealthSchema), ctrl.getAgentHealth);
 router.get('/throughput', validate(throughputSchema), ctrl.getThroughput);
 router.get('/runs', validate(runsListSchema), ctrl.listRuns);
 router.get('/runs/:runId/logs', validate(runLogsSchema), ctrl.getRunLogs);

 return router;
};
